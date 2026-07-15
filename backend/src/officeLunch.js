const { buildRestaurantKey, dedupeRestaurants, hasKnownRating } = require("./diversity");
const { getSearchGroupOrder, SEARCH_GROUPS, MEAL_MODE_LUNCH } = require("./foodTypes");

const SEARCH_GROUP_ORDER = getSearchGroupOrder(MEAL_MODE_LUNCH);

const EXCLUDED_TYPES = new Set([
  "steak_house",
  "barbecue_restaurant",
  "korean_barbecue_restaurant",
  "hot_pot_restaurant",
  "buffet_restaurant",
  "bakery",
  "dessert_restaurant",
  "dessert_shop",
  "donut_shop",
  "ice_cream_shop",
  "confectionery",
  "chicken_restaurant"
]);

const EXCLUDED_NAME_PATTERN = /(火鍋|鍋物|涮涮鍋|麻辣鍋|燒肉|烤肉|吃到飽|牛排|排餐|鐵板燒|炸雞|雞排|蛋糕|甜點|烘焙|麵包|糕餅)/i;
const DAILY_LUNCH_PATTERN = /(便當|餐盒|河粉|拉麵|麵|飯|粥|水餃|餃子|鍋貼|小吃|素食|蔬食|沙拉|義大利麵|咖哩|丼|越南|泰式|米線|米粉|肉圓|滷味|湯)/i;

function filterOfficeLunchRestaurants(restaurants) {
  return dedupeRestaurants(restaurants).filter((restaurant) => {
    if (!hasKnownRating(restaurant)) return false;
    const types = new Set([
      restaurant.primaryType,
      ...(Array.isArray(restaurant.types) ? restaurant.types : [])
    ].filter(Boolean));
    const hasExcludedType = [...EXCLUDED_TYPES].some((type) => types.has(type));
    return !hasExcludedType && !EXCLUDED_NAME_PATTERN.test(restaurant.name || "");
  });
}

function diversifyOfficeLunchRestaurants(restaurants) {
  const groups = Object.fromEntries(SEARCH_GROUP_ORDER.map((group) => [group, []]));

  filterOfficeLunchRestaurants(restaurants).forEach((restaurant) => {
    const group = groups[restaurant.searchGroup] ? restaurant.searchGroup : "noodleRice";
    groups[group].push({
      ...restaurant,
      category: group,
      categoryLabel: SEARCH_GROUPS[group].label,
      dailyLunchMatch: DAILY_LUNCH_PATTERN.test(restaurant.name || "")
    });
  });

  SEARCH_GROUP_ORDER.forEach((group) => {
    groups[group].sort(compareRestaurants);
  });

  const result = [];
  while (Object.values(groups).some((items) => items.length)) {
    SEARCH_GROUP_ORDER.forEach((group) => {
      const next = groups[group].shift();
      if (next) {
        result.push(next);
      }
    });
  }

  return result;
}

function compareRestaurants(a, b) {
  const distanceDifference = finiteDistance(a.distanceMeters) - finiteDistance(b.distanceMeters);
  if (distanceDifference !== 0) {
    return distanceDifference;
  }

  const ratingDifference = Number(b.rating || 0) - Number(a.rating || 0);
  if (ratingDifference !== 0) {
    return ratingDifference;
  }

  return Number(b.dailyLunchMatch) - Number(a.dailyLunchMatch);
}

function finiteDistance(value) {
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

module.exports = {
  EXCLUDED_TYPES,
  EXCLUDED_NAME_PATTERN,
  buildRestaurantKey,
  filterOfficeLunchRestaurants,
  diversifyOfficeLunchRestaurants
};
