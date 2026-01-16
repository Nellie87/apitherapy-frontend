import { supabase } from "@/lib/supabase/client";

export async function requireSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
