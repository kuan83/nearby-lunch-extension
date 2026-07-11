const API_BASE_URL = "http://localhost:3000";
const CLIENT_ID_KEY = "lunchClientId";
const CACHE_PREFIX = "lunch:v10";
const ACTIVE_SESSION_PREFIX = "lunch:active:v1";
const TARGET_COUNT = 20;
const FOOD_TYPE_ORDER = ["noodles", "bento", "healthy", "southeast", "asian", "international"];

const recommendButton = document.querySelector("#recommendButton");
const refreshButton = document.querySelector("#refreshButton");
const filterToggleButton = document.querySelector("#filterToggleButton");
const filterPanel = document.querySelector("#filterPanel");
const priceButtons = [...document.querySelectorAll(".price-option")];
const typeButtons = [...document.querySelectorAll(".type-option")];
const statusElement = document.querySelector("#status");
const metaStatusElement = document.querySelector("#metaStatus");
const resultsElement = document.querySelector("#results");

let activeSession = null;
let lastPosition = null;
let selectedPriceRange = "all";
let selectedFoodTypes = [...FOOD_TYPE_ORDER];

recommendButton.addEventListener("click", () => requestRecommendations(false));
refreshButton.addEventListener("click", () => requestRecommendations(true));
filterToggleButton.addEventListener("click", toggleFilterPanel);
priceButtons.forEach((button) => {
  button.addEventListener("click", () => selectPriceRange(button.dataset.priceRange));
});
typeButtons.forEach((button) => {
  button.addEventListener("click", () => toggleFoodType(button.dataset.foodType));
});

initialize();

async function initialize() {
  await removeExpiredActiveSessions();
  const stored = await chrome.storage.local.get(getActiveSessionKey());
  const session = stored[getActiveSessionKey()];

  if (session && Array.isArray(session.restaurants) && session.restaurants.length) {
    activeSession = session;
    selectedPriceRange = session.priceRange || "all";
    selectedFoodTypes = normalizeFoodTypes(session.foodTypes);
    syncButtons();
    renderActiveSession("已恢復今天正在看的推薦。", "來源：當日記憶");
    return;
  }

  syncButtons();
  updateActionMode();
}

async function requestRecommendations(fromRefreshButton) {
  const conditionsChanged = hasPendingConditionChanges();
  const refresh = Boolean(fromRefreshButton && activeSession && !conditionsChanged);
  setLoading(true);
  setStatus(refresh ? "正在找尚未看過的店家..." : "正在取得位置並搜尋午餐...");

  try {
    const position = lastPosition || await getCurrentPosition();
    lastPosition = position;
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const foodTypesKey = getSelectedFoodTypesKey();
    const cacheKey = buildCacheKey(lat, lng, selectedPriceRange, foodTypesKey);

    if (!refresh) {
      const cached = await readCache(cacheKey);
      if (cached && Array.isArray(cached.restaurants)) {
        await activateResult(cached);
        renderActiveSession("已套用條件並顯示快取推薦。", "來源：Chrome 本地快取");
        return;
      }
    }

    const data = await fetchRecommendations({
      lat,
      lng,
      clientId: await getClientId(),
      priceRange: selectedPriceRange,
      foodTypes: foodTypesKey,
      refresh
    });

    await writeCache(cacheKey, data);
    await activateResult(data);
    renderActiveSession(buildStatusText(data, refresh), buildMetaStatus(data));
  } catch (error) {
    setStatus(error.message || "無法取得午餐推薦，目前結果已保留。", true);
    if (activeSession) {
      setMetaStatus("目前顯示的推薦沒有變更");
    }
  } finally {
    setLoading(false);
  }
}

async function activateResult(data) {
  const session = {
    ...data,
    restaurants: Array.isArray(data.restaurants) ? data.restaurants : [],
    priceRange: selectedPriceRange,
    foodTypes: [...selectedFoodTypes],
    foodTypesKey: getSelectedFoodTypesKey(),
    createdAt: new Date().toISOString()
  };

  await chrome.storage.local.set({ [getActiveSessionKey()]: session });
  activeSession = session;
}

function renderActiveSession(status, meta) {
  renderRestaurants(activeSession ? activeSession.restaurants : []);
  updateActionMode(true);
  setStatus(status);
  setMetaStatus(meta || buildMetaStatus(activeSession || {}));
}

