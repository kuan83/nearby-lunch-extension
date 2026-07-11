const { config } = require("./config");
const { getCache, setCache } = require("./cache");
const { getDailyGoogleCallCount } = require("./quota");
const { getLocalDateKey, msUntilTomorrow } = require("./time");
const { parseFoodTypes } = require("./foodTypes");
const { filterByPriceRange, getPriceRangeLabel, normalizePriceRange, parsePriceRange } = require("./priceRange");
const { buildRestaurantKey, diversifyOfficeLunchRestaurants } = require("./officeLunch");
const { buildOfficeLunchCandidatePool } = require("./searchPipeline");

const SEARCH_PROFILE = "officeLunchV10";

async function getLunchRecommendations({ lat, lng, clientId, priceRange: priceRangeValue, foodTypes: foodTypesValue, refresh }) {
  const location = parseLocation(lat, lng);
  const safeClientId = parseClientId(clientId);
  const priceRange = parsePriceRange(priceRangeValue);
  const { selectedFoodTypes, foodTypesKey, searchGroups } = parseFoodTypes(foodTypesValue);
  const date = getLocalDateKey();
  const geoBucket = buildGeoBucket(location.lat, location.lng);
  const keys = buildCacheKeys({ date, geoBucket, clientId: safeClientId, priceRange, foodTypesKey });

  const clientCache = getCache(keys.client);
  if (clientCache && !refresh) {
    return buildResponse(clientCache.restaurants, clientCache.metadata, {
      cached: true,
      cacheSource: "client",
      geoBucket,
      priceRange,
      foodTypes: selectedFoodTypes,
      foodTypesKey,
      cycleReset: Boolean(clientCache.cycleReset)
    });
  }

  const areaCache = getCache(keys.area);
  const poolCache = areaCache || clientCache;
  if (poolCache) {
    const batch = buildRecommendationBatch({
      pool: poolCache.pool || [],
      priceRange,
      seenRestaurantIds: refresh && clientCache ? clientCache.seenRestaurantIds : []
    });
    const metadata = poolCache.metadata || {};
    setCache(keys.client, buildClientCacheValue({
      restaurants: batch.restaurants,
      pool: poolCache.pool || [],
      metadata,
      priceRange,
      foodTypes: selectedFoodTypes,
      foodTypesKey,
      seenRestaurantIds: batch.seenRestaurantIds,
      cycleReset: batch.cycleReset
    }), msUntilTomorrow());

    return buildResponse(batch.restaurants, metadata, {
      cached: true,
      cacheSource: refresh ? "area-refresh" : "area",
      geoBucket,
      priceRange,
      foodTypes: selectedFoodTypes,
      foodTypesKey,
      cycleReset: batch.cycleReset
    });
  }

  if (refresh) {
    throw publicError(409, "REFRESH_CACHE_MISS", "No cached lunch recommendations are available to refresh.");
  }
  if (!config.placesApiKey) {
    throw publicError(500, "MISSING_GOOGLE_PLACES_API_KEY", "Backend is missing GOOGLE_PLACES_API_KEY.");
  }

  const staleCache = getCache(keys.staleArea);
  const result = await buildOfficeLunchCandidatePool({
    lat: location.lat,
    lng: location.lng,
    searchGroups,
    errorKeyPrefix: keys.googleError,
    formatRestaurant
  });

  if (!result.pool.length) {
    if (staleCache) {
      return buildResponseFromStale(staleCache, priceRange, {
        geoBucket,
        priceRange,
        foodTypes: selectedFoodTypes,
        foodTypesKey,
        quotaLimited: result.quotaLimited
      });
    }

    if (result.quotaLimited) {
      throw publicError(429, "DAILY_GOOGLE_QUOTA_REACHED", "Daily Google Places limit reached. Please try again tomorrow.");
    }
    throw publicError(502, "GOOGLE_PLACES_ERROR", "Google Places searches failed. Please try again later.");
  }

  const metadata = {
    searchRadiusMeters: result.searchRadiusMeters,
    candidateCount: result.pool.length,
    googleCallsUsed: result.googleCallsUsed,
    resultShortfall: result.pool.length < config.recommendationCount,
    quotaLimited: result.quotaLimited,
    failedGroups: [...new Set(result.failedGroups)]
  };
  const batch = buildRecommendationBatch({ pool: result.pool, priceRange, seenRestaurantIds: [] });
  const areaValue = { pool: result.pool, metadata, createdAt: new Date().toISOString() };
  const clientValue = buildClientCacheValue({
    restaurants: batch.restaurants,
    pool: result.pool,
    metadata,
    priceRange,
    foodTypes: selectedFoodTypes,
    foodTypesKey,
    seenRestaurantIds: batch.seenRestaurantIds,
    cycleReset: batch.cycleReset
  });

  setCache(keys.area, areaValue, config.cacheTtlHours * 60 * 60 * 1000);
  setCache(keys.client, clientValue, msUntilTomorrow());
  setCache(keys.staleArea, areaValue, 7 * 24 * 60 * 60 * 1000);

  return buildResponse(batch.restaurants, metadata, {
    cached: false,
    cacheSource: "google",
    geoBucket,
    priceRange,
    foodTypes: selectedFoodTypes,
    foodTypesKey,
    cycleReset: batch.cycleReset,
    quotaLimited: result.quotaLimited
  });
}

