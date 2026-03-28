import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// SURGICAL CONFIG: Vercel Pro/Enterprise allows longer cron executions. 
// We set this to the maximum (300 seconds / 5 mins) to ensure it can process the whole roster.
export const maxDuration = 300; 

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // 1. CRITICAL SECURITY GUARD
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized Cron Trigger" }, { status: 401 });
    }

    console.log("[CRON NODE] Waking up. Initiating Daily Label Execution Protocol...");

    // 2. FETCH ALL ACTIVE CAMPAIGNS
    // SURGICAL FIX: Added stage_name to the select query to satisfy TypeScript
    const { data: activeCampaigns, error: fetchErr } = await supabaseAdmin
      .from('submissions')
      .select('id, user_id, title, hit_score, campaign_data, campaign_day, audio_url, cover_url, stage_name')
      .eq('upstream_deal_signed', true)
      .gt('campaign_day', 0)
      .lt('campaign_day', 30);

    if (fetchErr) throw fetchErr;
    if (!activeCampaigns || activeCampaigns.length === 0) {
      console.log("[CRON NODE] No active campaigns require execution today.");
      return NextResponse.json({ success: true, message: "No active campaigns." });
    }

    console.log(`[CRON NODE] Found ${activeCampaigns.length} active campaigns. Processing...`);

    const executionLogs = [];

    // 3. EXECUTE DAILY DIRECTIVES LOOP
    for (const campaign of activeCampaigns) {
      const currentDay = campaign.campaign_day;
      const taskData = campaign.campaign_data?.daily_schedule?.[currentDay - 1];
      const nextDay = currentDay + 1;
      
      if (!taskData) continue;

      const execType = taskData.execution_type || "manual_action";
      console.log(`Processing Node ${campaign.user_id} - Day ${currentDay} (${execType})`);

      try {
        // --- A. AUTOMATED AD SPEND ---
        if (execType === "auto_ad_spend" || taskData.auto_ad_spend > 0) {
          const spendAmount = taskData.auto_ad_spend || 0;
          if (spendAmount > 0) {
            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('marketing_credits')
              .eq('id', campaign.user_id)
              .single();

            const currentCredits = profile?.marketing_credits || 0;
            if (currentCredits >= spendAmount) {
              await supabaseAdmin.from('profiles').update({ marketing_credits: currentCredits - spendAmount }).eq('id', campaign.user_id);
              await supabaseAdmin.from('transactions').insert({ user_id: campaign.user_id, amount: -spendAmount, type: 'AD_CAMPAIGN_SPEND', description: `Automated Ad Deploy: Day ${currentDay} Boost` });
              await supabaseAdmin.from('submissions').update({ hit_score: (campaign.hit_score || 0) + Math.floor(spendAmount / 100) }).eq('id', campaign.id);
            }
          }
        }

        // --- B. AUTOMATED EMAIL BLAST ---
        if (execType === "auto_email" && process.env.SENDGRID_API_KEY) {
          const { data: profile } = await supabaseAdmin.from('profiles').select('email').eq('id', campaign.user_id).single();
          if (profile?.email) {
            await fetch('https://api.sendgrid.com/v3/mail/send', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                personalizations: [{ to: [{ email: profile.email }] }],
                from: { email: "agent@bar-code.ai", name: "GetNice Exec" },
                subject: `Campaign Directive: ${campaign.title}`,
                content: [{ type: "text/plain", value: taskData.generated_copy }]
              })
            });
          }
        }

        // --- C. REAL API: CREATOMATE & AYRSHARE (VIDEO RENDER & SOCIAL POST) ---
        if (execType === "social_post" && process.env.CREATOMATE_API_KEY && process.env.AYRSHARE_API_KEY) {
           console.log(`[CRON] Initiating Video Render via Creatomate for ${campaign.title}...`);
           
           // SURGICAL FIX: Removed the ayrshare_profile_key check. 
           // We are now deploying directly to the GetNice Records primary social accounts.
           if (!campaign.audio_url || !campaign.cover_url) {
             throw new Error("Missing audio or cover asset for video generation.");
           }

           // STEP 1: RENDER THE VIDEO (Creatomate)
           const renderRes = await fetch('https://api.creatomate.com/v1/renders', {
             method: 'POST',
             headers: {
               'Authorization': `Bearer ${process.env.CREATOMATE_API_KEY}`,
               'Content-Type': 'application/json'
             },
             body: JSON.stringify({
               source: {
                 output_format: "mp4",
                 width: 1080,
                 height: 1920,
                 duration: 15, // Creates a 15-second viral snippet
                 elements: [
                   { type: "image", source: campaign.cover_url, scale_mode: "cover" },
                   { type: "audio", source: campaign.audio_url, duration: 15 }
                 ]
               }
             })
           });

           if (!renderRes.ok) throw new Error("Creatomate Render API Rejected.");
           const renderData = await renderRes.json();
           let renderId = renderData[0].id;
           let renderStatus = renderData[0].status;
           let finalVideoUrl = renderData[0].url;

           // Poll Creatomate until the MP4 is fully rendered (usually takes ~8 seconds)
           console.log(`[CRON] Rendering MP4 (ID: ${renderId}). Awaiting completion...`);
           while (renderStatus !== 'succeeded' && renderStatus !== 'failed') {
             await new Promise(r => setTimeout(r, 4000)); // Wait 4 seconds between checks
             const checkRes = await fetch(`https://api.creatomate.com/v1/renders/${renderId}`, {
               headers: { 'Authorization': `Bearer ${process.env.CREATOMATE_API_KEY}` }
             });
             const checkData = await checkRes.json();
             renderStatus = checkData.status;
             if (renderStatus === 'succeeded') finalVideoUrl = checkData.url;
           }

           if (renderStatus === 'failed' || !finalVideoUrl) throw new Error("Creatomate Video Render Failed.");
           console.log(`[CRON] Video Rendered Successfully: ${finalVideoUrl}`);

           // SURGICAL FIX: Append the artist's stage name so they get credit on the Label's timeline
           const labelCaption = `${taskData.generated_copy}\n\nArtist: ${campaign.stage_name || 'GetNice Node'}\nLabel: GetNice Records`;

           // STEP 2: POST TO TIKTOK/INSTAGRAM (Ayrshare)
           console.log(`[CRON] Pushing generated MP4 to Ayrshare Social APIs...`);
           const postRes = await fetch('https://app.ayrshare.com/api/post', {
             method: 'POST',
             headers: {
               'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
               // Removed the 'Profile-Key' header. This forces Ayrshare to use your Premium Label Account.
               'Content-Type': 'application/json'
             },
             body: JSON.stringify({
               post: labelCaption, 
               platforms: ["tiktok", "instagram"],
               mediaUrls: [finalVideoUrl]
             })
           });

           if (!postRes.ok) {
             const errData = await postRes.json();
             throw new Error(`Ayrshare Post Failed: ${errData.message || "Unknown API Error"}`);
           }

           console.log(`[CRON] SUCCESS: Automated Social Payload Delivered for ${campaign.title}.`);
           executionLogs.push(`Social video successfully rendered and posted for track ${campaign.id}`);
        }

        // --- D. ADVANCE THE LEDGER ---
        const updatedCampaignData = { ...campaign.campaign_data };
        if (updatedCampaignData.daily_schedule && updatedCampaignData.daily_schedule[currentDay - 1]) {
          updatedCampaignData.daily_schedule[currentDay - 1].status = "completed";
        }

        await supabaseAdmin
          .from('submissions')
          .update({ campaign_day: nextDay, campaign_data: updatedCampaignData })
          .eq('id', campaign.id);

        executionLogs.push(`Successfully processed Day ${currentDay} for track ${campaign.id}`);

      } catch (nodeErr: any) {
        console.error(`[CRON NODE FATAL] Failed processing ${campaign.id}:`, nodeErr.message);
        executionLogs.push(`Failed processing track ${campaign.id}: ${nodeErr.message}`);
      }
    }

    console.log("[CRON NODE] Operations Concluded.");
    return NextResponse.json({ success: true, processed: activeCampaigns.length, logs: executionLogs });

  } catch (error: any) {
    console.error("[CRON NODE] Global Execution Failure:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}