# Nearby Food Extension

Nearby Food Extension is an open-source, self-hosted Chrome Side Panel project for finding everyday lunch and affordable late-night food nearby. It is designed for people who want to run their own local backend and use their own Google Maps Platform account.

## What this project does

- Finds nearby everyday lunch or late-night food options using geographically restricted Nearby Search and Text Search from Google Places API (New).
- Switches between a light lunch interface and a dark late-night interface without making a Google request merely for changing modes.
- Keeps the Google Places API key only in the user's local `backend/.env`.
- Connects the extension to a user-owned HTTPS localhost backend.
- Limits local Google API use with daily quota, rate-limit, and failure-cooldown safeguards.
- Supports Traditional Chinese and English UI text.

## Quick setup on Windows

For the normal Windows path, download or clone the repository and double-click `Setup-Nearby-Lunch.cmd`. It installs missing prerequisites through winget, creates the trusted localhost certificate, and asks for the user's own Google Places API key one time. After setup, double-click `Start-Nearby-Lunch.cmd` whenever the extension is needed.

The API key and certificate remain only on the user's computer in ignored files. They are never part of the repository or extension package.

## Manual self-hosting

Follow the [README setup guide](https://github.com/kuan83/nearby-lunch-extension#quick-setup-for-windows) to create a trusted localhost certificate, configure your own key, and load the extension locally.

## Privacy and project policies

- [Privacy Policy](privacy.md)
- [Terms of Use](terms.md)
- [Contributing](https://github.com/kuan83/nearby-lunch-extension/blob/main/CONTRIBUTING.md)
- [Security Policy](https://github.com/kuan83/nearby-lunch-extension/security/policy)

This project does not provide a shared backend, shared Google API key, or shared billing account.