function formatRestaurant(place, originLat, originLng) {
  const priceRange = normalizePriceRange(place.priceRange);
  const latitude = place.location && Number(place.location.latitude);
  const longitude = place.location && Number(place.location.longitude);

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
    userRatingCount: Number(place.userRatingCount || 0),
    priceLevel: place.priceLevel || null,
    priceRange,
    priceRangeLabel: getPriceRangeLabel(priceRange),
    priceLabel: getPriceRangeLabel(priceRange),
    address: place.formattedAddress || "地址資料不足",
    isOpen: place.currentOpeningHours && typeof place.currentOpeningHours.openNow === "boolean"
      ? place.currentOpeningHours.openNow
      : null,
    googleMapsUrl: place.googleMapsUri || buildGoogleMapsSearchUrl(place)
  };
}

function buildRecommendationBatch({ pool, priceRange, seenRestaurantIds }) {
  const candidates = diversifyOfficeLunchRestaurants(filterByPriceRange(pool, priceRange));
  const previousSeen = new Set(Array.isArray(seenRestaurantIds) ? seenRestaurantIds : []);
  let source = candidates.filter((restaurant) => !previousSeen.has(buildRestaurantKey(restaurant)));
  let nextSeen = new Set(previousSeen);
  let cycleReset = false;

  if (!source.length && candidates.length) {
    source = candidates;
    nextSeen = new Set();
    cycleReset = true;
  }

  const restaurants = source.slice(0, config.recommendationCount);
  restaurants.forEach((restaurant) => nextSeen.add(buildRestaurantKey(restaurant)));
  return { restaurants, seenRestaurantIds: [...nextSeen], cycleReset };
}

function buildResponse(restaurants, metadata = {}, options = {}) {
  return {
    restaurants,
    cached: Boolean(options.cached),
    cacheSource: options.cacheSource,
    geoBucket: options.geoBucket,
    priceRange: options.priceRange || "all",
    foodTypes: options.foodTypes || [],
    foodTypesKey: options.foodTypesKey || "",
    cycleReset: Boolean(options.cycleReset),
    quotaLimited: Boolean(options.quotaLimited || metadata.quotaLimited),
    searchRadiusMeters: metadata.searchRadiusMeters || config.initialSearchRadiusMeters,
    candidateCount: Number(metadata.candidateCount || restaurants.length),
    googleCallsUsed: Number(metadata.googleCallsUsed || 0),
    resultShortfall:
      !String(options.cacheSource || "").includes("refresh")
      && restaurants.length < config.recommendationCount,
    failedGroups: metadata.failedGroups || [],
    quota: {
      dailyGoogleCalls: getDailyGoogleCallCount(),
      maxDailyGoogleCalls: config.maxDailyGoogleCalls
    }
  };
}

function buildResponseFromStale(staleCache, priceRange, options) {
  const restaurants = diversifyOfficeLunchRestaurants(
    filterByPriceRange(staleCache.pool || [], priceRange)
  ).slice(0, config.recommendationCount);
  return buildResponse(restaurants, staleCache.metadata, {
    ...options,
    cached: true,
    cacheSource: "stale"
  });
}

function buildClientCacheValue(value) {
  return { ...value, cycleReset: Boolean(value.cycleReset), createdAt: new Date().toISOString() };
}

function buildCacheKeys({ date, geoBucket, clientId, priceRange, foodTypesKey }) {
  return {
    client: `client:${date}:${clientId}:${geoBucket}:${priceRange}:${SEARCH_PROFILE}:${foodTypesKey}`,
    area: `area:${date}:${geoBucket}:${SEARCH_PROFILE}:${foodTypesKey}`,
    staleArea: `staleArea:${geoBucket}:${SEARCH_PROFILE}:${foodTypesKey}`,
    googleError: `googleError:${date}:${geoBucket}:${SEARCH_PROFILE}:${foodTypesKey}`
  };
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
  formatRestaurant,
  buildRecommendationBatch
};
