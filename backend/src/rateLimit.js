const { config } = require("./config");
const { getCache, setCache } = require("./cache");

function lunchRateLimit(req, res, next) {
  const clientId = req.get("X-Lunch-Client-Id") || req.ip || "anonymous";
  const windowMs = config.rateLimitWindowMinutes * 60 * 1000;
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const key = `rate:${clientId}:${windowStart}`;
  const count = getCache(key) || 0;

  if (count >= config.rateLimitMaxRequests) {
    return res.status(429).json({
      error: "Too many lunch recommendation requests. Please try again later.",
      code: "RATE_LIMITED"
    });
  }

  setCache(key, count + 1, windowMs);
  next();
}

module.exports = {
  lunchRateLimit
};
