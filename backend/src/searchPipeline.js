const { config } = require("./config");
const { getCache, setCache } = require("./cache");
const { canCallGoogle, incrementDailyGoogleCallCount } = require("./quota");
const { searchPlacesForGroup } = require("./googlePlaces");

async function buildCandidatePool({
  lat,
  lng,
  searchGroups,
  languageCode,
  errorKeyPrefix,
  formatRestaurant,
  prepareCandidates,
  searchPlaces = searchPlacesForGroup
}) {
  const state = {
    places: [],
    googleCallsUsed: 0,
    quotaLimited: false,
    failedGroups: []
  };

  await runStage({
    lat,
    lng,
    radius: config.initialSearchRadiusMeters,
    searchGroups,
    languageCode,
    errorKeyPrefix,
    formatRestaurant,
    searchPlaces,
    state
  });

  let pool = prepareCandidates(state.places);
  let searchRadiusMeters = config.initialSearchRadiusMeters;

  if (pool.length < config.recommendationCount && !state.quotaLimited) {
    await runStage({
      lat,
      lng,
      radius: config.expandedSearchRadiusMeters,
      searchGroups,
      languageCode,
      errorKeyPrefix,
      formatRestaurant,
      searchPlaces,
      state
    });
    pool = prepareCandidates(state.places);
    searchRadiusMeters = config.expandedSearchRadiusMeters;
  }

  return {
    pool,
    searchRadiusMeters,
    googleCallsUsed: state.googleCallsUsed,
    quotaLimited: state.quotaLimited,
    failedGroups: state.failedGroups
  };
}

async function runStage({ lat, lng, radius, searchGroups, languageCode, errorKeyPrefix, formatRestaurant, searchPlaces, state }) {
  for (const searchGroup of searchGroups) {
    const cooldownKey = `${errorKeyPrefix}:${searchGroup}:${radius}`;
    if (getCache(cooldownKey)) {
      state.failedGroups.push(searchGroup);
      continue;
    }

    if (!canCallGoogle()) {
      state.quotaLimited = true;
      break;
    }

    incrementDailyGoogleCallCount();
    state.googleCallsUsed += 1;

    try {
      const places = await searchPlaces(lat, lng, searchGroup, radius, languageCode);
      const restaurants = places
        .map((place) => formatRestaurant(place, lat, lng))
        .filter((restaurant) => isWithinSearchRadius(restaurant, radius));
      state.places.push(...restaurants);
    } catch (error) {
      state.failedGroups.push(searchGroup);
      setCache(
        cooldownKey,
        { message: error.message, createdAt: new Date().toISOString() },
        config.googleErrorCooldownMinutes * 60 * 1000
      );
    }
  }
}

function isWithinSearchRadius(restaurant, radius) {
  return Number.isFinite(restaurant.distanceMeters)
    && restaurant.distanceMeters >= 0
    && restaurant.distanceMeters <= radius;
}

module.exports = { buildCandidatePool, isWithinSearchRadius };
