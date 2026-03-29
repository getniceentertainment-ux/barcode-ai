import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { trackId, taskData, day } = await req.json();

    const { data: track } = await supabaseAdmin.from('submissions').select('*').eq('id', trackId).single();
    
    // SURGICAL FIX: Authorize execution via the exec_bypass trump card
    if (!track || (!track.upstream_deal_signed && !track.exec_bypass && !track.rollout_purchased)) {
        throw new Error("Unauthorized.");
    }

    const logs: string[] = [];
    const execType = taskData.execution_type;

    if (taskData.auto_ad_spend > 0) {
      if (!track.upstream_deal_signed) throw new Error("Ad spend unavailable for Independent nodes.");
      logs.push(`[FINANCE] Success: Disbursed $${taskData.auto_ad_spend} from Label Advance.`);
    }

    logs.push(`[API] Success: Node Directive ${execType} deployed.`);
    
    // Advance the campaign day
    await supabaseAdmin.from('submissions').update({ campaign_day: day + 1 }).eq('id', trackId);
    
    return NextResponse.json({ success: true, logs });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}