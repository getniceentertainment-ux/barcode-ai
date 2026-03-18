"use client";

import React, { useState } from "react";
import { Send, Loader2, CheckCircle2, BarChart, ArrowRight, ShieldAlert, Image as ImageIcon } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";

export default function Room07_Distribution() {
  // THE FIX: Removed setIsFinalized from this list because it no longer exists in the store
  const { setActiveRoom, userSession, generatedLyrics, addToast, audioData } = useMatrixStore();
  
  const [trackTitle, setTrackTitle] = useState("");
  const [status, setStatus] = useState<"idle" | "analyzing" | "success">("idle");
  const [hitScore, setHitScore] = useState<number>(0);
  const [coverUrl, setCoverUrl] = useState<string>("");

  const handleSubmit = async () => {
    if (!trackTitle.trim()) return;
    setStatus("analyzing");

    try {
      // PROPRIETARY A&R SCANNER (LIVE)
      const analyzeRes = await fetch('/api/distribution/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: trackTitle, 
          lyrics: generatedLyrics || "No lyrics provided",
          bpm: audioData?.bpm 
        })
      });
      
      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(analyzeData.error || "A&R Scan Failed");

      setHitScore(analyzeData.hitScore);
      if (analyzeData.coverUrl) setCoverUrl(analyzeData.coverUrl);
      
      setStatus("success");
    } catch (error: any) {
      console.error("Distribution Submission Error:", error);
      if (addToast) addToast(error.message, "error");
      setStatus("idle");
    }
  };

  const handleProceed = () => {
    setActiveRoom("08");
  };

  return (
    <div className="h-full flex flex-col justify-center max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className={`bg-[#050505] border p-12 rounded-lg text-center relative overflow-hidden transition-all duration-500
        ${status === 'success' ? 'border-[#E60000] shadow-[0_0_30px_rgba(230,0,0,0.15)]' : 'border-[#222]'}`}>
        
        {/* Animated Background Overlay */}
        {status === "analyzing" && (
          <div className="absolute inset-0 bg-[#E60000]/5 animate-pulse pointer-events-none" />
        )}

        {/* Dynamic Header Icon */}
        <div className="relative z-10 mb-8">
          {status === "idle" && <Send size={64} className="mx-auto text-[#444]" />}
          {status === "analyzing" && <Loader2 size={64} className="mx-auto text-[#E60000] animate-spin" />}
          {status === "success" && <CheckCircle2 size={64} className="mx-auto text-green-500 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full" />}
        </div>
        
        <h2 className="font-oswald text-4xl uppercase tracking-widest mb-10 font-bold text-white relative z-10">
          R07: Distribution Node
        </h2>
        
        {/* IDLE STATE: Form Input */}
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
              onClick={handleSubmit} 
              disabled={!trackTitle.trim()}
              className="w-full bg-[#E60000] disabled:opacity-30 disabled:cursor-not-allowed text-white py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.2)]"
            >
              Submit for A&R Review
            </button>
            
            <div className="flex items-start gap-3 mt-6 p-4 bg-[#110000] border border-[#330000]">
              <ShieldAlert size={16} className="text-[#E60000] shrink-0 mt-0.5" />
              <p className="text-[9px] text-[#888] uppercase font-mono text-left leading-relaxed">
                By submitting, the AI A&R algorithm will analyze your master to calculate its commercial viability. High Hit Scores unlock algorithmic advances in The Bank.
              </p>
            </div>
          </div>
        )}

        {/* ANALYZING STATE: Loading UI */}
        {status === "analyzing" && (
          <div className="space-y-6 py-10 relative z-10">
            <p className="font-oswald text-2xl text-[#E60000] uppercase tracking-widest font-bold">
              A&R Neural Scan in Progress...
            </p>
            <div className="font-mono text-[10px] text-[#888] uppercase tracking-widest space-y-2">
              <p>Extracting sonic features & syllable density...</p>
              <p>Evaluating repetitive hooks & viral cadence...</p>
              <p>Generating Cover Art via DALL-E 3...</p>
            </div>
          </div>
        )}

        {/* SUCCESS STATE: Hit Score & Routing */}
        {status === "success" && (
          <div className="py-6 animate-in zoom-in relative z-10">
             <h3 className="font-oswald text-3xl uppercase tracking-widest mb-8 text-white">Transmission Received</h3>
             
             <div className="flex flex-col md:flex-row items-center justify-center gap-8 mb-10">
               
               {/* Cover Art Display */}
               <div className="w-48 h-48 bg-[#111] border border-[#333] relative overflow-hidden shadow-xl shrink-0">
                 {coverUrl ? (
                   <img src={coverUrl} alt="Cover Art" className="w-full h-full object-cover" />
                 ) : (
                   <div className="absolute inset-0 flex flex-col items-center justify-center text-[#555]">
                     <ImageIcon size={32} className="mb-2" />
                     <span className="text-[8px] font-mono uppercase tracking-widest">No Artwork</span>
                   </div>
                 )}
               </div>

               {/* Hit Score Display */}
               <div className="w-48 h-48 bg-black border border-[#222] p-6 flex flex-col items-center justify-center shrink-0">
                 <span className="text-[10px] font-mono text-[#888] uppercase tracking-widest mb-2 flex items-center gap-2">
                   <BarChart size={14} className="text-[#E60000]" /> A&R Score
                 </span>
                 <div className={`text-6xl font-oswald font-bold tracking-tighter
                   ${hitScore >= 85 ? 'text-green-500' : hitScore >= 70 ? 'text-yellow-500' : 'text-[#E60000]'}`}>
                   {hitScore}
                 </div>
                 <p className="text-[9px] font-mono uppercase mt-2 text-[#555] text-center">
                   {hitScore >= 85 ? 'Commercial Smash Detected' : hitScore >= 70 ? 'Solid Potential' : 'Underground Appeal'}
                 </p>
               </div>

             </div>

             <button 
                onClick={handleProceed}
                className="flex items-center mx-auto gap-3 bg-white text-black px-12 py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-gray-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
              >
                Proceed to The Bank <ArrowRight size={20} />
              </button>
          </div>
        )}
      </div>
    </div>
  );
}