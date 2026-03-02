import { supabase } from "../services/supabase.js";

export const uploadImage = async (file) => {
  const storageBucket = import.meta.env.VITE_SUPABASE_BUCKET || "xabar";
  const fileName = `${Date.now()}_${file.name}`;

  const { error } = await supabase.storage
    .from(storageBucket)
    .upload(fileName, file);

  if (error) {
    console.log(error);
    return null;
  }

  const { data } = supabase.storage.from(storageBucket).getPublicUrl(fileName);
  const publicUrl = data?.publicUrl;

  return publicUrl || null;
};
