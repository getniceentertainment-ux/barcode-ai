import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 1. GET ROUTE: Required for Room 01 to poll the RunPod Job Status
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_MDX;

    const statusRes = await fetch(`https://api.runpod.ai/v2/${ENDPOINT_ID}/status/${jobId}`, {
      headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` }
    });
    
    return NextResponse.json(await statusRes.json());
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. POST ROUTE: Initiates the Async MDX Neural Split
export async function POST(req: Request) {
  try {
    // FORTRESS LOCKDOWN: CRYPTOGRAPHIC JWT VERIFICATION
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Security Exception: Missing Auth Token." }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Security Exception: Invalid Token." }, { status: 401 });
    }

    const body = await req.json();
    const { file_url } = body;

    if (!file_url) return NextResponse.json({ error: "Missing file_url" }, { status: 400 });

    // CHECK LEDGER CREDITS
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('credits, tier')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.tier !== 'The Mogul' && profile.credits <= 0)) {
      return NextResponse.json({ error: "Insufficient Generations." }, { status: 403 });
    }

    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_MDX;

    if (!RUNPOD_API_KEY || !ENDPOINT_ID) {
      return NextResponse.json({ error: "Server missing RunPod MDX configuration." }, { status: 500 });
    }

    // THE FIX: We pass the exact ".onnx" extension and use "/run" to bypass 90s timeouts
    const runResponse = await fetch(`https://api.runpod.ai/v2/${ENDPOINT_ID}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RUNPOD_API_KEY}` },
      body: JSON.stringify({
        input: {
          task_type: "separate",
          file_url: file_url,
          model: "UVR-MDX-NET-Voc_FT.onnx", // <-- THE FATAL GPU ERROR FIX
          userId: user.id
        }
      })
    });

    const data = await runResponse.json();

    if (data.id) {
      // Deduct toll
      if (profile.tier !== 'The Mogul') {
        await supabaseAdmin.from('profiles').update({ credits: profile.credits - 1 }).eq('id', user.id);
      }
      
      // Return Job ID to Room 01 so it can start polling!
      return NextResponse.json({ jobId: data.id });
    } else {
      throw new Error(data.error || "MDX Worker Failed to start");
    }

  } catch (error: any) {
    console.error("MDX API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}