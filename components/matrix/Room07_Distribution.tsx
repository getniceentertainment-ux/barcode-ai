"use client";

import React, { useState } from "react";
import { Send, Loader2, CheckCircle2, BarChart, ArrowRight, ShieldAlert, Image as ImageIcon, Globe, Zap } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";
import Link from "next/link"; 

export default function Room07_Distribution() {
  const { setActiveRoom, userSession, generatedLyrics, addToast, audioData, finalMaster } = useMatrixStore();
  
  const [trackTitle, setTrackTitle] = useState("");
  const [status, setStatus] = useState<"idle" | "analyzing" | "submitting" | "success">("idle");
  const [hitScore, setHitScore] = useState<number>(0);
  const [coverUrl, setCoverUrl] = useState<string>("");
  const [tiktokSnippet, setTiktokSnippet] = useState<string>("");

  const handleAnalyze = async () => {
    if (!trackTitle.trim()) {
      if (addToast) addToast("A track title is required for distribution.", "error");
      return;
    }
    if (!finalMaster) {
      if (addToast) addToast("No master track found. Complete Room 06 first.", "error");
      return;
    }

    setStatus("analyzing");

    try {
      // 1. Trigger the Proprietary A&R Neural Scan (AI Grading + DALL-E + TikTok Slicer)
      const analyzeRes = await fetch('/api/distribution/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: trackTitle, 
          lyrics: generatedLyrics || "No lyrics provided",
          bpm: audioData?.bpm || 120
        })
      });
      
      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(analyzeData.error || "A&R Scan Failed");

      setHitScore(analyzeData.hitScore);
      setCoverUrl(analyzeData.coverUrl);
      setTiktokSnippet(analyzeData.tiktokSnippet);
      
      // 2. Move to Final Ledger Submission
      handleFinalSubmit(analyzeData);
    } catch (error: any) {
      console.error("A&R Error:", error);
      if (addToast) addToast(error.message, "error");
      setStatus("idle");
    }
  };

  const handleFinalSubmit = async (aAndRData: any) => {
    setStatus("submitting");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // 3. Write the Artifact to the Supabase 'submissions' Table
      const res = await fetch('/api/distribution/submit', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          title: trackTitle,
          audioUrl: finalMaster?.url,
          coverUrl: aAndRData.coverUrl,
          hitScore: aAndRData.hitScore,
          tiktokSnippet: aAndRData.tiktokSnippet
        })
      });

      if (!res.ok) throw new Error("Failed to secure artifact in Ledger.");

      setStatus("success");
      if (addToast) addToast("Artifact secured. Global Nodes synchronized.", "success");
    } catch (err: any) {
      console.error("Submission Error:", err);
      if (addToast) addToast(err.message, "error");
      setStatus("idle");
    }
  };

  return (
    <div className="h-full flex flex-col justify-center max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className={`bg-[#050505] border p-12 rounded-lg text-center relative overflow-hidden transition-all duration-500
        ${status === 'success' ? 'border-[#E60000] shadow-[0_0_30px_rgba(230,0,0,0.15)]' : 'border-[#222]'}`}>
        
        {(status === "analyzing" || status === "submitting") && (
          <div className="absolute inset-0 bg-[#E60000]/5 animate-pulse pointer-events-none" />
        )}

        <div className="relative z-10 mb-8">
          {status === "idle" && <Send size={64} className="mx-auto text-[#444]" />}
          {(status === "analyzing" || status === "submitting") && <Loader2 size={64} className="mx-auto text-[#E60000] animate-spin" />}
          {status === "success" && <CheckCircle2 size={64} className="mx-auto text-green-500 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full" />}
        </div>
        
        <h2 className="font-oswald text-4xl uppercase tracking-widest mb-10 font-bold text-white relative z-10">
          R07: Distribution Node
        </h2>
        
        {status === "idle" && (
          <div className="max-w-md mx-auto space-y-6 relative z-10">
            <div className="text-left">
              <label className="text-[10px] text-[#888] font-mono uppercase tracking-widest font-bold mb-2 block">
                Official Track Title
              </label>
              <input 
                type="text" 
                value={trackTitle}
                onChange={(e) => setTrackTitle(e.target.value)}
                className="w-full bg-black border border-[#222] p-4 font-mono text-xs uppercase text-white outline-none focus:border-[#E60000] transition-colors" 
                placeholder="E.g., MATRIX INFILTRATION..." 
              />
            </div>
            
            <button 
              onClick={handleAnalyze} 
              disabled={!trackTitle.trim() || !finalMaster}
              className="w-full bg-[#E60000] disabled:opacity-30 disabled:cursor-not-allowed text-white py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.2)]"
            >
              {!finalMaster ? "Master Required" : "Submit for A&R Review"}
            </button>
            
            <div className="flex items-start gap-3 mt-6 p-4 bg-[#110000] border border-[#330000]">
              <ShieldAlert size={16} className="text-[#E60000] shrink-0 mt-0.5" />
              <p className="text-[9px] text-[#888] uppercase font-mono text-left leading-relaxed">
                By submitting, the AI A&R algorithm will analyze your master and generate social media viral snippets. High Hit Scores unlock algorithmic advances in The Bank.
              </p>
            </div>
          </div>
        )}

        {status === "analyzing" && (
          <div className="space-y-6 py-10 relative z-10">
            <p className="font-oswald text-2xl text-[#E60000] uppercase tracking-widest font-bold">A&R Neural Scan In Progress...</p>
            <div className="font-mono text-[10px] text-[#888] uppercase tracking-widest space-y-2">
              <p>Extracting sonic features...</p>
              <p>Evaluating cadence rhythm...</p>
              <p>Generating Cover Art via DALL-E 3...</p>
              <p>Isolating TikTok Viral Snippet...</p>
            </div>
          </div>
        )}

        {status === "submitting" && (
          <div className="space-y-6 py-10 relative z-10">
            <p className="font-oswald text-2xl text-white uppercase tracking-widest font-bold">Securing Artifact...</p>
            <div className="font-mono text-[10px] text-[#888] uppercase tracking-widest">
              Writing metadata to Supabase Ledger...
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="py-6 animate-in zoom-in relative z-10">
             <h3 className="font-oswald text-3xl uppercase tracking-widest mb-8 text-white">Project Finalized</h3>
             
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
               
               {/* Identity & Score Row */}
               <div className="flex flex-col md:flex-row gap-6">
                  <div className="w-full md:w-48 h-48 bg-[#111] border border-[#333] relative overflow-hidden shadow-xl shrink-0">
                    {coverUrl ? <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" /> : <ImageIcon size={32} className="m-auto text-[#333]" />}
                  </div>
                  <div className="flex-1 bg-black border border-[#222] p-6 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-mono text-[#888] uppercase tracking-widest mb-2 flex items-center gap-2">
                      <BarChart size={14} className="text-[#E60000]" /> A&R Score
                    </span>
                    <div className={`text-6xl font-oswald font-bold tracking-tighter
                      ${hitScore >= 85 ? 'text-green-500' : hitScore >= 70 ? 'text-yellow-500' : 'text-[#E60000]'}`}>
                      {hitScore}
                    </div>
                    <p className="text-[9px] font-mono uppercase mt-2 text-[#555]">
                       {hitScore >= 85 ? 'Platinum Potential' : hitScore >= 70 ? 'Gold Standard' : 'Underground Mix'}
                    </p>
                  </div>
               </div>

               {/* TikTok Viral Snippet Display */}
               <div className="bg-[#110000] border border-[#330000] p-6 text-left relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-10">
                    <Zap size={64} className="text-[#E60000]" />
                  </div>
                  <span className="text-[10px] font-mono text-[#E60000] uppercase tracking-[0.3em] font-bold mb-4 block">
                    Viral Intelligence // TikTok Snippet
                  </span>
                  <div className="font-mono text-xs text-gray-300 leading-relaxed italic whitespace-pre-wrap border-l-2 border-[#E60000] pl-4">
                    {tiktokSnippet || "Instrumental artifact. No lyrical snippet isolated."}
                  </div>
                  <p className="mt-4 text-[8px] text-[#555] uppercase tracking-widest font-mono">
                    This selection is algorithmically optimized for 15-second retention.
                  </p>
               </div>

             </div>

             <div className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto">
               <button 
                  onClick={() => setActiveRoom("08")}
                  className="flex-1 flex justify-center items-center gap-3 bg-white text-black py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                >
                  Proceed to Bank <ArrowRight size={20} />
                </button>
                <Link 
                  href={`/${encodeURIComponent(userSession?.stageName || "Artist")}`}
                  className="flex-1 flex items-center justify-center gap-3 border border-[#333] bg-black text-[#888] py-4 font-oswald text-sm font-bold uppercase tracking-widest hover:text-white hover:border-white transition-all"
                >
                  View on My Profile <Globe size={16} />
                </Link>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}