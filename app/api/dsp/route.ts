import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 1. GET ROUTE: Required for Room 01 to poll the DSP Job Status
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_DSP;

    const statusRes = await fetch(`https://api.runpod.ai/v2/${ENDPOINT_ID}/status/${jobId}`, {
      headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` }
    });
    
    return NextResponse.json(await statusRes.json());
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. POST ROUTE: Initiates the Async DSP Analysis
export async function POST(req: Request) {
  try {
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

    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_DSP;

    if (!RUNPOD_API_KEY || !ENDPOINT_ID) {
      return NextResponse.json({ error: "Server missing RunPod DSP configuration." }, { status: 500 });
    }

    // THE FIX: Use "/run" to bypass Vercel's 10-second timeout
    const runResponse = await fetch(`https://api.runpod.ai/v2/${ENDPOINT_ID}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RUNPOD_API_KEY}` },
      body: JSON.stringify({
        input: {
          task_type: "analyze",
          file_url: file_url
        }
      })
    });

    const data = await runResponse.json();

    if (data.id) {
      // Return Job ID to Room 01 so it can start polling
      return NextResponse.json({ jobId: data.id });
    } else {
      throw new Error(data.error || "DSP Worker Failed to start");
    }

  } catch (error: any) {
    console.error("DSP API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}