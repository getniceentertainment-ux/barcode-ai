import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // 1. FORTRESS LOCKDOWN: CRYPTOGRAPHIC JWT VERIFICATION
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Security Exception: Missing or invalid Auth Token." }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Security Exception: Forged or Expired Token." }, { status: 401 });
    }

    // STRICT OVERRIDE: We extract the ID directly from the verified token. 
    // We no longer trust any userId passed in the JSON payload.
    const userId = user.id;

    const body = await req.json();
    const { file_url } = body;

    if (!file_url) {
      return NextResponse.json({ error: "Missing file_url" }, { status: 400 });
    }

    // 2. CHECK LEDGER CREDITS
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

    if (!RUNPOD_API_KEY || !ENDPOINT_ID) {
      return NextResponse.json({ error: "Server missing RunPod DSP configuration." }, { status: 500 });
    }

    // 3. CALL WORKER 2
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
      // 4. BILLING
      if (profile.tier !== 'The Mogul') {
        await supabaseAdmin.from('profiles').update({ credits: profile.credits - 1 }).eq('id', userId);
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