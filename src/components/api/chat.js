import { normalizeImageUrl } from "../services/imageUrl";
import { getCached, invalidateCache, setCached } from "../services/cache";

const API_BASE =
  import.meta.env.VITE_API_URL || "https://xabarchi.onrender.com";
const CHAT_CACHE_TTL = 2 * 60_000;

const getToken = () => localStorage.getItem("UserToken");
const getTokenScopedPrefix = () => {
  const token = getToken();
  return token ? `chat:${token}` : "chat:guest";
};

const getChatCacheKey = (suffix) => `${getTokenScopedPrefix()}:${suffix}`;

const invalidateChatCache = () => {
  invalidateCache(`${getTokenScopedPrefix()}:`);
};

const buildAuthHeaders = () => {
  const token = getToken();
  if (!token) {
    window.location.href = "/login";
    throw new Error("Token topilmadi");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

export const getConversations = async (options = {}) => {
  const { force = false } = options;
  const cacheKey = getChatCacheKey("conversations");
  const cached = getCached(cacheKey);
  if (!force && cached) return cached;

  const response = await fetch(`${API_BASE}/chats`, {
    headers: buildAuthHeaders(),
  });
  const data = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(data.message || "Chat ro'yxatini olishda xatolik");
  }
  const normalized = Array.isArray(data)
    ? data.map((item) => ({
        ...item,
        otherUser: item?.otherUser
          ? {
              ...item.otherUser,
              profilePic: normalizeImageUrl(item.otherUser.profilePic),
            }
          : item?.otherUser,
      }))
    : [];

  setCached(cacheKey, normalized, CHAT_CACHE_TTL);
  return normalized;
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
  invalidateChatCache();
  return data;
};

export const getMessages = async (conversationId, options = {}) => {
  const { force = false } = options;
  const cacheKey = getChatCacheKey(`messages:${conversationId}`);
  const cached = getCached(cacheKey);
  if (!force && cached) return cached;

  const response = await fetch(`${API_BASE}/chats/${conversationId}/messages`, {
    headers: buildAuthHeaders(),
  });
  const data = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(data.message || "Xabarlarni olishda xatolik");
  }
  const normalized = Array.isArray(data) ? data : [];
  setCached(cacheKey, normalized, CHAT_CACHE_TTL);
  return normalized;
};

export const sendMessage = async (conversationId, payload, clientMessageId = "") => {
  const body =
    typeof payload === "string"
      ? { text: payload, clientMessageId }
      : { ...(payload || {}), clientMessageId };
  const response = await fetch(`${API_BASE}/chats/${conversationId}/messages`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Xabar yuborishda xatolik");
  }

  const messagesCacheKey = getChatCacheKey(`messages:${conversationId}`);
  const cachedMessages = getCached(messagesCacheKey);
  if (Array.isArray(cachedMessages)) {
    const merged = cachedMessages.some((item) => String(item._id) === String(data?._id))
      ? cachedMessages
      : [...cachedMessages, data];
    setCached(messagesCacheKey, merged, CHAT_CACHE_TTL);
  }

  invalidateCache(getChatCacheKey("conversations"));
  return data;
};

export const deleteMessage = async (conversationId, messageId) => {
  const response = await fetch(
    `${API_BASE}/chats/${conversationId}/messages/${messageId}`,
    {
      method: "DELETE",
      headers: buildAuthHeaders(),
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Xabarni o'chirishda xatolik");
  }

  invalidateCache(getChatCacheKey(`messages:${conversationId}`));
  invalidateCache(getChatCacheKey("conversations"));
  return data;
};

export const deleteConversation = async (conversationId) => {
  const response = await fetch(`${API_BASE}/chats/${conversationId}`, {
    method: "DELETE",
    headers: buildAuthHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Chatni o'chirishda xatolik");
  }

  invalidateCache(getChatCacheKey(`messages:${conversationId}`));
  invalidateCache(getChatCacheKey("conversations"));
  return data;
};

export const getSocketBase = () => API_BASE;
