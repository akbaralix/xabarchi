import { supabase } from "../services/supabase.js";
import { buildUploadedImageUrl } from "../services/imageUrl.js";

export const uploadImage = async (file) => {
  const storageBucket = import.meta.env.VITE_SUPABASE_BUCKET || "xabar";
  const sourceName = String(file?.name || "").toLowerCase();
  const typeExt = String(file?.type || "").split("/")[1] || "";
  const nameExt = sourceName.includes(".") ? sourceName.split(".").pop() : "";
  const ext = (nameExt || typeExt || "jpg").replace(/[^a-z0-9]/g, "");
  const uniqueId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 10);
  const fileName = `img_${Date.now()}_${uniqueId}.${ext || "jpg"}`;

  const { error } = await supabase.storage
    .from(storageBucket)
    .upload(fileName, file);

  if (error) {
    console.log(error);
    return null;
  }

  return buildUploadedImageUrl(storageBucket, fileName);
};
