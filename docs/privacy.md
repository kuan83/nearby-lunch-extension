# Privacy Policy

Effective date: 2026-07-11

Nearby Food Extension is a self-hosted Chrome extension. It does not provide a developer-operated backend, shared API key, analytics service, advertising service, or account system.

## Location and Places requests

The extension requests browser location only after the user chooses to search for lunch or late-night food. The location is sent over HTTPS from the extension to the user's own local backend at `https://localhost:3000`. That backend sends geographically restricted Nearby Search or Text Search requests to Google Maps Platform using the user's own Google Places API key.

The developer does not operate or receive data from this local backend and does not collect, sell, transfer, or store the user's location or search history.

## Local storage and retention

The extension stores only a randomly generated local client identifier in Chrome storage for local request limiting. It does not persist restaurant names, addresses, ratings, prices, opening status, or other Google Places content. Search results remain only in the memory of the currently open Side Panel and disappear when the panel is closed or reloaded.

The local backend keeps only short-lived request-limit counters and failure cooldown data. It does not persist full Google Places responses.

## User responsibilities

The user supplies and safeguards their own Google Places API key in `backend/.env`, configures Google Cloud billing, API restrictions, quotas, and budget alerts, and is responsible for their Google Maps Platform use.

## Third-party service

Google Maps Platform processes the Places search request. Google Maps links and attribution are displayed with Places content. Google may process information under its own policies.

## Chrome Web Store Limited Use

The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements. Location and the local client identifier are used only to provide nearby lunch or late-night food recommendations, rate-limit the local backend, and prevent abuse. They are not sold, used for advertising, or used for unrelated profiling.

## Contact and changes

This policy may be updated when the extension changes. The current version is maintained in this repository.
