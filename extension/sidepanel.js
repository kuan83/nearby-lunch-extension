const API_BASE_URL = "https://localhost:3000";
const CLIENT_ID_KEY = "lunchClientId";
const TARGET_COUNT = 20;
const placesLanguage = getPlacesLanguage(chrome.i18n.getUILanguage());

const MEAL_MODES = {
  lunch: {
    titleMessage: "lunchTitle",
    toggleMessage: "switchToLateNight",
    toggleIcon: "☾",
    startMessage: "startLunch",
    promptMessage: "startPromptLunch",
    searchingMessage: "searchingLunch",
    rankingMessage: "rankingNoticeLunch",
    allowedPrices: ["all", "1_100", "101_500", "501_1000", "1001_2000", "2000_up"],
    foodTypes: [
      { value: "noodles", message: "foodNoodles" },
      { value: "bento", message: "foodBento" },
      { value: "healthy", message: "foodHealthy" },
      { value: "southeast", message: "foodSoutheast" },
      { value: "asian", message: "foodAsian" },
      { value: "international", message: "foodInternational" }
    ]
  },
  lateNight: {
    titleMessage: "lateNightTitle",
    toggleMessage: "switchToLunch",
    toggleIcon: "☀",
    startMessage: "startLateNight",
    promptMessage: "startPromptLateNight",
    searchingMessage: "searchingLateNight",
    rankingMessage: "rankingNoticeLateNight",
    allowedPrices: ["all", "1_100", "101_500"],
    foodTypes: [
      { value: "fried", message: "nightFoodFried" },
      { value: "braised", message: "nightFoodBraised" },
      { value: "lateSnacks", message: "nightFoodSnacks" },
      { value: "nightNoodles", message: "nightFoodNoodles" },
      { value: "nightRice", message: "nightFoodRice" },
      { value: "cookedFood", message: "nightFoodCooked" }
    ]
  }
};

const recommendButton = document.querySelector("#recommendButton");
const refreshButton = document.querySelector("#refreshButton");
const filterToggleButton = document.querySelector("#filterToggleButton");
const filterPanel = document.querySelector("#filterPanel");
const priceButtons = [...document.querySelectorAll(".price-option")];
const typeButtons = [...document.querySelectorAll(".type-option")];
const statusElement = document.querySelector("#status");
const metaStatusElement = document.querySelector("#metaStatus");
const resultsElement = document.querySelector("#results");
const backendNotice = document.querySelector("#backendNotice");
const healthRetryButton = document.querySelector("#healthRetryButton");
const placesAttribution = document.querySelector("#placesAttribution");
const rankingInfoButton = document.querySelector("#rankingInfoButton");
const rankingNotice = document.querySelector("#rankingNotice");
const modeTitle = document.querySelector("#modeTitle");
const modeToggleButton = document.querySelector("#modeToggleButton");
const modeToggleIcon = document.querySelector("#modeToggleIcon");

const modeStates = Object.fromEntries(Object.entries(MEAL_MODES).map(([mealMode, config]) => [
  mealMode,
  {
    activeSession: null,
    selectedPriceRange: "all",
    selectedFoodTypes: config.foodTypes.map((foodType) => foodType.value)
  }
]));

let currentMealMode = "lunch";
let activeSession = null;
let lastPosition = null;
let selectedPriceRange = "all";
let selectedFoodTypes = getFoodTypeOrder("lunch");
let backendConnected = false;

recommendButton.addEventListener("click", requestRecommendations);
refreshButton.addEventListener("click", refreshRecommendations);
filterToggleButton.addEventListener("click", toggleFilterPanel);
healthRetryButton.addEventListener("click", checkBackendConnection);
rankingInfoButton.addEventListener("click", () => { rankingNotice.hidden = !rankingNotice.hidden; });
modeToggleButton.addEventListener("click", toggleMealMode);
priceButtons.forEach((button) => button.addEventListener("click", () => selectPriceRange(button.dataset.priceRange)));
typeButtons.forEach((button) => button.addEventListener("click", () => toggleFoodType(button.dataset.foodType)));

initialize();

async function initialize() {
  localizeDocument();
  applyMealModeUi();
  syncButtons();
  await checkBackendConnection();
}

async function checkBackendConnection() {
  setConnectionChecking(true);
  try {
    const response = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
    backendConnected = response.ok;
  } catch {
    backendConnected = false;
  }
  setConnectionChecking(false);
  renderConnectionState();
}

function renderConnectionState() {
  backendNotice.hidden = backendConnected;
  setControlsDisabled(!backendConnected);
  if (!backendConnected) {
    recommendButton.hidden = true;
    refreshButton.hidden = true;
    filterToggleButton.hidden = true;
    filterPanel.hidden = false;
    setStatus(t("backendOffline"), true);
    setMetaStatus("");
    return;
  }
  if (!activeSession) {
    setStatus(t(getModeConfig().promptMessage));
    setMetaStatus("");
  }
  updateActionMode();
}

