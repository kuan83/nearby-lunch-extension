const { config } = require("./config");
const { getCache, setCache } = require("./cache");
const { getLocalDateKey, msUntilTomorrow } = require("./time");

function getDailyGoogleCallCount(date = getLocalDateKey()) {
  return getCache(buildGoogleCallsKey(date)) || 0;
}

function canCallGoogle() {
  return getDailyGoogleCallCount() < config.maxDailyGoogleCalls;
}

function incrementDailyGoogleCallCount() {
  const key = buildGoogleCallsKey();
  const nextCount = getDailyGoogleCallCount() + 1;
  setCache(key, nextCount, msUntilTomorrow());
  return nextCount;
}

function buildGoogleCallsKey(date = getLocalDateKey()) {
  return `googleCalls:${date}`;
}

module.exports = {
  canCallGoogle,
  incrementDailyGoogleCallCount,
  getDailyGoogleCallCount
};
