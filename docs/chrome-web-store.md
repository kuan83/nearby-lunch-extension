# Chrome Web Store Release Guide

## Listing position

**Name:** \u9644\u8fd1\u5348\u9910\u63a8\u85a6\uff08\u81ea\u67b6\u7248\uff09

**Short description:** \u4f7f\u7528\u81ea\u5df1\u7684 HTTPS localhost backend \u8207 Google Places API key \u5c0b\u627e\u9644\u8fd1\u65e5\u5e38\u5348\u9910\u8207\u6d88\u591c\u3002

**Important listing disclosure:** \u6b64\u64f4\u5145\u529f\u80fd\u4e0d\u5305\u542b\u5f8c\u7aef\u670d\u52d9\u6216\u5171\u7528 API key\u3002\u4f7f\u7528\u8005\u5fc5\u9808\u81ea\u884c\u5b89\u88dd Node.js \u8207 mkcert\u3001\u555f\u52d5 `https://localhost:3000` backend\u3001\u8a2d\u5b9a\u81ea\u5df1\u7684 Google Maps Platform billing \u8207 Places API (New) key\u3002Google Maps Platform \u7528\u91cf\u53ef\u80fd\u7522\u751f\u8cbb\u7528\u3002

## Permissions explanation

- `geolocation`: used only after the user starts a nearby lunch or late-night food search.
- `storage`: stores one random local client identifier, not restaurant results.
- `sidePanel`: keeps the browsing interface open while Maps links are opened in a new tab.
- `https://localhost:3000/*`: communicates only with the user's local backend over HTTPS.

## Privacy practices

Declare location use accurately: location is used to find nearby restaurants and is sent over HTTPS to the user's local backend and then to Google Maps Platform. State that the developer does not collect or receive the data; disclose the local persistent identifier, no sale, no advertising, and the Limited Use statement. Use the public GitHub Pages privacy URL after Pages is enabled. Select **No** for remote code.

## Reviewer instructions

1. Install Node.js and mkcert, then run `powershell -ExecutionPolicy Bypass -File .\scripts\setup-local-https.ps1` from the repository root. This creates a trusted localhost certificate for the current user.
2. In `backend`, copy `.env.example` to `.env` and provide a Places API (New) key.
3. Run `npm ci` and `npm start`; verify `https://localhost:3000/health`.
4. Install the extension, open the Side Panel, and choose **Find lunch**. The browser location prompt appears only after this action.

## Upload checklist

1. Enable two-step verification and complete Chrome Web Store developer registration.
2. Enable GitHub Pages: repository Settings, Pages, Deploy from a branch, `main`, `/docs`.
3. Confirm the public privacy-policy and terms URLs load.
4. Run `scripts/package-extension.ps1` and upload only `dist/nearby-lunch-extension.zip`.
5. Add the 128px icon and at least one unedited Side Panel screenshot showing real results and Google Maps attribution.
6. Publish as **Unlisted** first. Install it in a clean Chrome profile, verify the disconnected setup state and a self-hosted search, then change to **Public** when ready.

## Pre-submission checks

- The zip has no `backend/`, `.env`, `node_modules`, logs, or API keys.
- The extension uses only `https://localhost:3000/*`; it has no shared remote API endpoint.
- The listing, privacy disclosure, and actual behavior agree.
- Google Maps attribution and Maps links remain visible with Places content.
