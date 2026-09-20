import { createClient } from '@supabase/supabase-js';

export interface SupabaseRuntimeEnv {
  readonly [key: string]: unknown;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

export function getSupabaseConfig(env: SupabaseRuntimeEnv) {
  const url = env.VITE_SUPABASE_URL?.trim();
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new Error('Supabase configuration is missing');
  }

  return { url, anonKey };
}

const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseConfig(import.meta.env);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