async function requestRecommendations() {
  if (!backendConnected) return;
  setLoading(true);
  setStatus(t(getModeConfig().searchingMessage), false);
  try {
    const position = lastPosition || await getCurrentPosition();
    lastPosition = position;
    const data = await fetchRecommendations({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      clientId: await getClientId(),
      mealMode: currentMealMode,
      priceRange: selectedPriceRange,
      foodTypes: getSelectedFoodTypesKey(),
      languageCode: placesLanguage
    });
    activeSession = {
      restaurants: Array.isArray(data.restaurants) ? data.restaurants : [],
      candidates: Array.isArray(data.sessionCandidates) ? data.sessionCandidates : [],
      seenRestaurantIds: (data.restaurants || []).map(getRestaurantKey),
      mealMode: currentMealMode,
      priceRange: selectedPriceRange,
      foodTypes: [...selectedFoodTypes],
      searchRadiusMeters: data.searchRadiusMeters,
      candidateCount: data.candidateCount,
      quota: data.quota || {},
      resultShortfall: Boolean(data.resultShortfall)
    };
    saveCurrentModeState();
    renderActiveSession(t("resultReceived"));
  } catch (error) {
    setStatus(error.message || t("errorFallback"), true);
  } finally {
    setLoading(false);
  }
}

function refreshRecommendations() {
  if (!activeSession || hasPendingConditionChanges()) {
    requestRecommendations();
    return;
  }
  const batch = buildLocalRecommendationBatch(activeSession.candidates, activeSession.seenRestaurantIds);
  activeSession.restaurants = batch.restaurants;
  activeSession.seenRestaurantIds = batch.seenRestaurantIds;
  saveCurrentModeState();
  renderActiveSession(batch.cycleReset ? t("cycleReset") : t("unseenResults"));
}

function buildLocalRecommendationBatch(candidates, seenRestaurantIds) {
  const seen = new Set(Array.isArray(seenRestaurantIds) ? seenRestaurantIds : []);
  let source = candidates.filter((restaurant) => !seen.has(getRestaurantKey(restaurant)));
  let cycleReset = false;
  if (!source.length && candidates.length) {
    source = candidates;
    seen.clear();
    cycleReset = true;
  }
  const restaurants = source.slice(0, TARGET_COUNT);
  restaurants.forEach((restaurant) => seen.add(getRestaurantKey(restaurant)));
  return { restaurants, seenRestaurantIds: [...seen], cycleReset };
}

function toggleMealMode() {
  saveCurrentModeState();
  currentMealMode = currentMealMode === "lunch" ? "lateNight" : "lunch";
  loadCurrentModeState();
  applyMealModeUi();
  syncButtons();
  rankingNotice.hidden = true;

  if (!backendConnected) {
    renderConnectionState();
    return;
  }
  if (activeSession) {
    renderActiveSession(t("modeRestored"));
    return;
  }
  resultsElement.replaceChildren();
  placesAttribution.hidden = true;
  setStatus(t(getModeConfig().promptMessage));
  setMetaStatus("");
  updateActionMode();
}

function applyMealModeUi() {
  const config = getModeConfig();
  document.body.classList.toggle("theme-night", currentMealMode === "lateNight");
  modeTitle.textContent = t(config.titleMessage);
  modeToggleIcon.textContent = config.toggleIcon;
  modeToggleButton.setAttribute("aria-label", t(config.toggleMessage));
  modeToggleButton.title = t(config.toggleMessage);
  recommendButton.textContent = t(config.startMessage);
  rankingNotice.textContent = t(config.rankingMessage);

  config.foodTypes.forEach((foodType, index) => {
    const button = typeButtons[index];
    button.dataset.foodType = foodType.value;
    button.textContent = t(foodType.message);
  });
  priceButtons.forEach((button) => {
    button.hidden = !config.allowedPrices.includes(button.dataset.priceRange);
  });
}

function renderActiveSession(message) {
  renderRestaurants(activeSession.restaurants);
  setStatus(message);
  setMetaStatus(buildMetaStatus(activeSession));
  placesAttribution.hidden = activeSession.restaurants.length === 0;
  rankingNotice.hidden = true;
  updateActionMode();
}

function updateActionMode() {
  const hasResults = Boolean(activeSession && activeSession.restaurants.length);
  recommendButton.hidden = hasResults || !backendConnected;
  refreshButton.hidden = !hasResults || !backendConnected;
  filterToggleButton.hidden = !hasResults || !backendConnected;
  if (!hasResults) filterPanel.hidden = false;
}

