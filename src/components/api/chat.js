const API_BASE =
  import.meta.env.VITE_API_URL || "https://xabarchi.onrender.com";

const getToken = () => localStorage.getItem("UserToken");

const buildAuthHeaders = () => {
  const token = getToken();
  if (!token) {
    throw new Error("Login talab qilinadi");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

export const getConversations = async () => {
  const response = await fetch(`${API_BASE}/chats`, {
    headers: buildAuthHeaders(),
  });
  const data = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(data.message || "Chat ro'yxatini olishda xatolik");
  }
  return Array.isArray(data) ? data : [];
};

export const startConversation = async (username) => {
  const response = await fetch(`${API_BASE}/chats/start`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ username }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Chat ochishda xatolik");
  }
  return data;
};

export const getMessages = async (conversationId) => {
  const response = await fetch(`${API_BASE}/chats/${conversationId}/messages`, {
    headers: buildAuthHeaders(),
  });
  const data = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(data.message || "Xabarlarni olishda xatolik");
  }
  return Array.isArray(data) ? data : [];
};

export const sendMessage = async (conversationId, text) => {
  const response = await fetch(`${API_BASE}/chats/${conversationId}/messages`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ text }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Xabar yuborishda xatolik");
  }
  return data;
};

export const getSocketBase = () => API_BASE;
