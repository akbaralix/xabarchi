export const formatNumber = (num) => {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1).replace(".0", "") + "B";
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(".0", "") + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(".0", "") + "K";
  }
  return num;
};

export const sortMessageLinks = (message) => {
  if (!message) return "";

  const safeText = String(message)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

  const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/g;

  return safeText.replace(urlRegex, (url) => {
    const link = url.startsWith("http") ? url : `https://${url}`;
    return `<a href="${link}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
};
