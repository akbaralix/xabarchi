import { getCached, setCached } from "./cache";

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
    setCached(cacheKey, data, 60_000);
    return data;
  } catch {
    return null;
  }
};
