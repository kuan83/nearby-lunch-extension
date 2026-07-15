const MEAL_MODE_LUNCH = "lunch";
const MEAL_MODE_LATE_NIGHT = "lateNight";

const FOOD_TYPE_OPTIONS = {
  lunch: {
    noodles: { label: "Noodles and rice", searchGroups: ["noodleRice"] },
    bento: { label: "Bento and lunch boxes", searchGroups: ["bentoHealthy"] },
    healthy: { label: "Healthy and vegetarian", searchGroups: ["bentoHealthy"] },
    southeast: { label: "Southeast Asian", searchGroups: ["southeastAsian"] },
    asian: { label: "Asian everyday", searchGroups: ["asianEveryday"] },
    international: { label: "International everyday", searchGroups: ["internationalEveryday"] }
  },
  lateNight: {
    fried: { label: "Fried snacks", searchGroups: ["friedNight"] },
    braised: { label: "Braised snacks", searchGroups: ["braisedNight"] },
    lateSnacks: { label: "Late-night snacks", searchGroups: ["lateSnacks"] },
    nightNoodles: { label: "Night noodles", searchGroups: ["nightNoodles"] },
    nightRice: { label: "Night rice", searchGroups: ["nightRice"] },
    cookedFood: { label: "Cooked food", searchGroups: ["cookedFood"] }
  }
};

const SEARCH_GROUPS = {
  noodleRice: {
    mealMode: MEAL_MODE_LUNCH,
    label: "Noodles and rice",
    includedTypes: ["noodle_shop", "chinese_noodle_restaurant", "ramen_restaurant", "dumpling_restaurant", "taiwanese_restaurant"]
  },
  bentoHealthy: {
    mealMode: MEAL_MODE_LUNCH,
    label: "Bento and healthy",
    includedTypes: ["meal_takeaway", "cafeteria", "health_food_store", "salad_shop", "vegetarian_restaurant", "vegan_restaurant", "sandwich_shop"]
  },
  southeastAsian: {
    mealMode: MEAL_MODE_LUNCH,
    label: "Southeast Asian",
    includedTypes: ["vietnamese_restaurant", "thai_restaurant", "indonesian_restaurant", "malaysian_restaurant"]
  },
  asianEveryday: {
    mealMode: MEAL_MODE_LUNCH,
    label: "Asian everyday",
    includedTypes: ["chinese_restaurant", "japanese_restaurant", "japanese_curry_restaurant", "korean_restaurant", "indian_restaurant"]
  },
  internationalEveryday: {
    mealMode: MEAL_MODE_LUNCH,
    label: "International everyday",
    includedTypes: ["italian_restaurant", "mediterranean_restaurant", "mexican_restaurant", "pizza_restaurant"]
  },
  friedNight: {
    mealMode: MEAL_MODE_LATE_NIGHT,
    label: "Fried snacks",
    searchMethod: "text",
    textQuery: "鹽酥雞 雞排 炸物",
    includedTypes: ["chicken_restaurant", "chicken_wings_restaurant", "fast_food_restaurant", "snack_bar", "meal_takeaway"]
  },
  braisedNight: {
    mealMode: MEAL_MODE_LATE_NIGHT,
    label: "Braised snacks",
    searchMethod: "text",
    textQuery: "滷味 鹽水雞 麻辣燙",
    includedTypes: ["snack_bar", "meal_takeaway", "taiwanese_restaurant", "food_store"]
  },
  lateSnacks: {
    mealMode: MEAL_MODE_LATE_NIGHT,
    label: "Late-night snacks",
    searchMethod: "text",
    textQuery: "臭豆腐 深夜小吃",
    includedTypes: ["snack_bar", "meal_takeaway", "diner", "food_court", "taiwanese_restaurant"]
  },
  nightNoodles: {
    mealMode: MEAL_MODE_LATE_NIGHT,
    label: "Night noodles",
    includedTypes: ["noodle_shop", "chinese_noodle_restaurant", "ramen_restaurant", "soup_restaurant"]
  },
  nightRice: {
    mealMode: MEAL_MODE_LATE_NIGHT,
    label: "Night rice",
    searchMethod: "text",
    textQuery: "爌肉飯 滷肉飯 肉燥飯 雞肉飯 丼飯",
    includedTypes: ["taiwanese_restaurant", "meal_takeaway", "cafeteria", "chinese_restaurant"]
  },
  cookedFood: {
    mealMode: MEAL_MODE_LATE_NIGHT,
    label: "Cooked food",
    includedTypes: ["deli", "food_store", "taiwanese_restaurant", "chinese_restaurant", "japanese_izakaya_restaurant", "yakitori_restaurant"]
  }
};

