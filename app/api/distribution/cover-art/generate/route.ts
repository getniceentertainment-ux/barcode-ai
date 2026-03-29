import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60; 

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

    const { trackId, trackTitle } = await req.json();

    // SURGICAL FIX: Purged OpenAI. Switched to Together AI for FLUX.1 Generation
    if (!process.env.TOGETHER_API_KEY) {
      throw new Error("Missing TOGETHER_API_KEY in Environment Variables.");
    }

    // 1. Request the Cover Art from FLUX.1 (Rivals Midjourney, highly uncensored)
    const prompt = `A highly professional, ultra-premium album cover art for a hip-hop/rap track titled "${trackTitle || 'Untitled'}". No text. Gritty, cinematic, hyper-realistic, dark atmospheric lighting, award-winning photography, 8k resolution.`;

    const fluxRes = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "black-forest-labs/FLUX.1-schnell",
        prompt: prompt,
        width: 1024,
        height: 1024,
        steps: 4, // Schnell model is optimized for 4-step hyper-fast generation
        n: 1,
        response_format: "b64_json"
      })
    });

    const fluxData = await fluxRes.json();
    if (!fluxRes.ok) throw new Error(fluxData.error?.message || "FLUX.1 Generation Failed");

    const base64Image = fluxData.data[0].b64_json;
    if (!base64Image) throw new Error("API returned an empty image payload.");

    // 2. Decode the Base64 image into a raw Buffer
    const imageBuffer = Buffer.from(base64Image, 'base64');
    const fileName = `${user.id}/COVER_${Date.now()}.png`;
    
    // 3. Upload directly to your secure Supabase bucket
    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars') 
      .upload(fileName, imageBuffer, { contentType: 'image/png' });

    if (uploadError) throw new Error("Failed to secure image in Vault.");

    const { data: publicData } = supabaseAdmin.storage.from('avatars').getPublicUrl(fileName);
    const finalCoverUrl = publicData.publicUrl;

    // 4. Update the Ledger
    await supabaseAdmin
      .from('submissions')
      .update({ cover_url: finalCoverUrl })
      .eq('id', trackId);

    // 5. Log the Audit Transaction
    await supabaseAdmin.from('transactions').insert({
        user_id: user.id,
        amount: 0,
        type: 'GENERATION',
        description: `Distribution: FLUX.1 Cover Art Rendered`
    });

    return NextResponse.json({ coverUrl: finalCoverUrl });
  } catch (error: any) {
    console.error("Cover Art Gen Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}