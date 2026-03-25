import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Admin client to bypass RLS for secure credential assignment
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized: Missing User ID" }, { status: 401 });
    }

    // Generate a secure, 32-character hex string with standard B2B prefix
    const rawBuffer = crypto.randomBytes(16);
    const apiKey = `bc_live_${rawBuffer.toString('hex')}`;

    // Inject the newly generated key directly into the operator's profile
    // Column name 'b2b_api_key' strictly matches your profiles table schema
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ b2b_api_key: apiKey })
      .eq('id', userId);

    if (error) {
      console.error("Database Update Error:", error.message);
      throw error;
    }

    return NextResponse.json({ apiKey });
  } catch (error: any) {
    console.error("API Key Generation Error:", error.message);
    return NextResponse.json({ error: "Failed to generate secure API sequence" }, { status: 500 });
  }
}