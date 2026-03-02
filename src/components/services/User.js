const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const getUser = async () => {
  const token = localStorage.getItem("UserToken");
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};
