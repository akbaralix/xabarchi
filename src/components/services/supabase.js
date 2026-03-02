import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://ywnfotaahcdwxnkzylbd.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_g3HaxaP95EZH5snI-DjLpQ_t3NT2He8";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
