export const buildPostLink = (postId) => {
  if (!postId) return "";
  const encoded = encodeURIComponent(String(postId));
  if (typeof window === "undefined") return `/post/${encoded}`;
  return `${window.location.origin}/post/${encoded}`;
};

const fallbackCopy = (text) =>
  new Promise((resolve, reject) => {
    try {
      const input = document.createElement("textarea");
      input.value = text;
      input.setAttribute("readonly", "readonly");
      input.style.position = "fixed";
      input.style.left = "-9999px";
      document.body.appendChild(input);
      input.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(input);
      if (!ok) throw new Error("copy_failed");
      resolve();
    } catch (err) {
      reject(err);
    }
  });

export const copyPostLink = async (postId) => {
  const link = buildPostLink(postId);
  if (!link) throw new Error("no_link");
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(link);
    return link;
  }
  await fallbackCopy(link);
  return link;
};
