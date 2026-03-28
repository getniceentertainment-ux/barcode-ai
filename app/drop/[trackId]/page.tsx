"use client";

import React, { useState, useEffect } from "react";
import { Disc3, Mail, Lock, ArrowRight, Loader2, Play, CheckCircle2 } from "lucide-react";
import { supabase } from "../../../lib/supabase";

export default function DropPage({ params }: { params: { trackId: string } }) {
  const [track, setTrack] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDrop = async () => {
      try {
        // Fetch the track AND the artist's stage name in one query
        const { data, error } = await supabase
          .from('submissions')
          .select('id, title, cover_url, audio_url, user_id, profiles(stage_name)')
          .eq('id', params.trackId)
          .single();

        if (error || !data) throw new Error("Artifact not found.");
        setTrack(data);
      } catch (err) {
        setError("This drop link is invalid or has expired.");
      } finally {
        setLoading(false);
      }
    };
    fetchDrop();
  }, [params.trackId]);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    
    setSubmitting(true);
    setError("");

    try {
      const { error: insertErr } = await supabase
        .from('fans')
        .insert({
          artist_id: track.user_id,
          email: email.toLowerCase()
        });

      // Ignore duplicate email errors (code 23505), just show success anyway so the fan is happy
      if (insertErr && insertErr.code !== '23505') throw insertErr;
      
      setSuccess(true);
    } catch (err: any) {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-[#E60000]" size={48} /></div>;
  if (error && !track) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-[#888] font-mono uppercase tracking-widest">{error}</div>;

  const artistName = track.profiles?.stage_name || "Unknown Artist";

  return (
    <div className="min-h-screen bg-[#050505] text-white font-mono selection:bg-[#E60000] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* Dynamic Background Blur */}
      {track.cover_url && (
        <div 
          className="absolute inset-0 opacity-20 blur-3xl scale-110 pointer-events-none"
          style={{ backgroundImage: `url(${track.cover_url})`, backgroundPosition: 'center', backgroundSize: 'cover' }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent pointer-events-none" />

      <div className="relative z-10 w-full max-w-md flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {/* Cover Art Box */}
        <div className="w-64 h-64 bg-black border-2 border-[#222] mb-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative group">
          {track.cover_url ? (
            <img src={track.cover_url} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#333]"><Disc3 size={64}/></div>
          )}
          
          {track.audio_url && (
             <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                <audio controls src={track.audio_url} className="w-48 outline-none grayscale invert opacity-90" controlsList="nodownload noplaybackrate" />
             </div>
          )}
        </div>

        <div className="text-center mb-8 w-full">
          <p className="text-[10px] text-[#E60000] uppercase tracking-[0.3em] font-bold mb-2">Exclusive VIP Drop</p>
          <h1 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white mb-2 leading-tight">
            {track.title}
          </h1>
          <p className="text-sm text-[#888] uppercase tracking-widest">By {artistName}</p>
        </div>

        {success ? (
          <div className="w-full bg-[#111] border border-green-500/30 p-8 text-center animate-in zoom-in-95">
            <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
            <h3 className="font-oswald text-2xl uppercase tracking-widest text-white mb-2">Access Granted</h3>
            <p className="text-[10px] text-[#888] uppercase tracking-widest leading-relaxed">
              You are officially on the secure node. Check your inbox for exclusive updates and the full unreleased artifact.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubscribe} className="w-full space-y-4">
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ENTER EMAIL ADDRESS..." 
                className="w-full bg-black border border-[#333] py-4 pl-12 pr-4 text-xs font-bold text-white uppercase tracking-widest outline-none focus:border-[#E60000] transition-colors placeholder:text-[#444]"
              />
            </div>
            {error && <p className="text-[10px] text-[#E60000] uppercase tracking-widest text-center">{error}</p>}
            <button 
              type="submit" 
              disabled={submitting}
              className="w-full bg-[#E60000] text-white py-4 text-xs font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-red-700 transition-colors shadow-[0_0_20px_rgba(230,0,0,0.3)] disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <><Lock size={16} /> Unlock Full Track</>}
            </button>
            <p className="text-[8px] text-[#555] uppercase tracking-widest text-center mt-4">
              Powered by GetNice Records // Secure Matrix Protocol
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
```

### 3. Surgical Update to the Cron Executor
Now that we are capturing real fan emails, we need to tell the Cron Job to blast *them*, instead of just emailing the artist.

Open your **`app/api/cron/daily-execution/route.ts`** file, scroll down to **Section B (AUTOMATED EMAIL BLAST)**, and surgically replace *only* that block with this:

```typescript
        // --- B. AUTOMATED EMAIL BLAST (BLASTING TO THE FAN CRM) ---
        if (execType === "auto_email" && process.env.SENDGRID_API_KEY) {
          // 1. Fetch all fans subscribed to this specific artist
          const { data: fans } = await supabaseAdmin
            .from('fans')
            .select('email')
            .eq('artist_id', campaign.user_id);

          // 2. Only fire the API if they actually have fans
          if (fans && fans.length > 0) {
            
            // Format for SendGrid: Array of objects, max 1000 per blast
            const personalizations = fans.map(fan => ({
              to: [{ email: fan.email }]
            }));

            await fetch('https://api.sendgrid.com/v3/mail/send', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                personalizations: personalizations,
                from: { email: "agent@bar-code.ai", name: "GetNice Exec" },
                subject: `Exclusive Update: ${campaign.title}`,
                content: [{ type: "text/plain", value: taskData.generated_copy }]
              })
            });
            console.log(`[CRON] Mass Email dispatched to ${fans.length} fans for Node ${campaign.user_id}.`);
          } else {
            console.log(`[CRON] Notice: Node ${campaign.user_id} has 0 fans in CRM. Email bypassed.`);
          }
        }