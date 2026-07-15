const { buildRestaurantKey, dedupeRestaurants, hasKnownRating } = require("./diversity");
const { getSearchGroupOrder, SEARCH_GROUPS, MEAL_MODE_LATE_NIGHT } = require("./foodTypes");

const SEARCH_GROUP_ORDER = getSearchGroupOrder(MEAL_MODE_LATE_NIGHT);
const NIGHT_PRICE_CAP_TWD = 500;

const EXCLUDED_TYPES = new Set([
  "fine_dining_restaurant",
  "steak_house",
  "buffet_restaurant",
  "hot_pot_restaurant",
  "barbecue_restaurant",
  "korean_barbecue_restaurant",
  "mongolian_barbecue_restaurant",
  "yakiniku_restaurant",
  "bakery",
  "cake_shop",
  "pastry_shop",
  "dessert_restaurant",
  "dessert_shop",
  "donut_shop",
  "ice_cream_shop",
  "confectionery"
]);

const EXCLUDED_NAME_PATTERN = /(蛋糕|甜點|甜品|烘焙|麵包|糕餅|西點|牛排|排餐|火鍋|鍋物|涮涮鍋|燒肉|烤肉|吃到飽)/i;
const FRIED_NAME_PATTERN = /(炸|鹹酥|鹽酥|雞排|雞翅|甜不辣|地瓜球|炸物)/i;
const BRAISED_NAME_PATTERN = /(滷味|冷滷|鹽水雞|鹹水雞|東山鴨頭|麻辣燙|麻辣拌|加熱滷味|辣脆腸)/i;
const STINKY_TOFU_NAME_PATTERN = /(臭豆腐|麻辣臭豆腐)/i;
const NOODLE_NAME_PATTERN = /(麵|拉麵|烏龍|米粉|冬粉|河粉|粄條|湯)/i;
const RICE_NAME_PATTERN = /(爌肉飯|焢肉飯|控肉飯|滷肉飯|魯肉飯|肉燥飯|雞肉飯|火雞肉飯|炒飯|燴飯|蓋飯|丼飯)/i;
const COOKED_FOOD_NAME_PATTERN = /(熱炒|快炒|熟食|小炒|宵夜|消夜|食堂|酒場|串燒)/i;

const FRIED_TYPES = new Set(["chicken_restaurant", "chicken_wings_restaurant"]);
const NOODLE_TYPES = new Set(["noodle_shop", "chinese_noodle_restaurant", "ramen_restaurant", "soup_restaurant"]);
const COOKED_FOOD_TYPES = new Set(["deli", "food_store", "japanese_izakaya_restaurant", "yakitori_restaurant"]);
const HIGH_PRICE_LEVELS = new Set(["PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"]);

function filterLateNightRestaurants(restaurants) {
  const matched = restaurants.filter((restaurant) => {
    if (!hasKnownRating(restaurant)) return false;
    const types = getTypes(restaurant);
    if ([...EXCLUDED_TYPES].some((type) => types.has(type))) return false;
    if (EXCLUDED_NAME_PATTERN.test(restaurant.name || "")) return false;
    if (isKnownHighPrice(restaurant)) return false;
    if (restaurant.lateNightStatus === "early") return false;
    if (!matchesSearchGroup(restaurant, types)) return false;
    return true;
  });

  return dedupeRestaurants(matched);
}

function diversifyLateNightRestaurants(restaurants, options = {}) {
  const recommendationCount = Number.isFinite(options.recommendationCount)
    ? options.recommendationCount
    : 20;
  const requestedGroups = Array.isArray(options.selectedSearchGroups)
    ? options.selectedSearchGroups
    : SEARCH_GROUP_ORDER;
  const selectedGroups = SEARCH_GROUP_ORDER.filter((group) => requestedGroups.includes(group));
  const groups = Object.fromEntries(selectedGroups.map((group) => [group, []]));

  filterLateNightRestaurants(restaurants).forEach((restaurant) => {
    const group = categorizeLateNightRestaurant(restaurant);
    if (!groups[group]) return;
    groups[group].push({
      ...restaurant,
      category: group,
      categoryLabel: SEARCH_GROUPS[group].label
    });
  });

  selectedGroups.forEach((group) => groups[group].sort(compareLateNightRestaurants));

  const result = [];
  let friedCount = 0;
  const friedCap = selectedGroups.length === 1 && selectedGroups[0] === "friedNight"
    ? recommendationCount
    : Math.ceil(recommendationCount / Math.max(selectedGroups.length, 1));

  while (result.length < recommendationCount) {
    let added = false;
    selectedGroups.forEach((group) => {
      if (result.length >= recommendationCount) return;
      if (group === "friedNight" && friedCount >= friedCap) return;
      const next = groups[group].shift();
      if (!next) return;
      result.push(next);
      if (group === "friedNight") friedCount += 1;
      added = true;
    });
    if (!added) break;
  }
  return result;
}

function categorizeLateNightRestaurant(restaurant) {
  const name = restaurant.name || "";
  const types = getTypes(restaurant);

  if (BRAISED_NAME_PATTERN.test(name)) return "braisedNight";
  if (RICE_NAME_PATTERN.test(name)) return "nightRice";
  if (NOODLE_NAME_PATTERN.test(name) || hasAnyType(types, NOODLE_TYPES)) return "nightNoodles";
  if (FRIED_NAME_PATTERN.test(name) || hasAnyType(types, FRIED_TYPES)) return "friedNight";
  if (COOKED_FOOD_NAME_PATTERN.test(name) || hasAnyType(types, COOKED_FOOD_TYPES)) return "cookedFood";
  if (STINKY_TOFU_NAME_PATTERN.test(name)) return "lateSnacks";
  return "lateSnacks";
}

