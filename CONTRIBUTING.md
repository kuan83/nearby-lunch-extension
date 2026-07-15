# Contributing

Thanks for helping improve Nearby Food Extension.

## Before you contribute

- Read the [README](README.md), [Privacy Policy](docs/privacy.md), and [Security Policy](SECURITY.md).
- Open an Issue before starting substantial work so the change can be discussed.
- Keep each pull request focused on one behavior or documentation improvement.

## Local checks

Run the public-release validation before opening a pull request:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-public-release.ps1
```

For a full self-hosted test, create your own `backend/.env` and trusted localhost certificate as described in the README. Do not use, request, or share another contributor's Google API key.

## Privacy and security rules

Never commit or paste any of the following into Issues, pull requests, screenshots, logs, or documentation:

- Google API keys, `.env` files, certificates, private keys, or tokens.
- Exact user locations, search histories, or Google Places response data.
- Personal contact information unrelated to the issue.

Keep permissions minimal, preserve HTTPS localhost-only communication, and do not add a shared backend or remote executable code without prior discussion.

## Pull requests

Describe the user-facing change, tests run, and any privacy or Google Maps Platform impact. Pull requests must pass CI and keep the privacy policy, documentation, and behavior consistent.
