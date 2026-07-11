const config = {
  port: numberFromEnv("PORT", 3000),
  placesApiKey: normalizeApiKey(process.env.GOOGLE_PLACES_API_KEY),
  maxDailyGoogleCalls: numberFromEnv("MAX_DAILY_GOOGLE_CALLS", 25),
  cacheTtlHours: numberFromEnv("CACHE_TTL_HOURS", 24),
  initialSearchRadiusMeters: numberFromEnv("INITIAL_SEARCH_RADIUS_METERS", 3000),
  expandedSearchRadiusMeters: numberFromEnv("EXPANDED_SEARCH_RADIUS_METERS", 5000),
  rateLimitWindowMinutes: numberFromEnv("RATE_LIMIT_WINDOW_MINUTES", 10),
  rateLimitMaxRequests: numberFromEnv("RATE_LIMIT_MAX_REQUESTS", 30),
  googleErrorCooldownMinutes: numberFromEnv("GOOGLE_ERROR_COOLDOWN_MINUTES", 30),
  recommendationCount: numberFromEnv("RECOMMENDATION_COUNT", 20),
  googleMaxResultCount: numberFromEnv("GOOGLE_MAX_RESULT_COUNT", 20),
  googleFieldMask: [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.primaryType",
    "places.types",
    "places.rating",
    "places.priceLevel",
    "places.priceRange",
    "places.userRatingCount",
    "places.currentOpeningHours",
    "places.googleMapsUri"
  ].join(",")
};

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function normalizeApiKey(value) {
  if (!value || value === "your_google_places_api_key_here") {
    return "";
  }

  return value;
}

module.exports = { config };