function deriveLateNightHours(place, now = new Date()) {
  const openingHours = place.currentOpeningHours;
  if (!openingHours || !Array.isArray(openingHours.periods) || !openingHours.periods.length) {
    return { lateNightStatus: "unknown", lateCloseTime: null, lateNightAllNight: false };
  }

  const local = getLocalDateParts(now, place.timeZone && place.timeZone.id);
  const isLateNightNow = local.hour >= 20 || local.hour < 6;
  if (isLateNightNow && openingHours.openNow === true) {
    const nextCloseTime = formatTimestampTime(openingHours.nextCloseTime, place.timeZone && place.timeZone.id);
    return {
      lateNightStatus: "verified",
      lateCloseTime: nextCloseTime,
      lateNightAllNight: !openingHours.nextCloseTime
    };
  }

  const latePeriod = openingHours.periods.find((period) => isLatePeriodForToday(period, local));
  if (!latePeriod) {
    return { lateNightStatus: "early", lateCloseTime: null, lateNightAllNight: false };
  }

  if (!latePeriod.close) {
    return { lateNightStatus: "verified", lateCloseTime: null, lateNightAllNight: true };
  }

  return {
    lateNightStatus: "verified",
    lateCloseTime: formatPointTime(latePeriod.close),
    lateNightAllNight: false
  };
}

function isLatePeriodForToday(period, local) {
  if (!period || !period.open) return false;
  if (!isPointOnLocalDate(period.open, local)) return false;
  if (!period.close) return true;
  if (!isSamePointDate(period.open, period.close)) return true;
  return Number(period.close.hour || 0) >= 23;
}

function isPointOnLocalDate(point, local) {
  if (point.date) {
    return Number(point.date.year) === local.year
      && Number(point.date.month) === local.month
      && Number(point.date.day) === local.day;
  }
  return Number(point.day) === local.weekday;
}

function isSamePointDate(first, second) {
  if (first.date && second.date) {
    return Number(first.date.year) === Number(second.date.year)
      && Number(first.date.month) === Number(second.date.month)
      && Number(first.date.day) === Number(second.date.day);
  }
  return Number(first.day) === Number(second.day);
}

function getLocalDateParts(date, timeZone) {
  const options = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
    weekday: "short"
  };
  if (timeZone) options.timeZone = timeZone;

  let formatter;
  try {
    formatter = new Intl.DateTimeFormat("en-US", options);
  } catch {
    delete options.timeZone;
    formatter = new Intl.DateTimeFormat("en-US", options);
  }
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    weekday: weekdays[parts.weekday]
  };
}

function formatTimestampTime(value, timeZone) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const options = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
  if (timeZone) options.timeZone = timeZone;
  try {
    return new Intl.DateTimeFormat("en-GB", options).format(date);
  } catch {
    delete options.timeZone;
    return new Intl.DateTimeFormat("en-GB", options).format(date);
  }
}

function formatPointTime(point) {
  return `${String(Number(point.hour || 0)).padStart(2, "0")}:${String(Number(point.minute || 0)).padStart(2, "0")}`;
}

function matchesSearchGroup(restaurant, types = getTypes(restaurant)) {
  const name = restaurant.name || "";
  switch (restaurant.searchGroup) {
    case "friedNight":
      return hasAnyType(types, FRIED_TYPES) || FRIED_NAME_PATTERN.test(name);
    case "braisedNight":
      return BRAISED_NAME_PATTERN.test(name) || STINKY_TOFU_NAME_PATTERN.test(name);
    case "nightNoodles":
      return hasAnyType(types, NOODLE_TYPES) || NOODLE_NAME_PATTERN.test(name);
    case "nightRice":
      return RICE_NAME_PATTERN.test(name);
    case "cookedFood":
      return hasAnyType(types, COOKED_FOOD_TYPES) || COOKED_FOOD_NAME_PATTERN.test(name)
        || types.has("taiwanese_restaurant") || types.has("chinese_restaurant");
    case "lateSnacks":
      return true;
    default:
      return false;
  }
}

function isKnownHighPrice(restaurant) {
  const range = restaurant.priceRange;
  if (range && (!range.currencyCode || range.currencyCode === "TWD") && range.startAmount !== null) {
    return range.startAmount > NIGHT_PRICE_CAP_TWD;
  }
  return HIGH_PRICE_LEVELS.has(restaurant.priceLevel);
}

function compareLateNightRestaurants(a, b) {
  const statusDifference = statusRank(a.lateNightStatus) - statusRank(b.lateNightStatus);
  if (statusDifference !== 0) return statusDifference;
  const distanceDifference = finiteDistance(a.distanceMeters) - finiteDistance(b.distanceMeters);
  if (distanceDifference !== 0) return distanceDifference;
  return Number(b.rating || 0) - Number(a.rating || 0);
}

function statusRank(status) {
  return status === "verified" ? 0 : 1;
}

function finiteDistance(value) {
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function getTypes(restaurant) {
  return new Set([restaurant.primaryType, ...(Array.isArray(restaurant.types) ? restaurant.types : [])].filter(Boolean));
}

function hasAnyType(types, targets) {
  return [...targets].some((type) => types.has(type));
}

module.exports = {
  NIGHT_PRICE_CAP_TWD,
  EXCLUDED_TYPES,
  EXCLUDED_NAME_PATTERN,
  BRAISED_NAME_PATTERN,
  STINKY_TOFU_NAME_PATTERN,
  RICE_NAME_PATTERN,
  filterLateNightRestaurants,
  diversifyLateNightRestaurants,
  categorizeLateNightRestaurant,
  deriveLateNightHours,
  isKnownHighPrice,
  matchesSearchGroup,
  buildRestaurantKey
};
