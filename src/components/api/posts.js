import { getCached, setCached } from "../services/cache";
import { normalizeImageUrl } from "../services/imageUrl";

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
  const normalized = Array.isArray(data)
    ? data.map((item) => ({
        ...item,
        imageUrl: normalizeImageUrl(item?.imageUrl || item?.image),
        image: normalizeImageUrl(item?.image || item?.imageUrl),
        profilePic: normalizeImageUrl(item?.profilePic),
      }))
    : [];
  setCached(cacheKey, normalized, 5 * 60_000);
  return normalized;
};
