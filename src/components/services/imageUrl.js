const API_BASE = import.meta.env.VITE_API_URL || "https://xabarchi.onrender.com";

const SUPABASE_PUBLIC_PATH = "/storage/v1/object/public/";

const toBase64Url = (value) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const buildMediaProxyUrl = (bucket, path) => {
  const token = toBase64Url(`${bucket}/${path}`);
  return `${API_BASE}/m/${token}`;
};

export const normalizeImageUrl = (value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  if (trimmed.startsWith(`${API_BASE}/m/`)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname.endsWith("supabase.co")) {
      return trimmed;
    }

    const index = parsed.pathname.indexOf(SUPABASE_PUBLIC_PATH);
    if (index < 0) {
      return trimmed;
    }

    const rest = parsed.pathname.slice(index + SUPABASE_PUBLIC_PATH.length);
    const slashIndex = rest.indexOf("/");
    if (slashIndex <= 0) {
      return trimmed;
    }

    const bucket = decodeURIComponent(rest.slice(0, slashIndex));
    const path = decodeURIComponent(rest.slice(slashIndex + 1));
    if (!bucket || !path) {
      return trimmed;
    }

    return buildMediaProxyUrl(bucket, path);
  } catch {
    return trimmed;
  }
};

export const buildUploadedImageUrl = (bucket, fileName) =>
  buildMediaProxyUrl(bucket, fileName);
