/**
 * WATTZ UP v2 - Database Client
 * Uses Supabase client for all queries (avoids pooler SASL issues)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase client for all database operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) {
  console.warn('NEXT_PUBLIC_SUPABASE_URL not set');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);