async function fetchRecommendations({ lat, lng, clientId, priceRange, foodTypes, refresh }) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    priceRange,
    foodTypes
  });
  if (refresh) {
    params.set("refresh", "1");
  }

  const response = await fetch(`${API_BASE_URL}/api/lunch?${params}`, {
    headers: { "X-Lunch-Client-Id": clientId }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "後端 API 暫時無法使用。");
  }
  return data;
}

function renderRestaurants(restaurants) {
  if (!restaurants.length) {
    resultsElement.textContent = "";
    return;
  }

  const fragment = document.createDocumentFragment();
  restaurants.forEach((restaurant) => {
    const article = document.createElement("article");
    article.className = "restaurant";

    const name = document.createElement("h2");
    name.className = "restaurant__name";
    name.textContent = restaurant.name;

    const badges = document.createElement("div");
    badges.className = "badges";
    badges.append(
      makeBadge("rating", `評分 ${Number(restaurant.rating || 0).toFixed(1)}`),
      makeBadge("price-badge", restaurant.priceRangeLabel || "價格未知"),
      makeBadge("category-badge", restaurant.categoryLabel || "日常午餐")
    );

    const address = document.createElement("p");
    address.className = "address";
    address.textContent = restaurant.address;

    const footer = document.createElement("div");
    footer.className = "restaurant__footer";
    const openState = document.createElement("span");
    openState.className = restaurant.isOpen === false ? "open-state closed" : "open-state";
    openState.textContent = getOpenStateText(restaurant.isOpen);
    if (Number.isFinite(restaurant.distanceMeters)) {
      openState.textContent += ` · ${formatDistance(restaurant.distanceMeters)}`;
    }

    const mapsLink = document.createElement("a");
    mapsLink.className = "maps-link";
    mapsLink.href = restaurant.googleMapsUrl;
    mapsLink.target = "_blank";
    mapsLink.rel = "noreferrer";
    mapsLink.textContent = "Google Maps";

    footer.append(openState, mapsLink);
    article.append(name, badges, address, footer);
    fragment.append(article);
  });

  resultsElement.replaceChildren(fragment);
}

function makeBadge(className, text) {
  const badge = document.createElement("span");
  badge.className = className;
  badge.textContent = text;
  return badge;
}

function selectPriceRange(priceRange) {
  selectedPriceRange = priceRange || "all";
  syncButtons();
  announcePendingConditions();
}

function toggleFoodType(foodType) {
  if (!FOOD_TYPE_ORDER.includes(foodType)) {
    return;
  }
  if (selectedFoodTypes.includes(foodType) && selectedFoodTypes.length === 1) {
    setStatus("至少保留一個午餐類型。", true);
    return;
  }

  selectedFoodTypes = selectedFoodTypes.includes(foodType)
    ? selectedFoodTypes.filter((item) => item !== foodType)
    : FOOD_TYPE_ORDER.filter((item) => [...selectedFoodTypes, foodType].includes(item));
  syncButtons();
  announcePendingConditions();
}

function announcePendingConditions() {
  if (!activeSession) {
    setStatus("條件已更新，按下開始找午餐。", false);
    return;
  }

  if (hasPendingConditionChanges()) {
    setStatus("條件已變更，按重新推薦後才會替換目前結果。", false);
    setMetaStatus("目前 20 筆推薦保持不變");
  } else {
    setStatus("已回到目前結果的條件。", false);
    setMetaStatus(buildMetaStatus(activeSession));
  }
}

function hasPendingConditionChanges() {
  if (!activeSession) {
    return false;
  }
  return activeSession.priceRange !== selectedPriceRange
    || activeSession.foodTypesKey !== getSelectedFoodTypesKey();
}

function buildStatusText(data, refresh) {
  const count = Array.isArray(data.restaurants) ? data.restaurants.length : 0;
  if (data.cycleReset) {
    return "已看完本輪候選，重新開始推薦。";
  }
  if (refresh) {
    return `已換成 ${count} 間尚未看過的店家。`;
  }
  if (data.resultShortfall) {
    return `5 公里內符合條件的店家不足 20 間，目前找到 ${count} 間。`;
  }
  return `找到 ${count} 間適合日常午餐的店家。`;
}

function buildMetaStatus(data) {
  const radius = Number(data.searchRadiusMeters || 3000) / 1000;
  const quota = data.quota
    ? `Google API ${data.quota.dailyGoogleCalls}/${data.quota.maxDailyGoogleCalls}`
    : "";
  return [
    `範圍 ${radius} 公里`,
    `候選 ${data.candidateCount || (data.restaurants || []).length} 間`,
    quota
  ].filter(Boolean).join(" · ");
}

