# Nearby Lunch Extension

Nearby Lunch Extension is an open-source, self-hosted Chrome Side Panel project for finding everyday lunch nearby. It is designed for developers who want to run their own local backend and use their own Google Maps Platform account.

## What this project does

- Finds nearby everyday lunch options from Google Places API (New).
- Keeps the Google Places API key only in the user's local `backend/.env`.
- Connects the extension to a user-owned HTTPS localhost backend.
- Limits local Google API use with daily quota, rate-limit, and failure-cooldown safeguards.
- Supports Traditional Chinese and English UI text.

## Self-hosting

Follow the [README setup guide](https://github.com/kuan83/nearby-lunch-extension#self-hosted-setup) to create a trusted localhost certificate, configure your own key, and load the extension locally.

## Privacy and project policies

- [Privacy Policy](privacy.md)
- [Terms of Use](terms.md)
- [Contributing](https://github.com/kuan83/nearby-lunch-extension/blob/main/CONTRIBUTING.md)
- [Security Policy](https://github.com/kuan83/nearby-lunch-extension/security/policy)

This project does not provide a shared backend, shared Google API key, or shared billing account.
