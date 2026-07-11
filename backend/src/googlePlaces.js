const { config } = require("./config");
const { SEARCH_GROUPS } = require("./foodTypes");

const GOOGLE_NEARBY_SEARCH_URL = "https://places.googleapis.com/v1/places:searchNearby";

async function searchNearbyRestaurants(lat, lng, searchGroup, radius, languageCode) {
  if (!config.placesApiKey) {
    throw createGoogleError("MISSING_GOOGLE_PLACES_API_KEY", "Backend is missing GOOGLE_PLACES_API_KEY.");
  }

  const group = SEARCH_GROUPS[searchGroup];
  if (!group) {
    throw createGoogleError("INVALID_SEARCH_GROUP", `Unknown search group: ${searchGroup}.`);
  }

  const response = await fetch(GOOGLE_NEARBY_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": config.placesApiKey,
      "X-Goog-FieldMask": config.googleFieldMask
    },
    body: JSON.stringify({
      includedTypes: group.includedTypes,
      maxResultCount: config.googleMaxResultCount,
      rankPreference: "DISTANCE",
      languageCode,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius
        }
      }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createGoogleError(
      "GOOGLE_PLACES_ERROR",
      data.error && data.error.message ? data.error.message : `Google Places API returned ${response.status}.`
    );
  }

  return (Array.isArray(data.places) ? data.places : []).map((place) => ({
    ...place,
    _searchGroup: searchGroup
  }));
}

function createGoogleError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.publicMessage = message;
  return error;
}

module.exports = { searchNearbyRestaurants };
