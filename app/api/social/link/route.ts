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
    if (!user) return NextResponse.json({ error: "Invalid identity token" }, { status: 401 });

    if (!process.env.AYRSHARE_API_KEY) {
      throw new Error("Missing AYRSHARE_API_KEY in environment variables.");
    }

    // 1. Check if user already has an Ayrshare Profile Key
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stage_name, ayrshare_profile_key')
      .eq('id', user.id)
      .single();

    let profileKey = profile?.ayrshare_profile_key;

    // 2. If no profile key, create a new sub-profile in your Ayrshare dashboard
    if (!profileKey) {
      const createRes = await fetch('https://app.ayrshare.com/api/profiles/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: profile?.stage_name || `NODE_${user.id.substring(0,6)}` })
      });

      const createData = await createRes.json();
      if (createData.status === 'error') throw new Error(createData.message);

      profileKey = createData.profileKey;

      // Save the key to Supabase
      await supabaseAdmin
        .from('profiles')
        .update({ ayrshare_profile_key: profileKey })
        .eq('id', user.id);
    }

    // 3. Generate the OAuth JWT Link for the user to log into TikTok/Instagram
    const jwtRes = await fetch('https://app.ayrshare.com/api/profiles/generateJWT', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AYRSHARE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        privateKey: process.env.AYRSHARE_API_KEY, 
        profileKey: profileKey
      })
    });

    const jwtData = await jwtRes.json();
    if (jwtData.status === 'error') throw new Error(jwtData.message);

    // This URL will pop open the Ayrshare social linking UI
    return NextResponse.json({ url: jwtData.url });

  } catch (error: any) {
    console.error("Social Link Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}