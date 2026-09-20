import { describe, expect, it } from 'vitest';
import { getSupabaseConfig } from './supabase';

describe('Supabase runtime configuration', () => {
  it('fails closed when required public configuration is missing', () => {
    expect(() => getSupabaseConfig({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' })).toThrow(
      'Supabase configuration is missing'
    );
  });

  it('returns validated configuration when required values exist', () => {
    expect(getSupabaseConfig({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-key',
    })).toEqual({
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
    });
  });
});
