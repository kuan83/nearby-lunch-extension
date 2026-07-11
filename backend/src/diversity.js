const CATEGORY_ORDER = [
  "healthy",
  "noodle-rice",
  "asian",
  "takeout-fast",
  "coffee-light",
  "other"
];

const CATEGORY_LABELS = {
  healthy: "健康輕食",
  "noodle-rice": "麵飯便當",
  asian: "亞洲料理",
  "takeout-fast": "小吃外帶",
  "coffee-light": "咖啡烘焙",
  other: "其他"
};

const HEALTHY_TYPES = new Set([
  "health_food_store",
  "salad_shop",
  "vegan_restaurant",
  "vegetarian_restaurant"
]);

const NOODLE_RICE_TYPES = new Set([
  "noodle_shop",
  "chinese_noodle_restaurant",
  "ramen_restaurant",
  "dumpling_restaurant",
  "taiwanese_restaurant"
]);

const ASIAN_TYPES = new Set([
  "asian_restaurant",
  "asian_fusion_restaurant",
  "chinese_restaurant",
  "cantonese_restaurant",
  "dim_sum_restaurant",
  "japanese_restaurant",
  "japanese_curry_restaurant",
  "sushi_restaurant",
  "korean_restaurant",
  "korean_barbecue_restaurant",
  "thai_restaurant",
  "vietnamese_restaurant",
  "indian_restaurant",
  "indonesian_restaurant",
  "malaysian_restaurant"
]);

const TAKEOUT_FAST_TYPES = new Set([
  "meal_takeaway",
  "meal_delivery",
  "food_delivery",
  "fast_food_restaurant",
  "food_court",
  "sandwich_shop",
  "pizza_restaurant",
  "hamburger_restaurant",
  "chicken_restaurant",
  "deli"
]);

const COFFEE_LIGHT_TYPES = new Set([
  "cafe",
  "coffee_shop",
  "coffee_stand",
  "tea_house",
  "juice_shop",
  "bakery",
  "bagel_shop",
  "dessert_restaurant",
  "dessert_shop"
]);

const HEALTHY_NAME_PATTERN = /(健康|健身|餐盒|沙拉|低卡|低脂|水煮|舒肥|輕食|蔬食|素食|vegan|vegetarian|salad|healthy|fitness|bento|poke)/i;
const NOODLE_RICE_NAME_PATTERN = /(麵店|拉麵|牛肉麵|乾麵|湯麵|飯|粥|餃|鍋貼|滷肉|雞肉飯|爌肉飯|便當|飯糰|丼飯|咖哩飯|noodle|rice|ramen|dumpling)/i;

function buildRestaurantKey(restaurant) {
  if (restaurant.id) {
    return String(restaurant.id);
  }

  return `${restaurant.name || ""}|${restaurant.address || ""}`.toLowerCase();
}

function dedupeRestaurants(restaurants) {
  const seen = new Set();
  const result = [];

  restaurants.forEach((restaurant) => {
    const key = buildRestaurantKey(restaurant);
    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(restaurant);
  });

  return result;
}

function categorizeRestaurant(restaurant) {
  const types = new Set([
    restaurant.primaryType,
    ...(Array.isArray(restaurant.types) ? restaurant.types : [])
  ].filter(Boolean));
  const name = restaurant.name || "";

  if (hasAnyType(types, HEALTHY_TYPES) || HEALTHY_NAME_PATTERN.test(name)) {
    return "healthy";
  }

  if (hasAnyType(types, NOODLE_RICE_TYPES) || NOODLE_RICE_NAME_PATTERN.test(name)) {
    return "noodle-rice";
  }

  if (hasAnyType(types, ASIAN_TYPES)) {
    return "asian";
  }

  if (hasAnyType(types, TAKEOUT_FAST_TYPES)) {
    return "takeout-fast";
  }

  if (hasAnyType(types, COFFEE_LIGHT_TYPES)) {
    return "coffee-light";
  }

  return "other";
}

function diversifyRestaurants(restaurants) {
  const groups = Object.fromEntries(CATEGORY_ORDER.map((category) => [category, []]));

  dedupeRestaurants(restaurants).forEach((restaurant) => {
    const category = categorizeRestaurant(restaurant);
    groups[category].push({
      ...restaurant,
      category,
      categoryLabel: CATEGORY_LABELS[category]
    });
  });

  CATEGORY_ORDER.forEach((category) => {
    groups[category] = shuffle(groups[category]);
  });

  const result = [];
  while (Object.values(groups).some((items) => items.length)) {
    CATEGORY_ORDER.forEach((category) => {
      const next = groups[category].shift();
      if (next) {
        result.push(next);
      }
    });
  }

  return result;
}

function hasAnyType(types, targetTypes) {
  return [...targetTypes].some((type) => types.has(type));
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

module.exports = {
  buildRestaurantKey,
  categorizeRestaurant,
  dedupeRestaurants,
  diversifyRestaurants,
  CATEGORY_LABELS
};