function selectPriceRange(priceRange) {
  if (!getModeConfig().allowedPrices.includes(priceRange)) return;
  selectedPriceRange = priceRange;
  saveCurrentModeState();
  syncButtons();
  announcePendingChanges();
}

function toggleFoodType(foodType) {
  const foodTypeOrder = getFoodTypeOrder();
  const isSelected = selectedFoodTypes.includes(foodType);
  if (isSelected && selectedFoodTypes.length === 1) return;
  selectedFoodTypes = isSelected
    ? selectedFoodTypes.filter((value) => value !== foodType)
    : foodTypeOrder.filter((value) => selectedFoodTypes.includes(value) || value === foodType);
  saveCurrentModeState();
  syncButtons();
  announcePendingChanges();
}

function announcePendingChanges() {
  if (activeSession && hasPendingConditionChanges()) setStatus(t("pendingChanges"));
}

function hasPendingConditionChanges() {
  return Boolean(activeSession) && (activeSession.priceRange !== selectedPriceRange
    || getFoodTypesKey(activeSession.foodTypes, currentMealMode) !== getSelectedFoodTypesKey());
}

function syncButtons() {
  priceButtons.forEach((button) => button.classList.toggle("active", button.dataset.priceRange === selectedPriceRange));
  typeButtons.forEach((button) => button.classList.toggle("active", selectedFoodTypes.includes(button.dataset.foodType)));
}

function toggleFilterPanel() {
  filterPanel.hidden = !filterPanel.hidden;
  filterToggleButton.setAttribute("aria-expanded", String(!filterPanel.hidden));
}

function setControlsDisabled(disabled) {
  priceButtons.forEach((button) => { button.disabled = disabled; });
  typeButtons.forEach((button) => { button.disabled = disabled; });
  recommendButton.disabled = disabled;
  refreshButton.disabled = disabled;
  filterToggleButton.disabled = disabled;
}

function setConnectionChecking(isChecking) {
  healthRetryButton.disabled = isChecking;
  healthRetryButton.textContent = isChecking ? t("checking") : t("retryCheck");
}

function setLoading(isLoading) {
  recommendButton.disabled = isLoading;
  refreshButton.disabled = isLoading;
  filterToggleButton.disabled = isLoading;
  modeToggleButton.disabled = isLoading;
  priceButtons.forEach((button) => { button.disabled = isLoading || !backendConnected; });
  typeButtons.forEach((button) => { button.disabled = isLoading || !backendConnected; });
}

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
}

function setMetaStatus(message) { metaStatusElement.textContent = message; }

function buildMetaStatus(session) {
  const parts = [];
  if (session.searchRadiusMeters) parts.push(`${t("searchRadius")} ${Math.round(session.searchRadiusMeters / 1000)} ${t("kilometers")}`);
  if (Number.isFinite(session.candidateCount)) parts.push(`${t("candidates")} ${session.candidateCount}`);
  if (session.quota && Number.isFinite(session.quota.dailyGoogleCalls)) {
    parts.push(`${t("googleApi")} ${session.quota.dailyGoogleCalls}/${session.quota.maxDailyGoogleCalls}`);
  }
  return parts.join(" · ");
}

function renderRestaurants(restaurants) {
  resultsElement.replaceChildren();
  restaurants.forEach((restaurant) => {
    const article = document.createElement("article");
    article.className = "restaurant";
    const title = document.createElement("h2");
    title.className = "restaurant__name";
    title.textContent = restaurant.name || t("unnamedRestaurant");
    const badges = document.createElement("div");
    badges.className = "badges";
    badges.append(
      createBadge("rating", `${t("score")} ${formatRating(restaurant.rating)}`),
      createBadge("price-badge", getPriceLabel(restaurant.priceRange)),
      createBadge("category-badge", getCategoryLabel(restaurant.category))
    );
    const address = document.createElement("p");
    address.className = "address";
    address.textContent = restaurant.address || t("addressUnknown");
    const footer = document.createElement("div");
    footer.className = "restaurant__footer";
    const openState = document.createElement("span");
    openState.className = `open-state${restaurant.isOpen === false && currentMealMode === "lunch" ? " closed" : ""}`;
    openState.textContent = currentMealMode === "lateNight"
      ? formatLateNightState(restaurant)
      : `${formatOpenState(restaurant.isOpen)}${formatDistance(restaurant.distanceMeters)}`;
    const mapLink = document.createElement("a");
    mapLink.className = "maps-link";
    mapLink.href = restaurant.googleMapsUrl;
    mapLink.target = "_blank";
    mapLink.rel = "noreferrer";
    mapLink.textContent = "Google Maps";
    footer.append(openState, mapLink);
    article.append(title, badges, address, footer);
    resultsElement.append(article);
  });
}

