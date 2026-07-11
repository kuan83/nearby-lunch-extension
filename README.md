# 附近午餐推薦 Chrome Extension

Chrome Manifest V3 Side Panel + Node.js Express 後端。前端負責定位、條件選擇、顯示與本地快取；Google Places API key 只放在 `backend/.env`。

## 啟動

```powershell
cd backend
npm install
npm start
```

在 `chrome://extensions` 開啟開發人員模式，選擇「載入未封裝項目」，載入 `extension` 資料夾。點工具列 icon 後會在 Chrome Side Panel 開啟，切換頁面或點 Google Maps 不會讓推薦介面消失。

## 精準上班族午餐搜尋

後端使用 Nearby Search (New)，將一次推薦拆成最多 5 組定向搜尋：麵飯小吃、便當健康、越南東南亞、亞洲料理、義大利異國。

每組最多取得 20 筆並使用 `DISTANCE` 排序。第一階段搜尋 3 公里；排除不適合店家後不足 20 間，才以 5 公里再搜尋一次。預設全選時每個新地點最多使用 10 次 Google API，當日相同條件之後都走快取。

```js
{
  includedTypes,
  maxResultCount: 20,
  rankPreference: "DISTANCE",
  languageCode: "zh-TW",
  locationRestriction: { circle: { center, radius } }
}
```

系統不使用泛用的 `restaurant`、`cafe`、`bakery` 或 `fast_food_restaurant`。候選回來後會排除牛排、火鍋、燒肉、吃到飽、糕點甜點與炸雞，再依搜尋組輪流取店。

Google Places API 沒有提供「廣告／贊助結果」欄位，因此不能保證辨識廣告店家；本版透過距離排序降低熱門度排序的影響。

固定 field mask 包含 `places.id`、名稱、地址、位置、type、評分、價格、營業狀態及 Google Maps URI。不使用 Place Details、Photos、Autocomplete，也不嵌入 Google Map。

## API

```text
GET /api/lunch?lat=24.080&lng=120.542&priceRange=all&foodTypes=noodles,bento,healthy,southeast,asian,international
```

`foodTypes` 可多選：

```text
noodles        麵飯小吃
bento          便當餐盒
healthy        健康輕食
southeast      越南東南亞
asian          亞洲料理
international  義大利異國
```

Response 額外包含：`searchRadiusMeters`、`candidateCount`、`googleCallsUsed`、`resultShortfall`。若 5 公里內不足 20 間，回傳實際數量並令 `resultShortfall=true`。

## 價格區間

```text
all        不限
1_100      1-100
101_500    101-500
501_1000   501-1000
1001_2000  1001-2000
2000_up    2000以上
```

指定價格時，有 Google 價格資料的店依區間篩選；價格未知的日常小店仍保留並標示「價格未知」。

## 快取與重新推薦

```text
client:{date}:{clientId}:{geoBucket}:{priceRange}:officeLunchV10:{foodTypesKey}
area:{date}:{geoBucket}:officeLunchV10:{foodTypesKey}
lunch:v10:{date}:{geoBucket}:{priceRange}:{foodTypesKey}
lunch:active:v1:{date}
```

- Area cache 保存完整合格候選池。
- 價格切換、Side Panel 重開與重新推薦不會自動追加 Google 呼叫。
- 重新推薦先排除已看過的店；候選全部看完才重置循環。
- 單一搜尋組失敗時保留其他組結果，失敗組在 cooldown 期間不重試。
- `lunch:active:v1:{date}` 保存當天正在看的結果、順序與條件；關閉再開仍會恢復，隔天自動清除。
- 切換類型或價格不會立即替換目前結果，只有按「重新推薦」才套用。

## `.env`

```text
GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
PORT=3000
MAX_DAILY_GOOGLE_CALLS=25
CACHE_TTL_HOURS=24
INITIAL_SEARCH_RADIUS_METERS=3000
EXPANDED_SEARCH_RADIUS_METERS=5000
RATE_LIMIT_WINDOW_MINUTES=10
RATE_LIMIT_MAX_REQUESTS=30
GOOGLE_ERROR_COOLDOWN_MINUTES=30
RECOMMENDATION_COUNT=20
GOOGLE_MAX_RESULT_COUNT=20
```

`MAX_DAILY_GOOGLE_CALLS=25` 可支援每天兩個完整的新地點搜尋，並保留 5 次緩衝。請同時在 Google Cloud Billing 設定低額預算警示；預算警示只會通知，不會自動停止計費。

## 官方參考

- [Nearby Search (New)](https://developers.google.com/maps/documentation/places/web-service/nearby-search)
- [Place Types (New)](https://developers.google.com/maps/documentation/places/web-service/place-types)
- [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
