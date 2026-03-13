const API_BASE =
  import.meta.env.VITE_API_URL || "https://xabarchi.onrender.com";

const buildAuthHeaders = () => {
  const token = localStorage.getItem("UserToken");
  if (!token) {
    throw new Error("Login talab qilinadi");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

export const getNotifications = async () => {
  const response = await fetch(`${API_BASE}/notifications`, {
    headers: buildAuthHeaders(),
  });
  const data = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(data.message || "Bildirishnomalarni olishda xatolik");
  }
  return Array.isArray(data) ? data : [];
};

export const markNotificationsRead = async (ids = []) => {
  const response = await fetch(`${API_BASE}/notifications/read`, {
    method: "PATCH",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ ids }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "O'qilganini saqlashda xatolik");
  }
  return data;
};
