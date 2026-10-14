import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured: boolean = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'your_supabase_url' &&
  supabaseAnonKey !== 'your_supabase_anon_key'
);

let _supabase: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  _supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      headers: {
        'X-Client-Info': 'bar-os-app@1.0.0',
      },
    },
  });
}

export const supabase: SupabaseClient | null = _supabase;

if (!isSupabaseConfigured && typeof window !== 'undefined') {
  console.warn(
    '[Supabase] Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file. ' +
    'Without these, the application cannot persist data to the database.'
  );
}
