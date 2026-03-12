const API_BASE =
  import.meta.env.VITE_API_URL || "https://xabarchi.onrender.com";

const getToken = () => {
  const token = localStorage.getItem("UserToken");
  if (!token) {
    throw new Error("Login talab qilinadi");
  }
  return token;
};

const buildHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
});

const parseResponse = async (response, fallbackMessage) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
};

export const getAdminStats = async () => {
  const response = await fetch(`${API_BASE}/admin/stats`, {
    headers: buildHeaders(),
  });
  return parseResponse(response, "Statistika olishda xatolik");
};

export const getAdminUsers = async (search = "") => {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  const response = await fetch(`${API_BASE}/admin/users${query}`, {
    headers: buildHeaders(),
  });
  return parseResponse(response, "Userlar ro'yxatini olishda xatolik");
};

export const blockUser = async (chatId, blocked, reason = "") => {
  const response = await fetch(`${API_BASE}/admin/users/${chatId}/block`, {
    method: "PATCH",
    headers: {
      ...buildHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ blocked, reason }),
  });
  return parseResponse(response, "Bloklashda xatolik");
};

export const deletePostByAdmin = async (postId) => {
  const response = await fetch(`${API_BASE}/admin/posts/${postId}`, {
    method: "DELETE",
    headers: buildHeaders(),
  });
  return parseResponse(response, "Postni o'chirishda xatolik");
};

export const getAdminReports = async (status = "open") => {
  const response = await fetch(
    `${API_BASE}/admin/reports?status=${encodeURIComponent(status)}`,
    {
      headers: buildHeaders(),
    },
  );
  return parseResponse(response, "Shikoyatlar ro'yxatini olishda xatolik");
};

export const resolveReport = async (reportId) => {
  const response = await fetch(`${API_BASE}/admin/reports/${reportId}/resolve`, {
    method: "PATCH",
    headers: buildHeaders(),
  });
  return parseResponse(response, "Shikoyatni yopishda xatolik");
};
