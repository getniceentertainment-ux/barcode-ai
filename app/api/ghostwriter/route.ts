import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 1. GET ROUTE: Required for Room 03 to poll the Ghostwriter Job Status
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    // Prevent polling if the ID is missing
    if (!jobId || jobId === 'undefined') {
      return NextResponse.json({ error: "Missing or invalid jobId" }, { status: 400 });
    }

    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_TALON || process.env.RUNPOD_ENDPOINT_ID;

    const statusRes = await fetch(`https://api.runpod.ai/v2/${ENDPOINT_ID}/status/${jobId}`, {
      headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` },
      cache: 'no-store'
    });
    
    return NextResponse.json(await statusRes.json());
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. POST ROUTE: Initiates the TALON Ghostwriter & Deducts Dynamic Credits
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Security Exception: Missing or invalid Auth Token." }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Security Exception: Forged or Expired Token." }, { status: 401 });
    }

    const body = await req.json();
    const { prompt, title, bpm, blueprint } = body;

    // --- DYNAMIC CREDIT CHECK ---
    let cost = 1;
    if (blueprint && Array.isArray(blueprint)) {
      cost = Math.max(1, Math.ceil(blueprint.length / 2));
    }

    const { data: profile, error: dbError } = await supabaseAdmin
      .from('profiles')
      .select('credits, tier')
      .eq('id', user.id)
      .single();

    if (dbError || !profile) return NextResponse.json({ error: "Security Exception: Identity not found." }, { status: 401 });

    if (profile.tier !== 'The Mogul' && profile.credits < cost) {
      return NextResponse.json({ error: `Insufficient Credits. Need ${cost} CRD.` }, { status: 403 });
    }

    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_TALON || process.env.RUNPOD_ENDPOINT_ID;

    if (!RUNPOD_API_KEY || !ENDPOINT_ID) return NextResponse.json({ error: "Server missing TALON config." }, { status: 500 });

    const runResponse = await fetch(`https://api.runpod.ai/v2/${ENDPOINT_ID}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNPOD_API_KEY}`
      },
      body: JSON.stringify({
        input: {
          task_type: "generate_lyrics",
          prompt: prompt,
          title: title,
          bpm: bpm,
          blueprint: blueprint
        }
      })
    });

    const data = await runResponse.json();

    if (data.id) {
      // Deduct the calculated dynamic cost from the user
      if (profile.tier !== 'The Mogul') {
        await supabaseAdmin.from('profiles').update({ credits: profile.credits - cost }).eq('id', user.id);
      }
      return NextResponse.json({ jobId: data.id });
    } else {
      throw new Error(data.error || "TALON processing failed");
    }

  } catch (error: any) {
    console.error("Ghostwriter API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}