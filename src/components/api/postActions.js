const API_BASE =
  import.meta.env.VITE_API_URL || "https://xabarchi.onrender.com";

export const toggleLike = async (postId) => {
  const token = localStorage.getItem("UserToken");
  if (!token) {
    throw new Error("Login talab qilinadi");
  }

  const response = await fetch(`${API_BASE}/posts/${postId}/like`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Like amalida xatolik");
  }

  return data;
};

export const markPostView = async (postId) => {
  const token = localStorage.getItem("UserToken");
  if (!token) {
    throw new Error("Login talab qilinadi");
  }

  const response = await fetch(`${API_BASE}/posts/${postId}/view`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "View amalida xatolik");
  }

  return data;
};
