"use client";

import React, { useState } from "react";
import { Send, Loader2, CheckCircle2, BarChart, ArrowRight, ShieldAlert, AlertCircle, Undo2, Image as ImageIcon, Smartphone } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function Room07_Distribution() {
  const { setActiveRoom, userSession, finalMaster, generatedLyrics, addToast } = useMatrixStore();
  const [trackTitle, setTrackTitle] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "analyzing" | "success">("idle");
  const [hitScore, setHitScore] = useState<number>(0);
  const [coverArtUrl, setCoverArtUrl] = useState<string>("");
  const [tiktokSnippet, setTiktokSnippet] = useState<string>("");

  const handleSubmit = async () => {
    if (!trackTitle.trim()) return;
    if (!userSession?.id) return addToast("Security Exception: User Session not found.", "error");
    
    // THE FIX: We now check for finalMaster.url, because Room 06 uploaded it to the cloud!
    if (!finalMaster?.url) return addToast("Artifact Missing: Please complete Room 06 Mastering first.", "error");

    setStatus("analyzing");

    try {
      // Send the Cloud URL to A&R API
      const analyzeRes = await fetch('/api/distribution/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trackTitle, lyrics: generatedLyrics })
      });
      
      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(analyzeData.error || "A&R Scan Failed");

      setCoverArtUrl(analyzeData.coverUrl);
      setTiktokSnippet(analyzeData.tiktokSnippet);
      setHitScore(analyzeData.hitScore);

      // Encrypt to Database Ledger 
      const { error: dbError } = await supabase
        .from('submissions')
        .insert([{
          user_id: userSession.id,
          title: trackTitle.toUpperCase(),
          audio_url: finalMaster.url, // Using the permanent cloud URL from Room 06!
          hit_score: analyzeData.hitScore,
          cover_url: analyzeData.coverUrl,
          tiktok_snippet: analyzeData.tiktokSnippet,
          status: "pending" 
        }]);

      if (dbError) throw dbError;
      
      setStatus("success");
      if(addToast) addToast("Transmission Secured. Track added to A&R Queue.", "success");

    } catch (error: any) {
      if(addToast) addToast(error.message || "Network Error during transmission.", "error");
      setStatus("idle");
    }
  };

  return (
    <div className="h-full flex flex-col justify-center max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className={`bg-[#050505] border p-8 md:p-12 rounded-lg text-center relative overflow-y-auto custom-scrollbar transition-all duration-500
        ${status === 'success' ? 'border-[#E60000] shadow-[0_0_30px_rgba(230,0,0,0.15)]' : 'border-[#222]'}`}>
        
        {status === "analyzing" && <div className="absolute inset-0 bg-[#E60000]/5 animate-pulse pointer-events-none" />}

        {status !== "success" && (
          <div className="relative z-10 mb-8">
            {status === "idle" && <Send size={64} className="mx-auto text-[#222]" />}
            {status === "analyzing" && <Loader2 size={64} className="mx-auto text-[#E60000] animate-spin" />}
          </div>
        )}
        
        {status !== "success" && (
          <h2 className="font-oswald text-4xl uppercase tracking-widest mb-10 font-bold text-white relative z-10">R07: Distribution Node</h2>
        )}
        
        {status === "idle" && (
          <div className="max-w-md mx-auto space-y-6 relative z-10">
            {!finalMaster?.url && (
              <div className="bg-[#110000] border border-[#E60000]/30 p-4 mb-6 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-3 text-[#E60000] mb-2"><AlertCircle size={18} /><span className="font-oswald text-sm uppercase font-bold tracking-widest">Master Artifact Missing</span></div>
                <p className="text-[10px] text-[#888] font-mono uppercase tracking-widest leading-relaxed mb-4 text-left">The Matrix cannot distribute a track without a finalized Master WAV. Please return to Room 06 to bake your audio.</p>
                <button onClick={() => setActiveRoom("06")} className="w-full bg-[#111] border border-[#333] text-white py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all flex items-center justify-center gap-2">
                  <Undo2 size={12} /> Return to Mastering
                </button>
              </div>
            )}

            <div className="text-left">
              <label className="text-[10px] text-[#888] font-mono uppercase tracking-widest font-bold mb-2 block">Official Track Title</label>
              <input type="text" value={trackTitle} onChange={(e) => setTrackTitle(e.target.value)} className="w-full bg-black border border-[#222] p-4 font-mono text-xs uppercase text-white outline-none focus:border-[#E60000] transition-colors" placeholder="E.g., MATRIX INFILTRATION..." />
            </div>
            
            <button onClick={handleSubmit} disabled={!trackTitle.trim() || !finalMaster?.url} className="w-full bg-[#E60000] disabled:opacity-10 disabled:grayscale text-white py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.2)]">
              {!finalMaster?.url ? "Awaiting Master File" : "Initiate A&R Scan"}
            </button>
          </div>
        )}

        {status === "analyzing" && (
          <div className="space-y-6 py-10 relative z-10">
            <p className="font-oswald text-2xl text-[#E60000] uppercase tracking-widest font-bold">A&R Neural Scan Active</p>
            <div className="font-mono text-[10px] text-[#888] uppercase tracking-widest space-y-2">
              <p className="animate-pulse">Generating DALL-E Cover Artwork...</p>
              <p>Calculating Commercial Viability Score...</p>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="animate-in zoom-in relative z-10 w-full text-left">
            <div className="flex items-center gap-4 border-b border-[#222] pb-6 mb-8">
              <CheckCircle2 size={40} className="text-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)] rounded-full" />
              <div><h3 className="font-oswald text-3xl uppercase tracking-widest text-white">Transmission Secured</h3><p className="font-mono text-[10px] text-green-500 uppercase tracking-widest mt-1">A&R Dossier Generated</p></div>
            </div>
             
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
              <div className="bg-black border border-[#222] p-4 flex flex-col group hover:border-[#E60000]/50 transition-colors">
                <div className="flex items-center gap-2 mb-4 text-[#888]"><ImageIcon size={14} className="text-[#E60000]" /><span className="text-[10px] font-mono uppercase tracking-widest font-bold">Generated Artwork</span></div>
                <div className="relative aspect-square w-full bg-[#111] overflow-hidden border border-[#333]">
                  {coverArtUrl ? <img src={coverArtUrl} alt="Cover" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" /> : <div className="flex items-center justify-center h-full text-[#333]"><ImageIcon size={48} /></div>}
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className="bg-black border border-[#222] p-6 flex flex-col items-center justify-center h-48 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                  <span className="text-[10px] font-mono text-[#888] uppercase tracking-widest mb-2 flex items-center gap-2"><BarChart size={14} className="text-[#E60000]" /> A&R Hit Score</span>
                  <div className={`text-6xl font-oswald font-bold tracking-tighter ${hitScore >= 85 ? 'text-green-500' : hitScore >= 70 ? 'text-yellow-500' : 'text-[#E60000]'}`}>{hitScore}<span className="text-2xl text-[#555]">/100</span></div>
                </div>

                <div className="bg-black border border-[#222] p-6 flex-1 flex flex-col">
                  <span className="text-[10px] font-mono text-[#888] uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-[#222] pb-2"><Smartphone size={14} className="text-white" /> TikTok Viral Snippet</span>
                  <p className="font-mono text-xs text-white leading-loose italic flex-1 flex items-center">"{tiktokSnippet}"</p>
                </div>
              </div>
            </div>

            <button onClick={() => setActiveRoom("08")} className="flex items-center justify-center w-full md:w-auto md:ml-auto gap-3 bg-white text-black px-12 py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-gray-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]">
              Proceed to The Bank <ArrowRight size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}