const FOOD_TYPE_ORDER = Object.fromEntries(
  Object.entries(FOOD_TYPE_OPTIONS).map(([mealMode, options]) => [mealMode, Object.keys(options)])
);

const SEARCH_GROUP_ORDER = Object.fromEntries(
  [MEAL_MODE_LUNCH, MEAL_MODE_LATE_NIGHT].map((mealMode) => [
    mealMode,
    Object.entries(SEARCH_GROUPS)
      .filter(([, group]) => group.mealMode === mealMode)
      .map(([key]) => key)
  ])
);

function parseMealMode(value) {
  const mealMode = value || MEAL_MODE_LUNCH;
  if (!Object.prototype.hasOwnProperty.call(FOOD_TYPE_OPTIONS, mealMode)) {
    const error = new Error("mealMode must be one of lunch or lateNight.");
    error.statusCode = 400;
    error.code = "INVALID_MEAL_MODE";
    error.publicMessage = error.message;
    throw error;
  }
  return mealMode;
}

function parseFoodTypes(value, mealMode = MEAL_MODE_LUNCH) {
  const options = FOOD_TYPE_OPTIONS[mealMode];
  const foodTypeOrder = FOOD_TYPE_ORDER[mealMode];
  const searchGroupOrder = SEARCH_GROUP_ORDER[mealMode];
  const rawFoodTypes = Array.isArray(value) ? value.join(",") : value;
  const requested = rawFoodTypes
    ? rawFoodTypes.split(",").map((item) => item.trim()).filter(Boolean)
    : foodTypeOrder;
  const uniqueFoodTypes = [...new Set(requested)];
  const invalidFoodTypes = uniqueFoodTypes.filter(
    (foodType) => !Object.prototype.hasOwnProperty.call(options, foodType)
  );

  if (invalidFoodTypes.length) {
    const error = new Error(`foodTypes contains invalid value(s) for ${mealMode}: ${invalidFoodTypes.join(", ")}.`);
    error.statusCode = 400;
    error.code = "INVALID_FOOD_TYPES";
    error.publicMessage = error.message;
    throw error;
  }

  const selectedFoodTypes = uniqueFoodTypes.length
    ? foodTypeOrder.filter((foodType) => uniqueFoodTypes.includes(foodType))
    : foodTypeOrder;
  const requestedGroups = selectedFoodTypes.flatMap((foodType) => options[foodType].searchGroups);
  const searchGroups = searchGroupOrder.filter((group) => requestedGroups.includes(group));

  return { selectedFoodTypes, foodTypesKey: selectedFoodTypes.join(","), searchGroups };
}

function getSearchGroupOrder(mealMode) {
  return SEARCH_GROUP_ORDER[mealMode] || [];
}

module.exports = {
  parseMealMode,
  parseFoodTypes,
  getSearchGroupOrder,
  FOOD_TYPE_OPTIONS,
  FOOD_TYPE_ORDER,
  SEARCH_GROUPS,
  SEARCH_GROUP_ORDER,
  MEAL_MODE_LUNCH,
  MEAL_MODE_LATE_NIGHT
};
