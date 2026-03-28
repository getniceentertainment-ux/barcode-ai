import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { trackId } = await req.json();

    // 1. Fetch the Target Artifact
    const { data: track, error: trackErr } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('id', trackId)
      .single();
      
    if (trackErr || !track) throw new Error("Artifact not found in ledger.");
    
    // Prevent double billing if campaign already exists
    if (track.campaign_data && Object.keys(track.campaign_data).length > 0) {
        return NextResponse.json({ success: true, data: track.campaign_data });
    }

    if (!process.env.GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY environment variable.");

    const systemPrompt = `You are 'The Exec', the AI Operations Director for GetNice Records.
Your objective is to ingest a song and automatically generate a strict 30-day Go-To-Market (GTM) rollout based on the "GetNice 30-Day Maximum Success" framework.

THE FRAMEWORK:
- Days 1-10: Setup & Validation (Infrastructure, Bio-links, 1.5s visual hooks, Email opt-ins).
- Days 11-20: Strike & Amplification (Release day, 3 clips/day, Meta Ads via Hypeddit).
- Days 21-30: Consolidation & Commercial Extraction (DM strategy, UGC harvesting, Merch/VIP up-sells).

OUTPUT FORMAT:
You MUST output ONLY a raw, valid JSON object. No markdown formatting, no conversational text, no \`\`\`json wrappers. Just the raw JSON block starting with { and ending with }.
{
  "phases": {
    "phase_1": "Setup & Validation",
    "phase_2": "Strike & Amplification",
    "phase_3": "Commercial Extraction"
  },
  "daily_schedule": [
    {
      "day": 1,
      "objective": "Short description of today's goal",
      "action_item": "Specific task (e.g., Post snippet A, Configure Hypeddit)",
      "generated_copy": "Exact text for the TikTok caption, Email, or SMS to be used today",
      "auto_ad_spend": 0
    }
  ]
}`;

    const userMessage = `Track Title: ${track.title}
Hit Score: ${track.hit_score}/100
Snippet Focus: ${track.tiktok_snippet || "Main Hook"}
Generate the exactly 30-day JSON execution array. Ensure auto_ad_spend totals exactly 1500 distributed primarily between days 11 and 25.`;

    // 2. Query the Groq Neural Network
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-70b-8192',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.2, 
        response_format: { type: "json_object" }
      })
    });

    const groqData = await groqRes.json();
    if (!groqRes.ok) throw new Error(groqData.error?.message || "LLM Generation Failed");

    // 3. Bulletproof JSON Stripping
    let rawContent = groqData.choices[0].message.content;
    
    // Mathematically extract ONLY the JSON, ignoring any hallucinated markdown or conversational text
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      rawContent = jsonMatch[0];
    }

    let campaignJson;
    try {
      campaignJson = JSON.parse(rawContent);
    } catch (e) {
      console.error("JSON Parse Failure. Raw Output:", rawContent);
      throw new Error("AI returned malformed data. Please try again.");
    }

    // 4. Save to Database with Explicit Error Catching
    const { error: updateErr } = await supabaseAdmin
      .from('submissions')
      .update({ 
        campaign_data: campaignJson,
        campaign_day: 1 
      })
      .eq('id', trackId);

    // If the columns are missing, this explicitly throws the exact error to the frontend toast
    if (updateErr) throw new Error(`Database Update Failed: ${updateErr.message}`);

    return NextResponse.json({ success: true, data: campaignJson });
  } catch (error: any) {
    console.error("Campaign Gen Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}