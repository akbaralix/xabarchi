const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const login = async (code) => {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Login xatoligi");
  }

  return data;
};
