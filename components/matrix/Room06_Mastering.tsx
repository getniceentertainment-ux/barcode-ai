"use client";

import React, { useState, useEffect } from "react";
import { Sliders, CheckCircle2, Activity, ArrowRight, AudioWaveform, Disc3, Download, RefreshCw, FileArchive, Loader2, Lock, DollarSign, ShieldCheck } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function Room06_Mastering() {
  const { audioData, vocalStems, generatedLyrics, setActiveRoom, addToast, finalMaster, setFinalMaster, userSession } = useMatrixStore();
  const [lufs, setLufs] = useState(-14); 
  const [actualLUFS, setActualLUFS] = useState(-20); 
  const [status, setStatus] = useState<"idle" | "processing" | "uploading" | "success">(finalMaster ? "success" : "idle");
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    if (userSession?.tier === "The Mogul") setHasToken(true);
    else checkTokens();
  }, [userSession]);

  const checkTokens = async () => {
    if (!userSession?.id) return;
    const { data } = await supabase.from('profiles').select('mastering_tokens').eq('id', userSession.id).single();
    if (data && (data as any).mastering_tokens > 0) setHasToken(true);
  };

  const handleMastering = async () => {
    if (!audioData?.url || !hasToken) return;
    setStatus("processing");
    try {
      const beatResp = await fetch(audioData.url);
      const audioCtx = new AudioContext();
      const beatBuf = await audioCtx.decodeAudioData(await beatResp.arrayBuffer());
      const channelData = beatBuf.getChannelData(0);
      let sumSquares = 0;
      for (let i = 0; i < channelData.length; i++) { sumSquares += channelData[i] * channelData[i]; }
      const measuredDB = 20 * Math.log10(Math.sqrt(sumSquares / channelData.length) || 0.0001);
      setActualLUFS(Math.round(measuredDB));
      setTimeout(() => setStatus("success"), 4000);
    } catch (err) { setStatus("idle"); }
  };

  const needleRotation = ((actualLUFS - (-20)) / ((-6) - (-20))) * 90 - 45;

  return (
    <div className="h-full flex flex-col items-center justify-center max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="text-center mb-12"><h2 className="font-oswald text-5xl uppercase tracking-widest mb-4 font-bold text-white">R06: Mastering Suite</h2></div>
      <div className="w-full max-w-xl bg-[#050505] border border-[#222] p-10 flex flex-col items-center rounded-lg relative group">
        <div className="w-48 h-24 overflow-hidden relative mb-8 flex justify-center items-end border-b-2 border-[#333] bg-[#0a0a0a] rounded-t-full">
           <div className="absolute w-full h-full rounded-t-full border-t-[8px] border-l-[8px] border-r-[8px] border-[#222] z-10"></div>
           <div className="w-1 h-20 bg-[#E60000] origin-bottom transition-transform duration-1000 ease-out z-20 shadow-[0_0_10px_rgba(230,0,0,0.5)]" style={{ transform: `rotate(${needleRotation}deg)` }}></div>
           <span className="absolute bottom-2 text-[8px] font-mono text-[#555] font-bold z-0 uppercase">Integrated LUFS</span>
        </div>
        {!hasToken ? (
          <div className="w-full text-center animate-in zoom-in">
             <Lock size={32} className="mx-auto text-yellow-600 mb-4" />
             <h3 className="font-oswald text-xl uppercase font-bold text-white mb-2">Mastering Gated</h3>
             <p className="font-mono text-[9px] text-[#888] uppercase mb-8 leading-relaxed">Free nodes require a <strong className="text-white">$4.99 Token</strong> per track.</p>
             <button className="w-full bg-[#E60000] text-white py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-3">Purchase Token <DollarSign size={18} /></button>
          </div>
        ) : (
          <div className="w-full">
            <div className="flex justify-between items-center mb-10 px-4">
               <div className="flex items-center gap-2 text-green-500 font-mono text-[10px] uppercase font-bold tracking-widest border border-green-500/20 bg-green-500/5 px-3 py-1 rounded-full"><ShieldCheck size={14} /> Master Authorized</div>
               <span className="font-oswald text-3xl font-bold text-white">{lufs} <span className="text-xs text-[#555] font-mono uppercase">Target</span></span>
            </div>
            {status === "idle" && (
              <div className="space-y-8 relative z-10">
                <input type="range" min="-20" max="-6" step="0.5" value={lufs} onChange={(e) => setLufs(parseFloat(e.target.value))} className="w-full accent-[#E60000] h-2 bg-[#111] appearance-none cursor-pointer rounded-full" />
                <button onClick={handleMastering} className="w-full bg-[#E60000] text-white py-5 font-oswald text-xl font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex justify-center items-center gap-2">Initiate Render</button>
              </div>
            )}
            {status === "processing" && <div className="flex flex-col items-center py-6"><Activity size={64} className="text-[#E60000] animate-bounce mb-8"/><p className="font-mono text-[10px] text-[#E60000] uppercase animate-pulse">Scanning Transients...</p></div>}
            {status === "success" && (
              <div className="flex flex-col items-center animate-in zoom-in duration-500 w-full space-y-4">
                <button onClick={() => setActiveRoom("07")} className="w-full bg-[#E60000] text-white py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all">Route to Distribution <ArrowRight size={20} /></button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}