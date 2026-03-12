const API_BASE =
  import.meta.env.VITE_API_URL || "https://xabarchi.onrender.com";

export const getAuthStatus = async () => {
  const token = localStorage.getItem("UserToken");
  if (!token) return null;

  const response = await fetch(`${API_BASE}/me/status`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json().catch(() => null);
  return data || null;
};
