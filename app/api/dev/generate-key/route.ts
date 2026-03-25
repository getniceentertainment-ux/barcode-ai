import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    // 1. Verify Environment Variables are present
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[DEV API] Missing Supabase Environment Variables.");
      return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    // Initialize Admin client inside the request to ensure fresh env access
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Parse Request Body
    const body = await req.json();
    const { userId } = body;
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized: Missing User ID" }, { status: 401 });
    }

    console.log(`[DEV API] Rotating key for User: ${userId}`);

    // 3. Cryptographic Key Generation
    // Generates a secure 64-character hex string (32 bytes)
    const rawBuffer = crypto.randomBytes(32);
    const apiKey = `bc_live_${rawBuffer.toString('hex')}`;

    // 4. Update Database
    // Uses 'b2b_api_key' as per your profiles table schema
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ b2b_api_key: apiKey })
      .eq('id', userId)
      .select();

    if (error) {
      console.error("[DEV API] Supabase Update Error:", error.message);
      return NextResponse.json({ error: `Database failure: ${error.message}` }, { status: 500 });
    }

    if (!data || data.length === 0) {
      console.error("[DEV API] No profile found for ID:", userId);
      return NextResponse.json({ error: "Profile node not found in ledger" }, { status: 404 });
    }

    console.log(`[DEV API] Success: New sequence secured for ${userId}`);
    return NextResponse.json({ apiKey });

  } catch (error: any) {
    console.error("[DEV API] Fatal Route Crash:", error.message);
    return NextResponse.json({ error: "Internal processing failure" }, { status: 500 });
  }
}