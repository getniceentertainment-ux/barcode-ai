import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 800;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // NEW: We added `title` to the incoming payload
    const { userId, title, prompt, bpm, tag, style, gender, useSlang, blueprint } = body;

    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 401 });

    // 1. SECURITY CHECK
    const { data: profile } = await supabaseAdmin.from('profiles').select('credits, tier').eq('id', userId).single();
    if (!profile || (profile.tier !== 'The Mogul' && profile.credits <= 0)) {
      return NextResponse.json({ error: "Insufficient Generations." }, { status: 403 });
    }

    const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
    const ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_TALON;

    // 2. CONSTRUCT THE "GOD PROMPT"
    // We physically force the LLM to read the blueprint by injecting it directly into the text prompt.
    const structureString = blueprint.map((b: any) => `[${b.type}: ${b.bars} Bars]`).join("\n");
    const strictInstruction = `
You are a top-tier Ghostwriter. 
SONG TITLE: "${title || 'Untitled'}"
THEMATIC INSTRUCTION: "${prompt}"

CRITICAL RULE: You MUST strictly write ONLY the exact sections listed below. Do NOT add extra verses or hooks. Adhere to the specified bar counts.

REQUIRED STRUCTURE:
${structureString}
    `.trim();

    console.log("[TALON] Submitting Async Job...");

    // 3. START ASYNC JOB (Change from /runsync to /run)
    const runResponse = await fetch(`https://api.runpod.ai/v2/${ENDPOINT_ID}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RUNPOD_API_KEY}` },
      body: JSON.stringify({
        input: {
          task_type: "generate",
          prompt: strictInstruction, // Passing the highly strict prompt
          tag: tag,
          style: style,
          blueprint: blueprint // Still passing the array just in case your handler uses it
        }
      })
    });

    const runData = await runResponse.json();
    
    // 🚨 DIAGNOSTIC PATCH: Print exactly what RunPod said!
    console.log("🚨 RUNPOD RAW RESPONSE:", runData);

    if (!runResponse.ok || !runData.id) {
        console.error("RunPod rejected the request:", runData);
        // This sends the REAL error directly to your browser!
        return NextResponse.json({ 
            error: `RunPod Error: ${JSON.stringify(runData)}` 
        }, { status: 500 });
    }

	const jobId = runData.id;

    // 4. POLL THE STATUS (Check every 3 seconds to prevent timeout)
    let jobStatus = "IN_PROGRESS";
    let finalOutput = null;
    let attempts = 0;

    while (jobStatus === "IN_PROGRESS" || jobStatus === "IN_QUEUE") {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      attempts++;
      
      // FIX: Increased from 40 to 120 attempts (6 Minutes)
      if (attempts > 120) { 
        throw new Error("RunPod generation timed out after 6 minutes. The model is overloaded or the track is too long.");
      }

      const statusResponse = await fetch(`https://api.runpod.ai/v2/${ENDPOINT_ID}/status/${jobId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` }
      });
      
      const statusData = await statusResponse.json();
      jobStatus = statusData.status;

      if (jobStatus === "COMPLETED") {
        finalOutput = statusData.output;
        break;
      } else if (jobStatus === "FAILED") {
        console.error("RunPod Internal Job Failed:", statusData);
        throw new Error("RunPod Worker failed to generate lyrics.");
      }
    }

    // 5. CHARGE CREDIT & RETURN
    if (finalOutput) {
      if (profile.tier !== 'The Mogul') {
        await supabaseAdmin.from('profiles').update({ credits: profile.credits - 1 }).eq('id', userId);
      }
      return NextResponse.json(finalOutput);
    }

  } catch (error: any) {
    console.error("TALON API Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}