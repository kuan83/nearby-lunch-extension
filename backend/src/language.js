const DEFAULT_PLACES_LANGUAGE = "zh-TW";
const SUPPORTED_PLACES_LANGUAGES = new Set(["zh-TW", "en"]);

function parsePlacesLanguage(value) {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_PLACES_LANGUAGE;
  }

  if (SUPPORTED_PLACES_LANGUAGES.has(value)) {
    return value;
  }

  const error = new Error("languageCode must be zh-TW or en.");
  error.statusCode = 400;
  error.code = "INVALID_LANGUAGE_CODE";
  error.publicMessage = error.message;
  throw error;
}

module.exports = { DEFAULT_PLACES_LANGUAGE, parsePlacesLanguage };
