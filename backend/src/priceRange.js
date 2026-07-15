const PRICE_RANGES = {
  all: {
    label: "不限",
    min: null,
    max: null
  },
  "1_100": {
    label: "1-100",
    min: 1,
    max: 100
  },
  "101_500": {
    label: "101-500",
    min: 101,
    max: 500
  },
  "501_1000": {
    label: "501-1000",
    min: 501,
    max: 1000
  },
  "1001_2000": {
    label: "1001-2000",
    min: 1001,
    max: 2000
  },
  "2000_up": {
    label: "2000以上",
    min: 2000,
    max: Infinity
  }
};

function parsePriceRange(value) {
  const priceRange = value || "all";

  if (!Object.prototype.hasOwnProperty.call(PRICE_RANGES, priceRange)) {
    const error = new Error("priceRange must be one of all, 1_100, 101_500, 501_1000, 1001_2000, 2000_up.");
    error.statusCode = 400;
    error.code = "INVALID_PRICE_RANGE";
    error.publicMessage = error.message;
    throw error;
  }

  return priceRange;
}

function validatePriceRangeForMealMode(priceRange, mealMode) {
  if (mealMode === "lateNight" && !["all", "1_100", "101_500"].includes(priceRange)) {
    const error = new Error("lateNight priceRange must be one of all, 1_100, or 101_500.");
    error.statusCode = 400;
    error.code = "INVALID_PRICE_RANGE_FOR_MODE";
    error.publicMessage = error.message;
    throw error;
  }
  return priceRange;
}

function filterByPriceRange(restaurants, priceRange) {
  const range = PRICE_RANGES[priceRange];
  if (!range || priceRange === "all") {
    return restaurants;
  }

  return restaurants.filter(
    (restaurant) => !restaurant.priceRange || rangesOverlap(restaurant.priceRange, range)
  );
}

function normalizePriceRange(priceRange) {
  if (!priceRange || typeof priceRange !== "object") {
    return null;
  }

  const startAmount = moneyToAmount(priceRange.startPrice || priceRange.startAmount || priceRange.minPrice);
  const endAmount = moneyToAmount(priceRange.endPrice || priceRange.endAmount || priceRange.maxPrice);
  const currencyCode = getCurrencyCode(priceRange);

  if (startAmount === null && endAmount === null) {
    return null;
  }

  return {
    startAmount,
    endAmount,
    currencyCode
  };
}

function getPriceRangeLabel(priceRange) {
  if (!priceRange) {
    return "價格未知";
  }

  const suffix = priceRange.currencyCode && priceRange.currencyCode !== "TWD"
    ? ` ${priceRange.currencyCode}`
    : "";

  if (priceRange.startAmount !== null && priceRange.endAmount !== null) {
    return `${formatAmount(priceRange.startAmount)}-${formatAmount(priceRange.endAmount)}${suffix}`;
  }

  if (priceRange.startAmount !== null) {
    return `${formatAmount(priceRange.startAmount)}以上${suffix}`;
  }

  return `${formatAmount(priceRange.endAmount)}以下${suffix}`;
}

function rangesOverlap(priceRange, targetRange) {
  if (!priceRange) {
    return false;
  }

  const placeMin = priceRange.startAmount ?? 0;
  const placeMax = priceRange.endAmount ?? Infinity;
  const targetMin = targetRange.min;
  const targetMax = targetRange.max;

  return placeMin <= targetMax && placeMax >= targetMin;
}

function moneyToAmount(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : null;
  }

  if (typeof value === "string") {
    const amount = Number(value);
    return Number.isFinite(amount) ? Math.round(amount) : null;
  }

  if (typeof value !== "object") {
    return null;
  }

  const units = Number(value.units || 0);
  const nanos = Number(value.nanos || 0);
  const amount = units + nanos / 1_000_000_000;

  return Number.isFinite(amount) ? Math.round(amount) : null;
}

function getCurrencyCode(priceRange) {
  return (
    priceRange.currencyCode ||
    (priceRange.startPrice && priceRange.startPrice.currencyCode) ||
    (priceRange.endPrice && priceRange.endPrice.currencyCode) ||
    null
  );
}

function formatAmount(amount) {
  return Number(amount).toLocaleString("zh-TW", {
    maximumFractionDigits: 0
  });
}

module.exports = {
  parsePriceRange,
  validatePriceRangeForMealMode,
  filterByPriceRange,
  normalizePriceRange,
  getPriceRangeLabel,
  PRICE_RANGES
};
