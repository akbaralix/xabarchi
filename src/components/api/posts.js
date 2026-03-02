import { getCached, setCached } from "../services/cache";

const API_BASE =
  import.meta.env.VITE_API_URL || "https://xabarchi.onrender.com";

export const getPosts = async () => {
  const token = localStorage.getItem("UserToken");
  const cacheKey = `posts:feed:${token || "guest"}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_BASE}/posts`, { headers });
  if (!res.ok) return [];

  const data = await res.json();
  const normalized = Array.isArray(data) ? data : [];
  setCached(cacheKey, normalized, 20_000);
  return normalized;
};
