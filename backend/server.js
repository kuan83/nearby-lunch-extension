require("dotenv").config();

const fs = require("fs");
const https = require("https");
const path = require("path");
const express = require("express");
const cors = require("cors");
const { config } = require("./src/config");
const { lunchRateLimit } = require("./src/rateLimit");
const { getLunchRecommendations } = require("./src/lunchService");
const { getDailyGoogleCallCount } = require("./src/quota");
const { version: backendVersion } = require("./package.json");

const SEARCH_STRATEGY_VERSION = "lateNightHybridV1";

const app = express();

app.use(
  cors({
    origin: [/^chrome-extension:\/\//],
    methods: ["GET"],
    allowedHeaders: ["Content-Type", "X-Lunch-Client-Id"]
  })
);

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    version: backendVersion,
    searchStrategyVersion: SEARCH_STRATEGY_VERSION
  });
});

app.get("/api/lunch", lunchRateLimit, async (req, res) => {
  try {
    const result = await getLunchRecommendations({
      lat: req.query.lat,
      lng: req.query.lng,
      clientId: req.get("X-Lunch-Client-Id"),
      mealMode: req.query.mealMode,
      priceRange: req.query.priceRange,
      foodTypes: req.query.foodTypes,
      languageCode: req.query.languageCode
    });

    res.json(result);
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({
      error: error.publicMessage || "Lunch recommendations are temporarily unavailable.",
      code: error.code || "LUNCH_SERVICE_ERROR",
      cached: Boolean(error.cached),
      quota: {
        dailyGoogleCalls: getDailyGoogleCallCount(),
        maxDailyGoogleCalls: config.maxDailyGoogleCalls
      }
    });
  }
});

const tlsCredentials = loadTlsCredentials();

const server = https.createServer(tlsCredentials, app);

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${config.port} is already in use. Nearby Food backend may already be running.`);
    console.error("Close the existing backend window, or stop its process before starting another copy.");
    process.exitCode = 1;
    return;
  }
  throw error;
});

server.listen(config.port, () => {
  console.log(`Nearby Food backend listening securely on https://localhost:${config.port}`);
});

function loadTlsCredentials() {
  const keyPath = resolveTlsPath(process.env.HTTPS_KEY_PATH, "certs/localhost-key.pem");
  const certPath = resolveTlsPath(process.env.HTTPS_CERT_PATH, "certs/localhost-cert.pem");
  const missingPaths = [keyPath, certPath].filter((filePath) => !fs.existsSync(filePath));

  if (missingPaths.length) {
    throw new Error(
      `HTTPS certificate files are required. Run the mkcert setup in README.md, then configure HTTPS_KEY_PATH and HTTPS_CERT_PATH. Missing: ${missingPaths.join(", ")}`
    );
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
}

function resolveTlsPath(value, fallback) {
  return path.resolve(__dirname, value || fallback);
}
