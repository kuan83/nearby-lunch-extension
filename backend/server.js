require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { config } = require("./src/config");
const { lunchRateLimit } = require("./src/rateLimit");
const { getLunchRecommendations } = require("./src/lunchService");
const { getDailyGoogleCallCount } = require("./src/quota");

const app = express();

app.use(
  cors({
    origin: [/^chrome-extension:\/\//, "http://localhost:3000"],
    methods: ["GET"],
    allowedHeaders: ["Content-Type", "X-Lunch-Client-Id"]
  })
);

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/lunch", lunchRateLimit, async (req, res) => {
  try {
    const result = await getLunchRecommendations({
      lat: req.query.lat,
      lng: req.query.lng,
      clientId: req.get("X-Lunch-Client-Id"),
      priceRange: req.query.priceRange,
      foodTypes: req.query.foodTypes,
      refresh: req.query.refresh === "1"
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

app.listen(config.port, () => {
  console.log(`Lunch backend listening on http://localhost:${config.port}`);
});
