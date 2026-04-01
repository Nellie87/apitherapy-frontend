import { createClient } from "@/lib/supabase/client";

export async function requireSession() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
