import { getCached, invalidateCache, setCached } from "./cache";
import { normalizeImageUrl } from "./imageUrl";

const API_BASE =
  import.meta.env.VITE_API_URL || "https://xabarchi.onrender.com";

const normalizeUserPayload = (data) => ({
  ...data,
  profilePic: normalizeImageUrl(data?.profilePic),
  followersCount: Number(data?.followersCount || 0),
  followingCount: Number(data?.followingCount || 0),
  viewerIsFollowing: Boolean(data?.viewerIsFollowing),
});

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
    const normalized = normalizeUserPayload(data);
    setCached(cacheKey, normalized, 5 * 60_000);
    return normalized;
  } catch {
    return null;
  }
};

export const updateUserProfile = async ({ profilePic, bio, firstName }) => {
  const token = localStorage.getItem("UserToken");
  if (!token) throw new Error("Login talab qilinadi");

  const response = await fetch(`${API_BASE}/me/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ profilePic, bio, firstName }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Profilni yangilashda xatolik");
  }

  const normalized = normalizeUserPayload(data);

  invalidateCache("user:");
  invalidateCache("posts:");
  setCached(`user:${token}`, normalized, 5 * 60_000);
  return normalized;
};

export const setE2EPublicKey = async (publicKey) => {
  const token = localStorage.getItem("UserToken");
  if (!token) throw new Error("Login talab qilinadi");

  const response = await fetch(`${API_BASE}/me/e2e-key`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ publicKey }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "E2E kalitini saqlashda xatolik");
  }

  invalidateCache("user:");
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

  const token = localStorage.getItem("UserToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await fetch(`${API_BASE}/profile/${encodeURIComponent(normalized)}`, {
    headers,
  });
  if (!response.ok) return null;

  const data = await response.json().catch(() => null);
  if (!data) return null;

  const normalizedData = normalizeUserPayload(data);

  setCached(cacheKey, normalizedData, 5 * 60_000);
  return normalizedData;
};

export const followUserByUsername = async (username) => {
  const token = localStorage.getItem("UserToken");
  if (!token) throw new Error("Login talab qilinadi");

  const normalized = String(username || "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();
  if (!normalized) throw new Error("Username topilmadi");

  const response = await fetch(
    `${API_BASE}/profile/${encodeURIComponent(normalized)}/follow`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Kuzatishda xatolik");
  }

  invalidateCache("user:");
  invalidateCache("posts:");
  return data;
};

export const unfollowUserByUsername = async (username) => {
  const token = localStorage.getItem("UserToken");
  if (!token) throw new Error("Login talab qilinadi");

  const normalized = String(username || "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();
  if (!normalized) throw new Error("Username topilmadi");

  const response = await fetch(
    `${API_BASE}/profile/${encodeURIComponent(normalized)}/follow`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Kuzatishni bekor qilishda xatolik");
  }

  invalidateCache("user:");
  invalidateCache("posts:");
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
  const normalizedData = Array.isArray(data)
    ? data.map((item) => ({
        ...item,
        imageUrl: normalizeImageUrl(item?.imageUrl || item?.image),
        image: normalizeImageUrl(item?.image || item?.imageUrl),
        profilePic: normalizeImageUrl(item?.profilePic),
      }))
    : [];
  setCached(cacheKey, normalizedData, 5 * 60_000);
  return normalizedData;
};
