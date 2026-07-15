const test = require("node:test");
const assert = require("node:assert/strict");
const {
  deriveLateNightHours,
  filterLateNightRestaurants,
  diversifyLateNightRestaurants
} = require("../src/lateNight");

const NOW = new Date("2026-07-13T10:00:00.000Z"); // 18:00 in Asia/Taipei.

test("late-night hours recognize same-day, overnight, all-night, early, and unknown schedules", () => {
  assert.deepEqual(
    deriveLateNightHours(placeWithHours(period(13, 18, 13, 23, 30)), NOW),
    { lateNightStatus: "verified", lateCloseTime: "23:30", lateNightAllNight: false }
  );
  assert.deepEqual(
    deriveLateNightHours(placeWithHours(period(13, 20, 14, 2, 0)), NOW),
    { lateNightStatus: "verified", lateCloseTime: "02:00", lateNightAllNight: false }
  );
  assert.deepEqual(
    deriveLateNightHours(placeWithHours({ open: point(13, 0) }), NOW),
    { lateNightStatus: "verified", lateCloseTime: null, lateNightAllNight: true }
  );
  assert.equal(deriveLateNightHours(placeWithHours(period(13, 18, 13, 21, 0)), NOW).lateNightStatus, "early");
  assert.equal(deriveLateNightHours({}, NOW).lateNightStatus, "unknown");
});

test("current open businesses qualify during actual late-night hours", () => {
  const place = placeWithHours(period(13, 20, 14, 2, 0));
  place.currentOpeningHours.openNow = true;
  place.currentOpeningHours.nextCloseTime = "2026-07-13T18:00:00.000Z";
  const result = deriveLateNightHours(place, new Date("2026-07-13T15:00:00.000Z")); // 23:00 Taipei.
  assert.equal(result.lateNightStatus, "verified");
  assert.equal(result.lateCloseTime, "02:00");
});

test("late-night filtering keeps precise affordable choices and removes early, high-price, and pastry results", () => {
  const candidates = [
    restaurant({ id: "braised", name: "阿明滷味", searchGroup: "braisedNight" }),
    restaurant({ id: "tofu", name: "御國香麻辣臭豆腐", searchGroup: "braisedNight" }),
    restaurant({ id: "rice", name: "老店爌肉飯", searchGroup: "nightRice" }),
    restaurant({ id: "unknown-price", name: "深夜小吃", searchGroup: "lateSnacks", priceRange: null }),
    restaurant({ id: "cross-range", name: "夜貓食堂", searchGroup: "lateSnacks", priceRange: price(400, 600) }),
    restaurant({ id: "high", name: "高價食堂", searchGroup: "lateSnacks", priceRange: price(600, 900) }),
    restaurant({ id: "pastry", name: "深夜烘焙", searchGroup: "lateSnacks", types: ["bakery"] }),
    restaurant({ id: "early", name: "晚間小吃", searchGroup: "lateSnacks", lateNightStatus: "early" }),
    restaurant({ id: "wrong-braised", name: "一般餐廳", searchGroup: "braisedNight" })
  ];

  const result = filterLateNightRestaurants(candidates);
  assert.deepEqual(result.map((item) => item.id), ["braised", "tofu", "rice", "unknown-price", "cross-range"]);
});

test("late-night diversity rotates search groups and prioritizes verified hours", () => {
  const candidates = [
    restaurant({ id: "snack-unknown", name: "甲小吃", searchGroup: "lateSnacks", lateNightStatus: "unknown", distanceMeters: 20 }),
    restaurant({ id: "snack-verified", name: "乙小吃", searchGroup: "lateSnacks", distanceMeters: 100 }),
    restaurant({ id: "noodle", name: "深夜拉麵", searchGroup: "nightNoodles", types: ["ramen_restaurant"], distanceMeters: 50 })
  ];
  const result = diversifyLateNightRestaurants(candidates);
  assert.deepEqual(result.map((item) => item.id), ["snack-verified", "noodle", "snack-unknown"]);
});

test("reported Wuri fried, braised, tofu, and rice shops survive late-night filtering", () => {
  const candidates = [
    restaurant({ id: "wei-xin", name: "維新鹽酥雞—烏日店 wei xin fried chicken", searchGroup: "friedNight" }),
    restaurant({ id: "kobayashi", name: "小林鹽酥雞", searchGroup: "friedNight" }),
    restaurant({ id: "beggar", name: "丐幫滷味烏日分舵", searchGroup: "braisedNight" }),
    restaurant({ id: "chen", name: "陳記1358辣脆腸 滷味 烏日店", searchGroup: "braisedNight" }),
    restaurant({ id: "tofu", name: "御國香 麻辣臭豆腐-台中烏日店", searchGroup: "lateSnacks" }),
    restaurant({ id: "hungry", name: "餓了 (台式丼飯) 南屯店", searchGroup: "nightRice" })
  ];

  assert.deepEqual(
    filterLateNightRestaurants(candidates).map((item) => item.id),
    ["wei-xin", "kobayashi", "beggar", "chen", "tofu", "hungry"]
  );
});

function placeWithHours(...periods) {
  return {
    timeZone: { id: "Asia/Taipei" },
    currentOpeningHours: { periods }
  };
}

function period(openDay, openHour, closeDay, closeHour, closeMinute) {
  return {
    open: point(openDay, openHour),
    close: point(closeDay, closeHour, closeMinute)
  };
}

function point(day, hour, minute = 0) {
  return {
    date: { year: 2026, month: 7, day },
    day: new Date(Date.UTC(2026, 6, day)).getUTCDay(),
    hour,
    minute
  };
}

function price(startAmount, endAmount) {
  return { startAmount, endAmount, currencyCode: "TWD" };
}

function restaurant(overrides = {}) {
  return {
    id: overrides.id,
    name: overrides.name || "夜間店家",
    searchGroup: overrides.searchGroup || "lateSnacks",
    primaryType: overrides.primaryType || null,
    types: overrides.types || ["meal_takeaway"],
    rating: overrides.rating ?? 4.2,
    distanceMeters: overrides.distanceMeters ?? 100,
    priceLevel: overrides.priceLevel || null,
    priceRange: Object.prototype.hasOwnProperty.call(overrides, "priceRange") ? overrides.priceRange : price(100, 300),
    lateNightStatus: overrides.lateNightStatus || "verified",
    lateCloseTime: "01:00",
    lateNightAllNight: false
  };
}
