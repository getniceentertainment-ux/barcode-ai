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

    const { data: track, error: trackErr } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('id', trackId)
      .single();
      
    if (trackErr || !track) throw new Error("Artifact not found.");
    
    // Check if campaign already exists to prevent double-billing the LLM
    if (track.campaign_data && Object.keys(track.campaign_data).length > 0) {
        return NextResponse.json({ success: true, data: track.campaign_data });
    }

    const systemPrompt = `You are 'The Exec', the AI Operations Director for GetNice Records.
Your objective is to ingest a song and automatically generate a strict 30-day Go-To-Market (GTM) rollout based on the "GetNice 30-Day Maximum Success" framework.

THE FRAMEWORK:
- Days 1-10: Setup & Validation (Infrastructure, Bio-links, 1.5s visual hooks, Email opt-ins).
- Days 11-20: Strike & Amplification (Release day, 3 clips/day, Meta Ads via Hypeddit).
- Days 21-30: Consolidation & Commercial Extraction (DM strategy, UGC harvesting, Merch/VIP up-sells).

OUTPUT FORMAT:
You MUST output ONLY a raw, valid JSON object. No markdown formatting, no conversational text.
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
    // ... Generate exactly 30 objects for days 1 through 30.
    // NOTE: Distribute exactly 1500 across the "auto_ad_spend" fields primarily between Days 11 and 25.
  ]
}`;

    const userMessage = `Track Title: ${track.title}
Hit Score: ${track.hit_score}/100
Snippet Focus: ${track.tiktok_snippet || "Main Hook"}
Generate the 30-day JSON execution array.`;

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
        temperature: 0.2, // Low temp for strict JSON adherence
        response_format: { type: "json_object" }
      })
    });

    const groqData = await groqRes.json();
    if (!groqRes.ok) throw new Error(groqData.error?.message || "LLM JSON Generation Failed");

    const campaignJson = JSON.parse(groqData.choices[0].message.content);

    // Save the living campaign to the database, starting at Day 1
    await supabaseAdmin
      .from('submissions')
      .update({ 
        campaign_data: campaignJson,
        campaign_day: 1 
      })
      .eq('id', trackId);

    return NextResponse.json({ success: true, data: campaignJson });
  } catch (error: any) {
    console.error("Campaign Gen Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}