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
        imageUrls: Array.isArray(item?.imageUrls)
          ? item.imageUrls.map((url) => normalizeImageUrl(url)).filter(Boolean)
          : [],
        imageUrl: normalizeImageUrl(item?.imageUrl || item?.image),
        image: normalizeImageUrl(item?.image || item?.imageUrl),
        profilePic: normalizeImageUrl(item?.profilePic),
      }))
    : [];
  setCached(cacheKey, normalized, 5 * 60_000);
  return normalized;
};

export const getPostById = async (postId) => {
  if (!postId) return null;
  const token = localStorage.getItem("UserToken");
  const cacheKey = `posts:single:${postId}:${token || "guest"}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_BASE}/posts/${postId}`, { headers });
  if (!res.ok) return null;

  const data = await res.json();
  const normalized =
    data && typeof data === "object"
      ? {
          ...data,
          imageUrls: Array.isArray(data?.imageUrls)
            ? data.imageUrls.map((url) => normalizeImageUrl(url)).filter(Boolean)
            : [],
          imageUrl: normalizeImageUrl(data?.imageUrl || data?.image),
          image: normalizeImageUrl(data?.image || data?.imageUrl),
          profilePic: normalizeImageUrl(data?.profilePic),
        }
      : null;
  if (normalized) setCached(cacheKey, normalized, 2 * 60_000);
  return normalized;
};
