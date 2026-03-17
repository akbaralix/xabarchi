export const getPostImages = (item = {}) => {
  const images = Array.isArray(item.imageUrls)
    ? item.imageUrls.filter(Boolean)
    : Array.isArray(item.images)
      ? item.images.filter(Boolean)
      : [];
  const fallbackImage = item.imageUrl || item.image || item.img;

  if (images.length) return images;
  if (fallbackImage) return [fallbackImage];
  return [];
};
