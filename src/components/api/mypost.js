import { getCached, invalidateCache, setCached } from "../services/cache";

const API_BASE =
  import.meta.env.VITE_API_URL || "https://xabarchi.onrender.com";

const getToken = () => localStorage.getItem("UserToken");

export const getMyPosts = async () => {
  const token = getToken();
  if (!token) throw new Error("Foydalanuvchi autentifikatsiyasi topilmadi");
  const cacheKey = `posts:me:${token}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const response = await fetch(`${API_BASE}/posts/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => []);

  if (!response.ok) {
    throw new Error(data.message || "Postlarni olishda xatolik yuz berdi");
  }

  const normalized = Array.isArray(data) ? data : [];
  setCached(cacheKey, normalized, 30_000);
  return normalized;
};

export const deleteMyPost = async (postId) => {
  const token = getToken();
  if (!token) throw new Error("Foydalanuvchi autentifikatsiyasi topilmadi");

  const response = await fetch(`${API_BASE}/posts/${postId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Postni o'chirishda xatolik");
  }

  invalidateCache("posts:");

  return data;
};