function createBadge(className, text) {
  const badge = document.createElement("span");
  badge.className = className;
  badge.textContent = text;
  return badge;
}

function formatLateNightState(restaurant) {
  let hours;
  if (restaurant.lateNightStatus === "unknown") hours = t("lateHoursUnknown");
  else if (restaurant.lateNightAllNight) hours = t("openAllNight");
  else if (restaurant.lateCloseTime) hours = t("openUntil", [restaurant.lateCloseTime]);
  else hours = t("lateNightOpen");
  const current = restaurant.isOpen === true ? `${t("openNow")} · ` : "";
  return `${current}${hours}${formatDistance(restaurant.distanceMeters)}`;
}

function formatRating(value) { return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value).toFixed(1) : t("ratingUnknown"); }
function formatOpenState(isOpen) { return isOpen === true ? t("openNow") : isOpen === false ? t("closed") : t("openingUnknown"); }
function formatDistance(value) { return Number.isFinite(Number(value)) ? ` · ${Math.round(value)} ${t("meters")}` : ""; }

async function fetchRecommendations({ lat, lng, clientId, mealMode, priceRange, foodTypes, languageCode }) {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng), mealMode, priceRange, foodTypes, languageCode });
  const response = await fetch(`${API_BASE_URL}/api/lunch?${params.toString()}`, { headers: { "X-Lunch-Client-Id": clientId } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(getApiErrorMessage(data.code) || data.error || t("errorFallback"));
  return data;
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
    resolve,
    () => reject(new Error(t("errorPosition"))),
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
  ));
}

async function getClientId() {
  const stored = await chrome.storage.local.get(CLIENT_ID_KEY);
  if (stored[CLIENT_ID_KEY]) return stored[CLIENT_ID_KEY];
  const clientId = `lunch_${crypto.randomUUID().replace(/-/g, "")}`;
  await chrome.storage.local.set({ [CLIENT_ID_KEY]: clientId });
  return clientId;
}

function saveCurrentModeState() {
  modeStates[currentMealMode] = {
    activeSession,
    selectedPriceRange,
    selectedFoodTypes: [...selectedFoodTypes]
  };
}

function loadCurrentModeState() {
  const state = modeStates[currentMealMode];
  activeSession = state.activeSession;
  selectedPriceRange = state.selectedPriceRange;
  selectedFoodTypes = [...state.selectedFoodTypes];
}

function getModeConfig() { return MEAL_MODES[currentMealMode]; }
function getFoodTypeOrder(mealMode = currentMealMode) { return MEAL_MODES[mealMode].foodTypes.map((item) => item.value); }
function getSelectedFoodTypesKey() { return getFoodTypesKey(selectedFoodTypes, currentMealMode); }
function getFoodTypesKey(foodTypes, mealMode) { return getFoodTypeOrder(mealMode).filter((value) => foodTypes.includes(value)).join(","); }
function getRestaurantKey(restaurant) { return restaurant.id || `${restaurant.name || ""}|${restaurant.address || ""}`; }

function getPlacesLanguage(uiLanguage) {
  return /^zh(?:-|_)/i.test(uiLanguage || "") ? "zh-TW" : "en";
}

function t(messageName, substitutions) {
  return chrome.i18n.getMessage(messageName, substitutions) || messageName;
}

function getApiErrorMessage(code) {
  return code ? chrome.i18n.getMessage(`error_${code}`) : "";
}

function getCategoryLabel(category) {
  const fallback = currentMealMode === "lateNight" ? t("lateNightFood") : t("dailyLunch");
  return category ? chrome.i18n.getMessage(`category_${category}`) || fallback : fallback;
}

function getPriceLabel(priceRange) {
  if (!priceRange || (priceRange.startAmount === null && priceRange.endAmount === null)) return t("priceUnknown");
  const formatAmount = (value) => new Intl.NumberFormat(placesLanguage).format(value);
  const suffix = priceRange.currencyCode && priceRange.currencyCode !== "TWD" ? ` ${priceRange.currencyCode}` : "";
  if (priceRange.startAmount !== null && priceRange.endAmount !== null) {
    return `${formatAmount(priceRange.startAmount)}-${formatAmount(priceRange.endAmount)}${suffix}`;
  }
  if (priceRange.startAmount !== null) return `${formatAmount(priceRange.startAmount)} ${t("priceAndUp")}${suffix}`;
  return `${formatAmount(priceRange.endAmount)} ${t("priceUpTo")}${suffix}`;
}

function localizeDocument() {
  document.documentElement.lang = placesLanguage === "zh-TW" ? "zh-Hant" : "en";
  document.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n); });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
}
