import { getCached, invalidateCache, setCached } from "./cache";

const API_BASE =
  import.meta.env.VITE_API_URL || "https://xabarchi.onrender.com";

export const getUser = async () => {
  const token = localStorage.getItem("UserToken");
  if (!token) return null;
  const cacheKey = `user:${token}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${API_BASE}/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return null;
    const data = await res.json();
    setCached(cacheKey, data, 5 * 60_000);
    return data;
  } catch {
    return null;
  }
};

export const updateUserProfile = async ({ profilePic, bio }) => {
  const token = localStorage.getItem("UserToken");
  if (!token) throw new Error("Login talab qilinadi");

  const response = await fetch(`${API_BASE}/me/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ profilePic, bio }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Profilni yangilashda xatolik");
  }

  invalidateCache("user:");
  invalidateCache("posts:");
  setCached(`user:${token}`, data, 5 * 60_000);
  return data;
};

export const getUserByUsername = async (username) => {
  const normalized = String(username || "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;

  const cacheKey = `user:profile:${normalized}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const response = await fetch(`${API_BASE}/profile/${encodeURIComponent(normalized)}`);
  if (!response.ok) return null;

  const data = await response.json().catch(() => null);
  if (!data) return null;

  setCached(cacheKey, data, 5 * 60_000);
  return data;
};

export const getUserPostsByUsername = async (username) => {
  const normalized = String(username || "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();
  if (!normalized) return [];

  const cacheKey = `posts:user:${normalized}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const response = await fetch(
    `${API_BASE}/profile/${encodeURIComponent(normalized)}/posts`,
  );
  if (!response.ok) return [];

  const data = await response.json().catch(() => []);
  const normalizedData = Array.isArray(data) ? data : [];
  setCached(cacheKey, normalizedData, 5 * 60_000);
  return normalizedData;
};
