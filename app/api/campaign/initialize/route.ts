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

    const { data: track } = await supabaseAdmin.from('submissions').select('*').eq('id', trackId).single();
    if (!track) throw new Error("Artifact not found.");
    
    // SURGICAL FIX: The initializer accepts the exec_bypass trump card
    if (!track.upstream_deal_signed && !track.exec_bypass && !track.rollout_purchased) {
        throw new Error("Unauthorized access. Bypass not detected.");
    }

    const isSigned = track.upstream_deal_signed === true;
    const systemPrompt = `You are 'The Exec', Operations Director for GetNice Records. Generate a 30-day Go-To-Market rollout.
    ${isSigned ? "The artist is SIGNED. Use $1,500 ad budget. Focus on 'auto_ad_spend'." : "The artist is INDEPENDENT ($0 budget). Focus on 'social_post' and 'manual_action' (Guerrilla Marketing)."}
    OUTPUT RAW JSON ONLY: { "phases": { "phase_1": "Setup", "phase_2": "Strike", "phase_3": "Extraction" }, "daily_schedule": [ { "day": 1, "objective": "...", "action_item": "...", "generated_copy": "...", "auto_ad_spend": 0, "execution_type": "social_post", "status": "pending" } ] }`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Track: ${track.title}` }], response_format: { type: "json_object" } })
    });

    const groqData = await groqRes.json();
    const campaignJson = JSON.parse(groqData.choices[0].message.content);

    // Write the campaign_data back to the cell so Room 11 can read it
    await supabaseAdmin.from('submissions').update({ campaign_data: campaignJson }).eq('id', trackId);

    return NextResponse.json({ success: true, data: campaignJson });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}