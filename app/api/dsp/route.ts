import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 800;

// Initialize Supabase Admin (God Mode) to bypass RLS and read/write credits securely
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { file_url, userId } = body;

    if (!file_url || !userId) {
      return NextResponse.json({ error: "Missing file_url or userId" }, { status: 400 });
    }

    // 1. SECURITY: Check database for valid tier and credits
    const { data: profile, error: dbError } = await supabaseAdmin
      .from('profiles')
      .select('credits, tier')
      .eq('id', userId)
      .single();

    if (dbError || !profile) {
      return NextResponse.json({ error: "Security Exception: Identity not found in Ledger." }, { status: 401 });
    }

    if (profile.tier !== 'The Mogul' && profile.credits <= 0) {
      return NextResponse.json({ error: "Insufficient Generations. Please upgrade your tier." }, { status: 403 });
    }

    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_DSP;

    // 2. Call Worker 2 (Essentia CPU Node)
    const response = await fetch(`https://api.runpod.ai/v2/${ENDPOINT_ID}/runsync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNPOD_API_KEY}`
      },
      body: JSON.stringify({
        input: {
          task_type: "analyze",
          file_url: file_url
        }
      })
    });

    const data = await response.json();

    if (data.status === "COMPLETED") {
      // 3. BILLING: Deduct 1 credit if they are not on the Unlimited tier
      if (profile.tier !== 'The Mogul') {
        await supabaseAdmin
          .from('profiles')
          .update({ credits: profile.credits - 1 })
          .eq('id', userId);
      }

      return NextResponse.json(data.output);
    } else {
      throw new Error(data.error || "DSP processing failed");
    }

  } catch (error: any) {
    console.error("DSP API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}