const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseMealMode,
  parseFoodTypes,
  SEARCH_GROUPS
} = require("../src/foodTypes");
const {
  buildNearbySearchRequest,
  buildTextSearchRequest,
  GOOGLE_NEARBY_SEARCH_URL,
  GOOGLE_TEXT_SEARCH_URL
} = require("../src/googlePlaces");
const { validatePriceRangeForMealMode } = require("../src/priceRange");

test("mealMode defaults to lunch and validates supported values", () => {
  assert.equal(parseMealMode(), "lunch");
  assert.equal(parseMealMode("lateNight"), "lateNight");
  assert.throws(() => parseMealMode("dinner"), { code: "INVALID_MEAL_MODE" });
});

test("late-night food types map to six protected search groups", () => {
  const parsed = parseFoodTypes(undefined, "lateNight");
  assert.deepEqual(parsed.selectedFoodTypes, [
    "fried",
    "braised",
    "lateSnacks",
    "nightNoodles",
    "nightRice",
    "cookedFood"
  ]);
  assert.equal(parsed.searchGroups.length, 6);
  parsed.searchGroups.forEach((group) => {
    assert.equal(SEARCH_GROUPS[group].mealMode, "lateNight");
    assert.ok(SEARCH_GROUPS[group].includedTypes.length > 0);
    assert.ok(SEARCH_GROUPS[group].includedTypes.length <= 50);
  });
  assert.equal(parsed.searchGroups.filter((group) => SEARCH_GROUPS[group].searchMethod === "text").length, 4);
});

test("food types are validated within their meal mode", () => {
  assert.throws(() => parseFoodTypes("noodles", "lateNight"), { code: "INVALID_FOOD_TYPES" });
  assert.deepEqual(parseFoodTypes("braised,nightRice", "lateNight").searchGroups, ["braisedNight", "nightRice"]);
});

test("late-night mode rejects price ranges above 500", () => {
  assert.equal(validatePriceRangeForMealMode("all", "lateNight"), "all");
  assert.equal(validatePriceRangeForMealMode("101_500", "lateNight"), "101_500");
  assert.throws(
    () => validatePriceRangeForMealMode("501_1000", "lateNight"),
    { code: "INVALID_PRICE_RANGE_FOR_MODE" }
  );
});

test("late-night requests remain Nearby Search requests ranked by distance", () => {
  const request = buildNearbySearchRequest(24.1, 120.5, SEARCH_GROUPS.nightNoodles, 3000, "zh-TW");
  assert.equal(GOOGLE_NEARBY_SEARCH_URL, "https://places.googleapis.com/v1/places:searchNearby");
  assert.equal(request.rankPreference, "DISTANCE");
  assert.deepEqual(request.includedTypes, SEARCH_GROUPS.nightNoodles.includedTypes);
  assert.equal(Object.prototype.hasOwnProperty.call(request, "excludedTypes"), false);
});

test("name-driven late-night groups use distance-ranked Text Search within the radius", () => {
  const request = buildTextSearchRequest(24.1, 120.5, SEARCH_GROUPS.braisedNight, 3000, "zh-TW");
  assert.equal(GOOGLE_TEXT_SEARCH_URL, "https://places.googleapis.com/v1/places:searchText");
  assert.match(request.textQuery, /滷味/);
  assert.equal(request.rankPreference, "DISTANCE");
  assert.equal(request.pageSize, 20);
  assert.ok(request.locationRestriction.rectangle.low.latitude < 24.1);
  assert.ok(request.locationRestriction.rectangle.high.latitude > 24.1);
  assert.equal(Object.prototype.hasOwnProperty.call(request, "includedTypes"), false);
  assert.match(SEARCH_GROUPS.friedNight.textQuery, /鹽酥雞/);
  assert.match(SEARCH_GROUPS.lateSnacks.textQuery, /臭豆腐/);
  assert.match(SEARCH_GROUPS.nightRice.textQuery, /丼飯/);
});
