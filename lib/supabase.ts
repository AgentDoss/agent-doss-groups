import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Variables NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY manquantes.");
  }
  return { url, anon };
}

let browserClient: SupabaseClient | null = null;

// Client navigateur : créé au premier usage, jamais à l'import.
export function getSupabase(): SupabaseClient {
  if (!browserClient) {
    const { url, anon } = env();
    browserClient = createClient(url, anon);
  }
  return browserClient;
}

// Client serveur agissant au nom de l'utilisateur (le RLS s'applique).
export function supabaseForToken(token: string): SupabaseClient {
  const { url, anon } = env();
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
