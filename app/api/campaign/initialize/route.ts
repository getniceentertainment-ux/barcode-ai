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
    
    const { trackId } = await req.json();

    const { data: track } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('id', trackId)
      .single();
      
    if (!track) throw new Error("Artifact not found in ledger.");
    
    // Authorization: Must be Signed OR have Purchased the Independent SaaS
    const hasAccess = track.upstream_deal_signed || track.rollout_purchased;
    if (!hasAccess) throw new Error("Access Denied: Node not authorized.");

    const isSigned = track.upstream_deal_signed === true;

    // --- GUERRILLA vs LABEL STRATEGY ---
    const systemPrompt = `You are 'The Exec', the AI Operations Director for GetNice Records.
Generate a strict 30-day Go-To-Market rollout.
${isSigned 
  ? "ARTIST IS SIGNED: You have a $1,500 ad budget. Focus on 'auto_ad_spend' tasks." 
  : "ARTIST IS INDEPENDENT: You have a $0 budget. Generate a ruthless organic 'Guerrilla' campaign using 'social_post' and 'manual_action'."}

OUTPUT RAW JSON ONLY:
{
  "phases": { "phase_1": "Setup & Validation", "phase_2": "Strike & Amplification", "phase_3": "Commercial Extraction" },
  "daily_schedule": [
    { "day": 1, "objective": "...", "action_item": "...", "generated_copy": "...", "auto_ad_spend": 0, "execution_type": "social_post" | "auto_ad_spend" | "auto_email" | "manual_action", "status": "pending" }
  ]
}`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Title: ${track.title}` }],
        response_format: { type: "json_object" }
      })
    });

    const groqData = await groqRes.json();
    const campaignJson = JSON.parse(groqData.choices[0].message.content);

    await supabaseAdmin
      .from('submissions')
      .update({ campaign_data: campaignJson, campaign_day: 1 })
      .eq('id', trackId);

    return NextResponse.json({ success: true, data: campaignJson });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}