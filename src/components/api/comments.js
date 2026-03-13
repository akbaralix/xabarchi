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

export const getComments = async (postId, limit = 20) => {
  const response = await fetch(
    `${API_BASE}/posts/${postId}/comments?limit=${limit}`,
  );
  const data = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(data.message || "Kommentlarni olishda xatolik");
  }
  return Array.isArray(data) ? data : [];
};

export const addComment = async (postId, text) => {
  const response = await fetch(`${API_BASE}/posts/${postId}/comments`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ text }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Komment qo'shishda xatolik");
  }
  return data;
};
