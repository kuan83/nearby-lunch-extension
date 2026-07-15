const { config } = require("./config");
const { getDailyGoogleCallCount } = require("./quota");
const { getLocalDateKey } = require("./time");
const { parsePlacesLanguage } = require("./language");
const { parseMealMode, parseFoodTypes, MEAL_MODE_LATE_NIGHT } = require("./foodTypes");
const { filterByPriceRange, getPriceRangeLabel, normalizePriceRange, parsePriceRange, validatePriceRangeForMealMode } = require("./priceRange");
const {
  buildRestaurantKey,
  diversifyOfficeLunchRestaurants,
  filterOfficeLunchRestaurants
} = require("./officeLunch");
const { filterLateNightRestaurants, diversifyLateNightRestaurants, deriveLateNightHours } = require("./lateNight");
const { buildCandidatePool } = require("./searchPipeline");

async function getLunchRecommendations({ lat, lng, clientId, mealMode: mealModeValue, priceRange: priceRangeValue, foodTypes: foodTypesValue, languageCode: languageCodeValue }) {
  const location = parseLocation(lat, lng);
  parseClientId(clientId);
  const mealMode = parseMealMode(mealModeValue);
  const priceRange = validatePriceRangeForMealMode(parsePriceRange(priceRangeValue), mealMode);
  const languageCode = parsePlacesLanguage(languageCodeValue);
  const { selectedFoodTypes, foodTypesKey, searchGroups } = parseFoodTypes(foodTypesValue, mealMode);
  const geoBucket = buildGeoBucket(location.lat, location.lng);
  const errorKeyPrefix = `googleError:${getLocalDateKey()}:${geoBucket}:${mealMode}:${foodTypesKey}`;

  if (!config.placesApiKey) {
    throw publicError(500, "MISSING_GOOGLE_PLACES_API_KEY", "Backend is missing GOOGLE_PLACES_API_KEY.");
  }

  const isLateNight = mealMode === MEAL_MODE_LATE_NIGHT;
  const prepareCandidates = (places) => {
    const filtered = isLateNight
      ? filterLateNightRestaurants(places)
      : filterOfficeLunchRestaurants(places);
    const priceFiltered = filterByPriceRange(filtered, priceRange);
    return isLateNight
      ? diversifyLateNightRestaurants(priceFiltered, {
        selectedSearchGroups: searchGroups,
        recommendationCount: config.recommendationCount
      })
      : diversifyOfficeLunchRestaurants(priceFiltered);
  };
  const result = await buildCandidatePool({
    lat: location.lat,
    lng: location.lng,
    searchGroups,
    languageCode,
    errorKeyPrefix,
    prepareCandidates,
    formatRestaurant: (place, originLat, originLng) => formatRestaurant(place, originLat, originLng, mealMode)
  });

  if (!result.pool.length) {
    if (result.quotaLimited) {
      throw publicError(429, "DAILY_GOOGLE_QUOTA_REACHED", "Daily Google Places limit reached. Please try again tomorrow.");
    }
    throw publicError(502, "GOOGLE_PLACES_ERROR", "Google Places searches failed. Please try again later.");
  }

  const candidates = result.pool;
  const restaurants = candidates.slice(0, config.recommendationCount);

  return {
    restaurants,
    sessionCandidates: candidates,
    mealMode,
    geoBucket,
    priceRange,
    foodTypes: selectedFoodTypes,
    foodTypesKey,
    quotaLimited: Boolean(result.quotaLimited),
    searchRadiusMeters: result.searchRadiusMeters,
    candidateCount: candidates.length,
    googleCallsUsed: result.googleCallsUsed,
    resultShortfall: restaurants.length < config.recommendationCount,
    failedGroups: [...new Set(result.failedGroups)],
    quota: {
      dailyGoogleCalls: getDailyGoogleCallCount(),
      maxDailyGoogleCalls: config.maxDailyGoogleCalls
    }
  };
}

function formatRestaurant(place, originLat, originLng, mealMode = "lunch") {
  const priceRange = normalizePriceRange(place.priceRange);
  const latitude = place.location && Number(place.location.latitude);
  const longitude = place.location && Number(place.location.longitude);
  const lateNightHours = mealMode === MEAL_MODE_LATE_NIGHT
    ? deriveLateNightHours(place)
    : {};

  return {
    id: place.id || null,
    name: place.displayName && place.displayName.text ? place.displayName.text : "未命名店家",
    rating: Number(place.rating || 0),
    primaryType: place.primaryType || null,
    types: Array.isArray(place.types) ? place.types : [],
    searchGroup: place._searchGroup || null,
    distanceMeters: Number.isFinite(latitude) && Number.isFinite(longitude)
      ? Math.round(haversineMeters(originLat, originLng, latitude, longitude))
      : null,
    priceLevel: place.priceLevel || null,
    priceRange,
    priceRangeLabel: getPriceRangeLabel(priceRange),
    address: place.formattedAddress || "地址資料不足",
    isOpen: place.currentOpeningHours && typeof place.currentOpeningHours.openNow === "boolean"
      ? place.currentOpeningHours.openNow
      : null,
    googleMapsUrl: place.googleMapsUri || buildGoogleMapsSearchUrl(place),
    ...lateNightHours
  };
}

function buildRecommendationBatch(candidates, seenRestaurantIds) {
  const seen = new Set(Array.isArray(seenRestaurantIds) ? seenRestaurantIds : []);
  let source = candidates.filter((restaurant) => !seen.has(buildRestaurantKey(restaurant)));
  let cycleReset = false;

  if (!source.length && candidates.length) {
    source = candidates;
    seen.clear();
    cycleReset = true;
  }

  const restaurants = source.slice(0, config.recommendationCount);
  restaurants.forEach((restaurant) => seen.add(buildRestaurantKey(restaurant)));
  return { restaurants, seenRestaurantIds: [...seen], cycleReset };
}

function parseLocation(latValue, lngValue) {
  const lat = Number(latValue);
  const lng = Number(lngValue);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw publicError(400, "INVALID_LOCATION", "lat and lng must be valid numbers.");
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw publicError(400, "INVALID_LOCATION_RANGE", "lat or lng is outside the valid coordinate range.");
  }
  return { lat, lng };
}

function parseClientId(clientId) {
  if (!clientId || !/^[a-zA-Z0-9_-]{12,80}$/.test(clientId)) {
    throw publicError(400, "INVALID_CLIENT_ID", "X-Lunch-Client-Id is required.");
  }
  return clientId;
}

function buildGeoBucket(lat, lng) {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

function buildGoogleMapsSearchUrl(place) {
  const name = place.displayName && place.displayName.text ? place.displayName.text : "restaurant";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const earthRadius = 6371000;
  const latDifference = toRadians(lat2 - lat1);
  const lngDifference = toRadians(lng2 - lng1);
  const a = Math.sin(latDifference / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(lngDifference / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function publicError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.publicMessage = message;
  return error;
}

module.exports = {
  getLunchRecommendations,
  buildGeoBucket,
  buildRecommendationBatch,
  formatRestaurant
};
