import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { trackId, taskData, day } = await req.json();

    const { data: track } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('id', trackId)
      .single();
      
    if (!track || (!track.upstream_deal_signed && !track.rollout_purchased)) {
        throw new Error("Node not authorized for execution.");
    }

    const logs: string[] = [];
    const execType = taskData.execution_type;

    // Financial Lock: Ad spend only works for signed partners with the $1,500 advance
    if (taskData.auto_ad_spend > 0) {
      if (!track.upstream_deal_signed) {
        throw new Error("Ad budget requires an Upstream Deal. Switch to organic guerrilla tactics.");
      }
      logs.push(`[FINANCE] Authorized: Disbursed $${taskData.auto_ad_spend} from Label Reserve.`);
    }

    logs.push(`[DIRECTIVE] Success: Node ${execType} deployed globally.`);
    
    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}