const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const loginWithTelegramCode = async (code) => {
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

export const completeTelegramSignup = async (setupToken, username, password) => {
  const res = await fetch(`${API_BASE}/api/auth/complete-telegram-signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      setupToken,
      username,
      password,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Ro'yxatdan o'tishda xatolik");
  }

  return data;
};

export const loginWithPassword = async (username, password) => {
  const res = await fetch(`${API_BASE}/api/auth/login-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Login xatoligi");
  }

  return data;
};

// Backward compatibility
export const login = loginWithTelegramCode;
