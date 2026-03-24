import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // 1. Read the audio URL sent from Room 07
    const { audioUrl } = await req.json();

    if (!audioUrl) {
      return NextResponse.json({ error: "No audio URL provided for analysis." }, { status: 400 });
    }

    // 2. Fetch secure credentials from your Vercel .env
    const runpodEndpointId = process.env.RUNPOD_ENDPOINT_ID;
    const runpodApiKey = process.env.RUNPOD_API_KEY;

    if (!runpodEndpointId || !runpodApiKey) {
      throw new Error("Missing RunPod environment variables.");
    }

    // 3. Construct the RunPod Serverless URL 
    const runpodUrl = `https://api.runpod.ai/v2/${runpodEndpointId}/runsync`;

    // 4. Fire the payload to your Essentia Worker
    const response = await fetch(runpodUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${runpodApiKey}`
      },
      body: JSON.stringify({
        input: {
          audio_url: audioUrl
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RunPod API Error: ${errorText}`);
    }

    // 5. Return the Essentia analysis back to Room 07
    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("RunPod Relay Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}