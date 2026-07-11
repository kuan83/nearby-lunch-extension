const { config } = require("./config");
const { getCache, setCache } = require("./cache");
const { canCallGoogle, incrementDailyGoogleCallCount } = require("./quota");
const { searchNearbyRestaurants } = require("./googlePlaces");
const { filterOfficeLunchRestaurants } = require("./officeLunch");

async function buildOfficeLunchCandidatePool({ lat, lng, searchGroups, languageCode, errorKeyPrefix, formatRestaurant }) {
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
    state
  });

  let pool = filterOfficeLunchRestaurants(state.places);
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
      state
    });
    pool = filterOfficeLunchRestaurants(state.places);
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

async function runStage({ lat, lng, radius, searchGroups, languageCode, errorKeyPrefix, formatRestaurant, state }) {
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
      const places = await searchNearbyRestaurants(lat, lng, searchGroup, radius, languageCode);
      state.places.push(...places.map((place) => formatRestaurant(place, lat, lng)));
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

module.exports = { buildOfficeLunchCandidatePool };
