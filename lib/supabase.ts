import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Standard Client for Auth and Real-time
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * FIREWALL: The Matrix Identity Guard
 * Prevents "id=eq.undefined" from hitting the database and causing 400 errors.
 */
export const supabaseSafe = {
  updateProfile: async (id: string | undefined | null, data: any) => {
    // 1. HARD BLOCK: If ID is missing or literally the string "undefined"
    if (!id || id === 'undefined' || id === 'null') {
      console.warn("🛡️ Matrix Identity Guard: Blocked an attempt to update a null/undefined profile.");
      return { data: null, error: "Invalid User ID" };
    }

    // 2. Only proceed if the ID is a valid UUID/String
    return await supabase
      .from('profiles')
      .update(data)
      .eq('id', id);
  }
};