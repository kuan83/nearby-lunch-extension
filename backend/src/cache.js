const store = new Map();

function getCache(key) {
  const entry = store.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt && entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }

  return entry.value;
}

function setCache(key, value, ttlMs) {
  store.set(key, {
    value,
    expiresAt: ttlMs ? Date.now() + ttlMs : null
  });
}

function deleteCache(key) {
  store.delete(key);
}

module.exports = {
  getCache,
  setCache,
  deleteCache
};
