const cacheStore = new Map();

export const getCached = (key) => {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expireAt) {
    cacheStore.delete(key);
    return null;
  }
  return entry.data;
};

export const setCached = (key, data, ttlMs = 30_000) => {
  cacheStore.set(key, {
    data,
    expireAt: Date.now() + ttlMs,
  });
};

export const invalidateCache = (prefix = "") => {
  for (const key of cacheStore.keys()) {
    if (!prefix || key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }
};
