const { config } = require("./config");
const { SEARCH_GROUPS } = require("./foodTypes");

const GOOGLE_NEARBY_SEARCH_URL = "https://places.googleapis.com/v1/places:searchNearby";
const GOOGLE_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

async function searchPlacesForGroup(lat, lng, searchGroup, radius, languageCode) {
  if (!config.placesApiKey) {
    throw createGoogleError("MISSING_GOOGLE_PLACES_API_KEY", "Backend is missing GOOGLE_PLACES_API_KEY.");
  }

  const group = SEARCH_GROUPS[searchGroup];
  if (!group) {
    throw createGoogleError("INVALID_SEARCH_GROUP", `Unknown search group: ${searchGroup}.`);
  }

  const isTextSearch = group.searchMethod === "text";
  const response = await fetch(isTextSearch ? GOOGLE_TEXT_SEARCH_URL : GOOGLE_NEARBY_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": config.placesApiKey,
      "X-Goog-FieldMask": config.googleFieldMask
    },
    body: JSON.stringify(isTextSearch
      ? buildTextSearchRequest(lat, lng, group, radius, languageCode)
      : buildNearbySearchRequest(lat, lng, group, radius, languageCode))
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

function buildTextSearchRequest(lat, lng, group, radius, languageCode) {
  return {
    textQuery: group.textQuery,
    pageSize: config.googleMaxResultCount,
    rankPreference: "DISTANCE",
    languageCode,
    locationRestriction: {
      rectangle: buildBoundingRectangle(lat, lng, radius)
    }
  };
}

function buildBoundingRectangle(lat, lng, radius) {
  const latitudeDelta = radius / 111_320;
  const longitudeScale = Math.max(Math.cos(lat * Math.PI / 180), 0.01);
  const longitudeDelta = radius / (111_320 * longitudeScale);
  return {
    low: {
      latitude: Math.max(-90, lat - latitudeDelta),
      longitude: normalizeLongitude(lng - longitudeDelta)
    },
    high: {
      latitude: Math.min(90, lat + latitudeDelta),
      longitude: normalizeLongitude(lng + longitudeDelta)
    }
  };
}

function normalizeLongitude(value) {
  if (value > 180) return 180;
  if (value < -180) return -180;
  return value;
}

function buildNearbySearchRequest(lat, lng, group, radius, languageCode) {
  return {
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
  };
}

function createGoogleError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.publicMessage = message;
  return error;
}

module.exports = {
  searchPlacesForGroup,
  buildNearbySearchRequest,
  buildTextSearchRequest,
  buildBoundingRectangle,
  GOOGLE_NEARBY_SEARCH_URL,
  GOOGLE_TEXT_SEARCH_URL
};
