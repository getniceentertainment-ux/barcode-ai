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

    // Fetch the Target Artifact
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

    // --- SURGICAL FIX: IDENTIFY DEAL STATUS FOR GUERRILLA PIVOT ---
    const hasLabelDeal = track.upstream_deal_signed === true;
    const totalBudget = hasLabelDeal ? 1500 : 0;

    // ============================================================================
    // THE SELF-HEALING FALLBACK TEMPLATE
    // ============================================================================
    const generateFallback = (trackTitle: string, isSigned: boolean) => {
      const schedule = [];
      for (let i = 1; i <= 30; i++) {
        let spend = 0;
        let execType = "manual_action";
        let objective = "";
        let action = "";
        let copy = "";

        if (i <= 10) {
          objective = "Setup & Validation";
          action = "Shred anchor asset into 15s vertical clips.";
          copy = `Pre-release indexing for ${trackTitle}. Sound goes live soon.`;
        } else if (i === 11) {
          objective = "Release Day Amplification";
          action = "Blast email CRM and initiate TikTok/Reels algorithmic push.";
          spend = isSigned ? 200 : 0; // SURGICAL FIX: 0 spend for independents
          execType = isSigned ? "auto_ad_spend" : "social_post";
          copy = `OUT NOW. The wait is over. Stream ${trackTitle} via link in bio. #newmusic`;
        } else if (i >= 12 && i <= 24) {
          objective = "Algorithmic Strike";
          action = "Programmatic vertical video distribution to TikTok, IG Reels, and Shorts.";
          spend = isSigned ? 92 : 0; // SURGICAL FIX: 0 spend for independents
          execType = isSigned ? "auto_ad_spend" : "social_post";
          copy = `Wait for the drop... 🤯 Track: ${trackTitle} #independentartist`;
        } else if (i === 25) {
          objective = "Final Network Push";
          action = isSigned ? "Exhaust remaining campaign budget on viral retargeting." : "Massive Discord/Reddit raid and DM outreach.";
          spend = isSigned ? 104 : 0; 
          execType = isSigned ? "auto_ad_spend" : "manual_action";
          copy = `Trending globally. Join the movement. 🌍 Link in bio.`;
        } else {
          objective = "Commercial Extraction";
          action = "Harvest UGC and execute direct DM strategy.";
          copy = `Thank you to the Cult Fans. Exclusive access granted.`;
        }

        schedule.push({
          day: i,
          objective,
          action_item: action,
          generated_copy: copy,
          auto_ad_spend: spend,
          execution_type: execType,
          status: "pending"
        });
      }
      return {
        phases: { phase_1: "Setup & Validation", phase_2: "Strike & Amplification", phase_3: "Commercial Extraction" },
        daily_schedule: schedule
      };
    };

    let campaignJson = null;

    try {
        if (!process.env.GROQ_API_KEY) {
            console.warn("[WARNING] GROQ_API_KEY missing. Bypassing to Fallback Matrix.");
            throw new Error("API Key Missing");
        }

        // --- SURGICAL FIX: DYNAMIC GUERRILLA SYSTEM PROMPT ---
        const systemPrompt = `You are 'The Exec', the AI Operations Director for GetNice Records.
Your objective is to ingest a song and automatically generate a strict 30-day Go-To-Market (GTM) rollout based on the "GetNice 30-Day Maximum Success" framework.

THE STRATEGY CONTEXT:
${hasLabelDeal 
  ? "This artist is SIGNED to GetNice Records. They have a $1,500 digital marketing budget. You must deploy aggressive auto_ad_spend to capture fans." 
  : "This is an INDEPENDENT artist with a ZERO DOLLAR ($0) ad budget. You must rely entirely on ruthless, organic, guerrilla marketing (TikTok/Reels posting, Discord raids, DMs, email CRM)."}

THE FRAMEWORK:
- Days 1-10: Setup & Validation (Infrastructure, Bio-links, 1.5s visual hooks, Email opt-ins).
- Days 11-20: Strike & Amplification (Release day, 3 vertical clips/day posted to TikTok/IG Reels/YT Shorts via API).
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
      "action_item": "Specific task (e.g., Post snippet to TikTok, Email blast)",
      "generated_copy": "Exact text for the viral TikTok caption, Email, or SMS to be used today",
      "auto_ad_spend": 0,
      "execution_type": "auto_email" | "auto_ad_spend" | "social_post" | "manual_action",
      "status": "pending"
    }
  ]
}`;

        const userMessage = `Track Title: ${track.title}
Hit Score: ${track.hit_score}/100
Snippet Focus: ${track.tiktok_snippet || "Main Hook"}
Deal Status: ${hasLabelDeal ? "GetNice Records Upstream Partner" : "Independent Artist"}
Budget: $${totalBudget}

Generate the exactly 30-day JSON execution array. 
${hasLabelDeal 
  ? "Ensure auto_ad_spend totals exactly 1500 distributed primarily between days 11 and 25. Use execution_type: auto_ad_spend heavily." 
  : "CRITICAL DIRECTIVE: auto_ad_spend MUST be exactly 0 for all 30 days. Use 'social_post', 'auto_email', and 'manual_action' execution types exclusively."}`;

        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage }
            ],
            temperature: 0.2, 
            max_tokens: 4000, 
            response_format: { type: "json_object" }
          })
        });

        if (!groqRes.ok) throw new Error("Groq API rejected request");

        const groqData = await groqRes.json();
        let rawContent = groqData.choices[0]?.message?.content;
        
        if (!rawContent) throw new Error("Empty response from AI");
        
        rawContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) rawContent = jsonMatch[0];

        campaignJson = JSON.parse(rawContent);
        
        if (!campaignJson.daily_schedule || !Array.isArray(campaignJson.daily_schedule) || campaignJson.daily_schedule.length < 28) {
            throw new Error("AI returned malformed or incomplete array structure");
        }

    } catch (aiErr) {
        console.error("[CAMPAIGN INIT] AI Generation Failed, deploying Self-Healing Fallback:", aiErr);
        // SURGICAL FIX: Pass the deal status to the fallback generator
        campaignJson = generateFallback(track.title || "UNTITLED ARTIFACT", hasLabelDeal);
    }

    // Save to Database
    const { error: updateErr } = await supabaseAdmin
      .from('submissions')
      .update({ 
        campaign_data: campaignJson,
        campaign_day: 1 
      })
      .eq('id', trackId);

    if (updateErr) throw new Error(`Database Update Failed: ${updateErr.message}`);

    return NextResponse.json({ success: true, data: campaignJson });
  } catch (error: any) {
    console.error("Campaign Gen Fatal Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}