function updateActionMode(collapseFilters = false) {
  const hasResults = Boolean(activeSession && activeSession.restaurants && activeSession.restaurants.length);
  recommendButton.hidden = hasResults;
  filterToggleButton.hidden = !hasResults;
  refreshButton.hidden = !hasResults;
  refreshButton.disabled = !hasResults;
  if (!hasResults) {
    filterPanel.hidden = false;
  } else if (collapseFilters) {
    setFilterPanelExpanded(false);
  }
}

function toggleFilterPanel() {
  setFilterPanelExpanded(filterPanel.hidden);
}

function setFilterPanelExpanded(expanded) {
  filterPanel.hidden = !expanded;
  filterToggleButton.setAttribute("aria-expanded", String(expanded));
  filterToggleButton.textContent = expanded ? "收起條件" : "調整條件";
}

function setLoading(loading) {
  recommendButton.disabled = loading;
  refreshButton.disabled = loading || !activeSession;
  filterToggleButton.disabled = loading;
  recommendButton.textContent = loading ? "搜尋中..." : "開始找午餐";
  refreshButton.textContent = loading ? "搜尋中..." : "重新推薦";
}

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
}

function setMetaStatus(message) {
  metaStatusElement.textContent = message;
}

function syncButtons() {
  priceButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.priceRange === selectedPriceRange);
  });
  typeButtons.forEach((button) => {
    button.classList.toggle("active", selectedFoodTypes.includes(button.dataset.foodType));
  });
}

function normalizeFoodTypes(foodTypes) {
  const normalized = FOOD_TYPE_ORDER.filter((type) => Array.isArray(foodTypes) && foodTypes.includes(type));
  return normalized.length ? normalized : [...FOOD_TYPE_ORDER];
}

function getSelectedFoodTypesKey() {
  return FOOD_TYPE_ORDER.filter((type) => selectedFoodTypes.includes(type)).join(",");
}

function buildCacheKey(lat, lng, priceRange, foodTypesKey) {
  return `${CACHE_PREFIX}:${getLocalDateKey()}:${lat.toFixed(3)},${lng.toFixed(3)}:${priceRange}:${foodTypesKey}`;
}

function getActiveSessionKey() {
  return `${ACTIVE_SESSION_PREFIX}:${getLocalDateKey()}`;
}

async function removeExpiredActiveSessions() {
  const allStored = await chrome.storage.local.get(null);
  const currentKey = getActiveSessionKey();
  const expiredKeys = Object.keys(allStored).filter(
    (key) => key.startsWith(`${ACTIVE_SESSION_PREFIX}:`) && key !== currentKey
  );
  if (expiredKeys.length) {
    await chrome.storage.local.remove(expiredKeys);
  }
}

function getCurrentPosition() {
  if (!navigator.geolocation) {
    return Promise.reject(new Error("瀏覽器不支援定位。"));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    });
  }).catch((error) => {
    if (error.code === error.PERMISSION_DENIED) {
      throw new Error("請允許 Chrome extension 使用位置。");
    }
    if (error.code === error.TIMEOUT) {
      throw new Error("定位逾時，請再試一次。");
    }
    throw new Error("無法取得目前位置。");
  });
}

function getOpenStateText(isOpen) {
  if (isOpen === true) return "營業中";
  if (isOpen === false) return "未營業";
  return "營業狀態未知";
}

function formatDistance(meters) {
  return meters < 1000 ? `${meters} 公尺` : `${(meters / 1000).toFixed(1)} 公里`;
}

function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function getClientId() {
  const stored = await chrome.storage.local.get(CLIENT_ID_KEY);
  if (stored[CLIENT_ID_KEY]) {
    return stored[CLIENT_ID_KEY];
  }
  const clientId = crypto.randomUUID().replaceAll("-", "");
  await chrome.storage.local.set({ [CLIENT_ID_KEY]: clientId });
  return clientId;
}

async function readCache(cacheKey) {
  const stored = await chrome.storage.local.get(cacheKey);
  return stored[cacheKey] || null;
}

async function writeCache(cacheKey, data) {
  await chrome.storage.local.set({
    [cacheKey]: { ...data, createdAt: new Date().toISOString() }
  });
}
