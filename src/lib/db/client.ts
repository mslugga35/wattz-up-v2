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

// Re-export for compatibility with existing code
export const db = {
  // Wrapper to match drizzle-style queries
  select: () => ({
    from: (table: string) => ({
      where: async (conditions: any) => {
        const { data, error } = await supabase.from(table).select('*');
        if (error) throw error;
        return data;
      },
    }),
  }),
};

// Helper for raw queries via Supabase RPC or direct
export async function rawQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  // For complex PostGIS queries, we'll use Supabase's rpc or direct fetch
  // For now, return empty - we'll implement specific queries as needed
  console.warn('rawQuery not fully implemented - use Supabase client directly');
  return [];
}
