import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 🛡️ THE MATRIX FIREWALL 🛡️
 * This wrapper prevents the "id=eq.undefined" 400 error by validating the ID 
 * before any profile update is allowed to hit the network.
 */
export const updateProfileSafe = async (id: string | undefined | null, data: any) => {
  // If ID is missing, literally the string "undefined", or null, ABORT.
  if (!id || id === 'undefined' || id === 'null') {
    // We log a quiet warning instead of letting Postgres throw a loud 400 error.
    console.warn("Sync Blocked: Profile ID is currently undefined. Waiting for Auth...");
    return { data: null, error: "Invalid ID" };
  }

  return await supabase
    .from('profiles')
    .update(data)
    .eq('id', id);
};