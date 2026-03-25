"use client";

import React, { useState, useEffect } from "react";
import { Sliders, CheckCircle2, Activity, ArrowRight, AudioWaveform, Disc3, Download, RefreshCw, FileArchive, Loader2, Lock, DollarSign, ShieldCheck, Trash2 } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";
import JSZip from 'jszip';
import jsPDF from 'jspdf';

// Helper for wav conversion
function audioBufferToWav(buffer: AudioBuffer) {
  let numOfChan = buffer.numberOfChannels, length = buffer.length * numOfChan * 2 + 44,
      bufferArray = new ArrayBuffer(length), view = new DataView(bufferArray),
      channels = [], i, sample, offset = 0, pos = 0;
  function setUint16(data: number) { view.setUint16(pos, data, true); pos += 2; }
  function setUint32(data: number) { view.setUint32(pos, data, true); pos += 4; }
  setUint32(0x46464952); setUint32(length - 8); setUint32(0x46464952); 
  return new Blob([bufferArray], {type: "audio/wav"});
}

export default function Room06_Mastering() {
  const { audioData, vocalStems, generatedLyrics, setActiveRoom, addToast, finalMaster, setFinalMaster, userSession, clearMatrix } = useMatrixStore();
  
  const [lufs, setLufs] = useState(-14); 
  const [status, setStatus] = useState<"idle" | "processing" | "success">(finalMaster ? "success" : "idle");
  const [isZipping, setIsZipping] = useState(false);
  
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasToken, setHasToken] = useState(false);

  // FIX: Make sure BOTH Artists and Free Loaders consume tokens
  const isNonMogul = userSession?.tier !== "The Mogul";
  const isFreeLoader = userSession?.tier === "Free Loader"; // Used specifically for UI button limitations

  useEffect(() => {
    const initializeMasteringNode = async () => {
      if (!userSession) return;

      // 1. ONLY The Mogul gets a free pass unconditionally
      if (userSession.tier === "The Mogul") {
        setHasToken(true);
        setIsInitializing(false);
        return;
      }

      // 2. Database Token Check for Everyone Else
      const { data } = await supabase
        .from('profiles')
        .select('mastering_tokens, has_mastering_token')
        .eq('id', userSession.id)
        .single();

      if (data?.mastering_tokens > 0 || data?.has_mastering_token) {
        setHasToken(true);
      }

      setIsInitializing(false);
    };

    initializeMasteringNode();
  }, [userSession]);

  if (isInitializing) {
    return (
      <div className="h-full flex flex-col items-center justify-center opacity-30 animate-pulse">
        <Loader2 className="text-[#E60000] animate-spin mb-4" size={32} />
        <p className="font-mono text-[9px] uppercase tracking-widest text-[#E60000]">Verifying Ledger Authorization...</p>
      </div>
    );
  }

  const handlePurchaseToken = async () => {
    if (!userSession?.id) return;
    if(addToast) addToast("Opening Secure Gateway...", "info");
    try {
      const res = await fetch('/api/stripe/master-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userSession.id })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      if(addToast) addToast("Checkout failed.", "error");
    }
  };

  const handleMastering = async () => {
    if (!audioData?.url) { addToast("No artifact blueprint found.", "error"); return; }
    
    setStatus("processing");
    
    try {
      // --- CONSUME TOKEN IN LEDGER ---
      if (isNonMogul && userSession?.id) {
        const { data, error: fetchErr } = await supabase
          .from('profiles')
          .select('mastering_tokens, has_mastering_token')
          .eq('id', userSession.id)
          .single();

        if (fetchErr) throw fetchErr;

        if (data?.has_mastering_token) {
           await supabase.from('profiles').update({ has_mastering_token: false }).eq('id', userSession.id);
        } else if (data?.mastering_tokens && data.mastering_tokens > 0) {
           await supabase.from('profiles').update({ mastering_tokens: data.mastering_tokens - 1 }).eq('id', userSession.id);
        } else {
           throw new Error("No Mastering Token found. Please reload.");
        }
        setHasToken(false);
      }

      // Simulation of Mastering Logic
      setTimeout(() => {
          useMatrixStore.setState({ isProjectFinalized: true });
          setStatus("success");
          if(addToast) addToast("Commercial Master Exported. Token Consumed.", "success");
      }, 3000);

    } catch (err: any) {
      console.error(err);
      setStatus("idle");
      if(addToast) addToast(err.message || "Ledger sync failed.", "error");
    }
  };

  const handleStartNewProject = () => {
    if(confirm("DANGER: This will purge the Matrix state. Proceed?")) {
      clearMatrix();
      setActiveRoom("01");
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center max-w-4xl mx-auto animate-in fade-in duration-500">
      
      <div className="text-center mb-12">
        <h2 className="font-oswald text-5xl uppercase tracking-widest mb-4 font-bold text-white">R06: Mastering Suite</h2>
        <p className="font-mono text-xs text-[#555] uppercase tracking-[0.2em]">
          {status === "success" ? "Commercial Standard Reached" : "Final Output Limiters // LUFS Normalization"}
        </p>
      </div>

      {status === "idle" && (
        <div className="w-full max-w-xl bg-[#050505] border border-[#222] p-10 flex flex-col items-center rounded-lg relative overflow-hidden group hover:border-[#E60000]/50 transition-all">
          {!hasToken ? (
            <div className="w-full text-center animate-in zoom-in mb-8 relative z-10">
               <Lock size={32} className="mx-auto text-yellow-600 mb-4" />
               <h3 className="font-oswald text-xl uppercase font-bold text-white mb-2">Mastering Gated</h3>
               <p className="font-mono text-[9px] text-[#888] uppercase mb-8 leading-relaxed">Nodes require a <strong className="text-white">$4.99 Token</strong> per track to initiate the final master.</p>
               <button onClick={handlePurchaseToken} className="w-full bg-[#E60000] text-white py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-3">Purchase Token <DollarSign size={18} /></button>
            </div>
          ) : (
            <div className="w-full mb-12 relative z-10">
              <div className="flex justify-between items-center mb-10">
                 <div className="flex items-center gap-2 text-green-500 font-mono text-[10px] uppercase font-bold tracking-widest border border-green-500/20 bg-green-500/5 px-3 py-1 rounded-full"><ShieldCheck size={14} /> System Authorized</div>
                 <span className="font-oswald text-3xl font-bold text-white">{lufs} <span className="text-xs font-mono text-[#555]">LUFS</span></span>
              </div>
              <input type="range" min="-20" max="-6" step="0.5" value={lufs} onChange={(e) => setLufs(parseFloat(e.target.value))} className="w-full accent-[#E60000] h-2 bg-[#111] appearance-none cursor-pointer rounded-full" />
              <button onClick={handleMastering} className="mt-12 w-full bg-[#E60000] text-white py-5 font-oswald text-xl font-bold uppercase tracking-[0.3em] hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.2)]">Initiate Final Master</button>
            </div>
          )}
        </div>
      )}

      {status === "processing" && (
        <div className="w-full max-w-xl bg-[#050505] border border-[#E60000]/30 p-10 rounded-lg flex flex-col items-center">
          <Activity size={64} className="text-[#E60000] animate-bounce mb-8" />
          <p className="font-oswald text-xl uppercase font-bold text-white tracking-widest">Rendering Offline Context...</p>
        </div>
      )}

      {status === "success" && (
        <div className="flex flex-col items-center animate-in zoom-in duration-500 w-full max-w-xl space-y-4">
          <div className="w-full bg-[#0a0a0a] border border-[#333] p-6 flex justify-between items-center group hover:border-[#E60000] transition-colors">
             <div>
                <p className="text-[10px] text-[#E60000] font-mono uppercase tracking-widest mb-1 font-bold">Studio Export Ready</p>
                <p className="font-oswald text-xl text-white tracking-widest truncate">{audioData?.fileName || "TRACK_MASTER"}</p>
             </div>
             
             <button 
               className="bg-white text-black hover:bg-[#E60000] hover:text-white p-4 rounded-sm transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)] disabled:opacity-50 flex items-center justify-center"
             >
               {isZipping ? <Loader2 size={24} className="animate-spin" /> : 
                 isFreeLoader ? <Download size={24} /> : <FileArchive size={24} />
               }
             </button>
          </div>

          <div className="w-full flex flex-col gap-3">
            {!isFreeLoader && (
              <button onClick={() => setActiveRoom("07")} className="w-full flex justify-center items-center gap-3 bg-[#E60000] text-white py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.2)]">Route to Distribution <ArrowRight size={20} /></button>
            )}
            
            <button 
              onClick={handleStartNewProject} 
              className={`w-full border py-3 font-oswald text-xs font-bold uppercase tracking-widest transition-all flex justify-center items-center gap-2 ${isFreeLoader ? 'border-[#E60000] text-white bg-[#E60000]/10 hover:bg-[#E60000] hover:text-white' : 'border-red-900/30 text-[#555] hover:text-[#E60000]'}`}
            >
              <Trash2 size={14} /> Start New Project
            </button>
          </div>
        </div>
      )}
    </div>
  );
}