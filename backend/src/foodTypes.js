const FOOD_TYPE_OPTIONS = {
  noodles: { label: "麵飯小吃", searchGroups: ["noodleRice"] },
  bento: { label: "便當餐盒", searchGroups: ["bentoHealthy"] },
  healthy: { label: "健康蔬食", searchGroups: ["bentoHealthy"] },
  southeast: { label: "越南泰味", searchGroups: ["southeastAsian"] },
  asian: { label: "中日韓食", searchGroups: ["asianEveryday"] },
  international: { label: "義式異國", searchGroups: ["internationalEveryday"] }
};

const SEARCH_GROUPS = {
  noodleRice: {
    label: "麵飯小吃",
    includedTypes: ["noodle_shop", "chinese_noodle_restaurant", "ramen_restaurant", "dumpling_restaurant", "taiwanese_restaurant"]
  },
  bentoHealthy: {
    label: "便當健康",
    includedTypes: ["meal_takeaway", "cafeteria", "health_food_store", "salad_shop", "vegetarian_restaurant", "vegan_restaurant", "sandwich_shop"]
  },
  southeastAsian: {
    label: "越南泰味",
    includedTypes: ["vietnamese_restaurant", "thai_restaurant", "indonesian_restaurant", "malaysian_restaurant"]
  },
  asianEveryday: {
    label: "中日韓食",
    includedTypes: ["chinese_restaurant", "japanese_restaurant", "japanese_curry_restaurant", "korean_restaurant", "indian_restaurant"]
  },
  internationalEveryday: {
    label: "義式異國",
    includedTypes: ["italian_restaurant", "mediterranean_restaurant", "mexican_restaurant", "pizza_restaurant"]
  }
};

const FOOD_TYPE_ORDER = Object.keys(FOOD_TYPE_OPTIONS);
const SEARCH_GROUP_ORDER = Object.keys(SEARCH_GROUPS);
const DEFAULT_FOOD_TYPES = FOOD_TYPE_ORDER;

function parseFoodTypes(value) {
  const rawFoodTypes = Array.isArray(value) ? value.join(",") : value;
  const requested = rawFoodTypes
    ? rawFoodTypes.split(",").map((item) => item.trim()).filter(Boolean)
    : DEFAULT_FOOD_TYPES;
  const uniqueFoodTypes = [...new Set(requested)];
  const invalidFoodTypes = uniqueFoodTypes.filter(
    (foodType) => !Object.prototype.hasOwnProperty.call(FOOD_TYPE_OPTIONS, foodType)
  );

  if (invalidFoodTypes.length) {
    const error = new Error(`foodTypes contains invalid value(s): ${invalidFoodTypes.join(", ")}.`);
    error.statusCode = 400;
    error.code = "INVALID_FOOD_TYPES";
    error.publicMessage = error.message;
    throw error;
  }

  const selectedFoodTypes = uniqueFoodTypes.length
    ? FOOD_TYPE_ORDER.filter((foodType) => uniqueFoodTypes.includes(foodType))
    : DEFAULT_FOOD_TYPES;
  const requestedGroups = selectedFoodTypes.flatMap((foodType) => FOOD_TYPE_OPTIONS[foodType].searchGroups);
  const searchGroups = SEARCH_GROUP_ORDER.filter((group) => requestedGroups.includes(group));

  return { selectedFoodTypes, foodTypesKey: selectedFoodTypes.join(","), searchGroups };
}

module.exports = {
  parseFoodTypes,
  FOOD_TYPE_OPTIONS,
  FOOD_TYPE_ORDER,
  DEFAULT_FOOD_TYPES,
  SEARCH_GROUPS,
  SEARCH_GROUP_ORDER
};
