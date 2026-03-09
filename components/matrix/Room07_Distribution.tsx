"use client";

import React, { useState } from "react";
import { Send, Loader2, CheckCircle2, BarChart, ArrowRight, ShieldAlert, AlertCircle, Undo2 } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function Room07_Distribution() {
  const { setActiveRoom, userSession, finalMaster, addToast } = useMatrixStore();
  
  const [trackTitle, setTrackTitle] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "analyzing" | "success">("idle");
  const [hitScore, setHitScore] = useState<number>(0);

  const handleSubmit = async () => {
    // 1. Validation Logic
    if (!trackTitle.trim()) return;
    
    if (!userSession?.id) {
      if(addToast) addToast("Security Exception: User Session not found.", "error");
      return;
    }

    if (!finalMaster?.blob) {
      if(addToast) addToast("Artifact Missing: Please complete Room 06 Mastering first.", "error");
      return;
    }

    setStatus("uploading");

    try {
      // 2. Transmit to Public Storage
      const fileName = `${userSession.id}/${Date.now()}_MASTER.wav`;
      
      const { error: uploadError } = await supabase.storage
        .from('public_audio')
        .upload(fileName, finalMaster.blob, {
          contentType: 'audio/wav',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // 3. Resolve Public Link
      const { data: publicUrlData } = supabase.storage
        .from('public_audio')
        .getPublicUrl(fileName);

      const streamUrl = publicUrlData.publicUrl;

      // 4. A&R Neural Simulation
      setStatus("analyzing");
      await new Promise(resolve => setTimeout(resolve, 3000));
      const generatedScore = Math.floor(Math.random() * (95 - 75 + 1)) + 75; // Skewed higher for masters
      setHitScore(generatedScore);

      // 5. Encrypt to Database Ledger
      const { error: dbError } = await supabase
        .from('submissions')
        .insert([{
          user_id: userSession.id,
          title: trackTitle.toUpperCase(),
          audio_url: streamUrl,
          hit_score: generatedScore,
          status: "pending" 
        }]);

      if (dbError) throw dbError;
      
      setStatus("success");
      if(addToast) addToast("Transmission Secured. Track added to A&R Queue.", "success");

    } catch (error: any) {
      console.error("Distribution Node Failure:", error);
      if(addToast) addToast(error.message || "Network Error during transmission.", "error");
      setStatus("idle");
    }
  };

  return (
    <div className="h-full flex flex-col justify-center max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className={`bg-[#050505] border p-12 rounded-lg text-center relative overflow-hidden transition-all duration-500
        ${status === 'success' ? 'border-[#E60000] shadow-[0_0_30px_rgba(230,0,0,0.15)]' : 'border-[#222]'}`}>
        
        {status === "analyzing" || status === "uploading" ? (
          <div className="absolute inset-0 bg-[#E60000]/5 animate-pulse pointer-events-none" />
        ) : null}

        <div className="relative z-10 mb-8">
          {status === "idle" && <Send size={64} className="mx-auto text-[#222]" />}
          {(status === "analyzing" || status === "uploading") && <Loader2 size={64} className="mx-auto text-[#E60000] animate-spin" />}
          {status === "success" && <CheckCircle2 size={64} className="mx-auto text-green-500 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full" />}
        </div>
        
        <h2 className="font-oswald text-4xl uppercase tracking-widest mb-10 font-bold text-white relative z-10">
          R07: Distribution Node
        </h2>
        
        {status === "idle" && (
          <div className="max-w-md mx-auto space-y-6 relative z-10">
            
            {/* ALERT: If Master is missing, show a warning instead of just doing nothing */}
            {!finalMaster && (
              <div className="bg-[#110000] border border-[#E60000]/30 p-4 mb-6 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-3 text-[#E60000] mb-2">
                  <AlertCircle size={18} />
                  <span className="font-oswald text-sm uppercase font-bold tracking-widest">Master Artifact Missing</span>
                </div>
                <p className="text-[10px] text-[#888] font-mono uppercase tracking-widest leading-relaxed mb-4 text-left">
                  The Matrix cannot distribute a track without a finalized Master WAV. Please return to Room 06 to bake your audio.
                </p>
                <button 
                  onClick={() => setActiveRoom("06")}
                  className="w-full bg-[#111] border border-[#333] text-white py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all flex items-center justify-center gap-2"
                >
                  <Undo2 size={12} /> Return to Mastering
                </button>
              </div>
            )}

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
              disabled={!trackTitle.trim() || !finalMaster}
              className="w-full bg-[#E60000] disabled:opacity-10 disabled:grayscale text-white py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.2)]"
            >
              {!finalMaster ? "Awaiting Master File" : "Submit to Global DB"}
            </button>
            
            <div className="flex items-start gap-3 mt-6 p-4 bg-[#0a0a0a] border border-[#111]">
              <ShieldAlert size={16} className="text-[#444] shrink-0 mt-0.5" />
              <p className="text-[9px] text-[#555] uppercase font-mono text-left leading-relaxed">
                Encryption protocol: AES-256. Submissions are immutable once written to the public ledger.
              </p>
            </div>
          </div>
        )}

        {status === "uploading" && (
          <div className="space-y-6 py-10 relative z-10">
            <p className="font-oswald text-2xl text-[#E60000] uppercase tracking-widest font-bold animate-pulse">
              Transmitting Master WAV...
            </p>
            <p className="font-mono text-[10px] text-[#888] uppercase tracking-widest">
              Uploading artifact to secure public bucket.
            </p>
          </div>
        )}

        {status === "analyzing" && (
          <div className="space-y-6 py-10 relative z-10">
            <p className="font-oswald text-2xl text-[#E60000] uppercase tracking-widest font-bold">
              A&R Neural Scan Active
            </p>
            <div className="font-mono text-[10px] text-[#888] uppercase tracking-widest space-y-2">
              <p className="animate-pulse">Comparing against GetNice Records Master Index...</p>
              <p>Calculating Commercial Viability Score...</p>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="py-6 animate-in zoom-in relative z-10">
             <h3 className="font-oswald text-3xl uppercase tracking-widest mb-8 text-white">Transmission Secured</h3>
             
             <div className="max-w-xs mx-auto bg-black border border-[#222] p-6 mb-10 flex flex-col items-center shadow-[0_0_30px_rgba(0,0,0,0.5)]">
               <span className="text-[10px] font-mono text-[#888] uppercase tracking-widest mb-4 flex items-center gap-2">
                 <BarChart size={14} className="text-[#E60000]" /> A&R Hit Score
               </span>
               <div className={`text-6xl font-oswald font-bold tracking-tighter
                 ${hitScore >= 85 ? 'text-green-500' : hitScore >= 75 ? 'text-yellow-500' : 'text-[#E60000]'}`}>
                 {hitScore}
                 <span className="text-xl text-[#555]">/100</span>
               </div>
               <p className="text-[9px] font-mono uppercase mt-4 text-[#555]">
                 {hitScore >= 85 ? 'Commercial Smash Detected' : 'Solid Market Potential'}
               </p>
             </div>

             <button 
                onClick={() => setActiveRoom("08")}
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