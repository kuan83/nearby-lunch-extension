# Nearby Food Extension (Self-hosted)

Chrome Manifest V3 Side Panel extension for finding everyday lunch and affordable late-night food nearby. It connects only to a backend running securely on your own computer at `https://localhost:3000`.

The extension does not include a shared backend or a shared Google Maps Platform key. Each user supplies and manages their own key, billing account, and usage limits.

## Project overview

This repository contains two parts:

- `extension/`: the Manifest V3 Side Panel interface with lunch and late-night modes. It asks for location only after the user starts a search and never contains a Google API key.
- `backend/`: a local HTTPS Node.js service that calls Places API (New) with the user's own key.

The project is published as source code for self-hosting. It is not a hosted restaurant-search service and does not provide a shared Google billing account.

## Quick setup for Windows

The simplest Windows path needs no typed PowerShell commands:

1. Double-click `Setup-Nearby-Lunch.cmd` in the project folder.
2. The setup window installs missing Node.js LTS and mkcert through Windows Package Manager, then asks once for your Google Places API key.
3. If it installed Node.js or mkcert, close the window and double-click `Setup-Nearby-Lunch.cmd` once more.
4. Double-click `Start-Nearby-Lunch.cmd` whenever you want to use the extension. Keep its window open while using Nearby Lunch.
5. In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the `extension/` folder.

The first-time setup creates `backend/.env` and `backend/certs/` locally. Both are ignored by Git. Never share either folder or its contents.

## Manual setup

1. Install a current Node.js LTS release.
2. Configure a Google Maps Platform project with billing enabled and enable **Places API (New)** only.
3. Restrict the key to **Places API (New)**. During local development, application restriction can remain unset; use an IP restriction after deploying a backend with a fixed public IP.
4. Create the backend environment file and add your own key:

   ```powershell
   cd backend
   Copy-Item .env.example .env
   ```

   Set `GOOGLE_PLACES_API_KEY` in `backend/.env`. Do not place it in `extension/`, commit it, or upload it to the Chrome Web Store.

5. Install [mkcert](https://github.com/FiloSottile/mkcert), trust its local certificate authority, and create a localhost certificate. On Windows with winget:

   ```powershell
   winget install FiloSottile.mkcert
   cd ..
   powershell -ExecutionPolicy Bypass -File .\scripts\setup-local-https.ps1
   ```

   If winget is unavailable, download the official pre-built `mkcert.exe` from its GitHub releases, then pass its full path:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\setup-local-https.ps1 -MkcertPath "C:\path\to\mkcert.exe"
   ```

   The generated `backend/certs/` folder is ignored by Git. Never share its private key. The script changes the current user's trusted certificate store and must be run interactively.

6. Install and start the HTTPS backend:

   ```powershell
   npm ci
   npm start
   ```

   Confirm `https://localhost:3000/health` returns `{ "ok": true }`.

7. In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the `extension/` folder. Click the extension icon to open the Side Panel.

The Side Panel checks `/health` before asking for location. If the local backend is unavailable, it shows a setup state and sends no Places request.

## Recommendation modes

- **Lunch** is the default light theme and focuses on everyday noodles, rice, lunch boxes, healthy food, Southeast Asian food, Asian meals, and casual international food.
- **Late night** uses a dark theme and focuses on fried snacks, braised snacks, late-night bites, noodles and soup, braised-pork rice, and cooked food. Known high-price restaurants and pastry/dessert businesses are excluded.
- Lunch uses Nearby Search (New). Late-night mode combines four localized Text Search (New) queries for categories without reliable Google place types (such as fried snacks, braised snacks, stinky tofu, and braised-pork rice) with two Nearby Search groups. All searches are geographically restricted and distance-ranked.
- Late-night opening hours are preferred when Google provides them; businesses with unknown hours remain lower in the results. Mode switching does not make a Google request.
- Mode switching itself does not call Google. Results for each mode remain separate in memory while the Side Panel stays open.

## Languages

The extension follows Chrome's UI language. Traditional Chinese (`zh-TW`) and English are available; unsupported UI languages fall back to English. Places searches use `zh-TW` for Chrome languages beginning with `zh-`, and `en` for all other languages. Google Places may still return store names or addresses in the language available in its source data.

## Data and cost behavior

- Your browser sends location over HTTPS to your own `localhost` backend, which sends Nearby Search or Text Search requests to Google Maps Platform using **your** key.
- The released extension and backend do not persist Google Places content. Lunch and late-night results exist only while the current Side Panel remains open. Closing or reloading it clears restaurant data.
- `chrome.storage.local` only stores a random client identifier used by the local rate limiter; it does not store restaurant results.
- The backend keeps short-lived failure cooldown, rate-limit, and daily-call counters. It does not keep full Places responses.
- Default `MAX_DAILY_GOOGLE_CALLS=25` is a local guardrail, not a guarantee of free Google Maps Platform usage. Set Google Cloud Billing budgets and alerts yourself.
- Late-night mode uses both Nearby Search Enterprise and Text Search Enterprise fields. Google currently gives each SKU its own monthly 1,000-call free usage cap, but pricing can change; the local daily counter limits their combined total.

The UI includes Google Maps attribution, a Google Maps link for each result, and a short ranking explanation. See the [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies) before redistributing modified versions.

## Environment settings

```text
GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
PORT=3000
HTTPS_KEY_PATH=certs/localhost-key.pem
HTTPS_CERT_PATH=certs/localhost-cert.pem
MAX_DAILY_GOOGLE_CALLS=25
INITIAL_SEARCH_RADIUS_METERS=3000
EXPANDED_SEARCH_RADIUS_METERS=5000
RATE_LIMIT_WINDOW_MINUTES=10
RATE_LIMIT_MAX_REQUESTS=30
GOOGLE_ERROR_COOLDOWN_MINUTES=30
RECOMMENDATION_COUNT=20
GOOGLE_MAX_RESULT_COUNT=20
```

## Extension package validation

Create an upload zip containing only `extension/`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-extension.ps1
```

The result is `dist/nearby-lunch-extension.zip`. It excludes the backend, `.env`, certificates, `node_modules`, logs, Git metadata, and test output. The package is retained for local validation; this project is not currently being submitted to the Chrome Web Store.

See the [project site](docs/index.md), [Privacy Policy](docs/privacy.md), [Terms of Use](docs/terms.md), [contribution guide](CONTRIBUTING.md), and [security policy](SECURITY.md). To publish the policy pages, enable GitHub Pages from the `main` branch's `/docs` folder. The expected public URLs are:

- `https://kuan83.github.io/nearby-lunch-extension/privacy.html`
- `https://kuan83.github.io/nearby-lunch-extension/terms.html`

## License

[MIT](LICENSE)
