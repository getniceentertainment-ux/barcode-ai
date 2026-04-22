"use client";

import React, { useState, useRef, useEffect } from "react";
import { UploadCloud, FileAudio, Loader2, CheckCircle2, AlertTriangle, ShieldCheck, Music, ArrowRight, Zap, Activity, Network, Play, Pause } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

// --- SURGICAL ADDITION: The Silent Extractor ---
// This grabs the exact floating-point duration of the file without the user knowing
const getExactAudioDuration = (url: string): Promise<number> => {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => {
      resolve(audio.duration);
    });
    audio.addEventListener('error', () => {
      resolve(0); 
    });
  });
};

export default function Room01_Lab() {
  const { audioData, setAudioData, setActiveRoom, addToast, userSession } = useMatrixStore();
  
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "analyzing" | "success">(audioData ? "success" : "idle");
  const [isDisclaimerAccepted, setIsDisclaimerAccepted] = useState(false);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  
  // Audio Preview State
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollDSPJob = async (jobId: string) => {
    let attempts = 0;
    const maxAttempts = 60;

    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        setStatus("idle");
        if (addToast) addToast("DSP Processing timed out.", "error");
        return;
      }

      const { data, error } = await supabase
  .from('dsp_jobs')
  .select('*')
  .eq('id', jobId)
  .maybeSingle();

      if (data?.status === 'completed') {
        clearInterval(interval);
        setAudioData(data.result_data); // This loads the stems into the Bar-Code.ai Forge
        setStatus("success");
        if (addToast) addToast("Beat processed and loaded!", "success");
      } else if (data?.status === 'failed') {
        clearInterval(interval);
        setStatus("idle");
        if (addToast) addToast("DSP Extraction failed.", "error");
      }
    }, 2000);
  };

  // Hardcoded beats removed - relying purely on Supabase Fetch
  const [beats, setBeats] = useState<any[]>([]);

  // --- RESTORING CORE UPLOAD LOGIC ---
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  
  // Clean up polling intervals and audio on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.src = "";
      }
    };
  }, []);

  // FETCH REAL BEATS FROM SUPABASE BUCKET
  useEffect(() => {
    const fetchMarketplaceBeats = async () => {
      try {
        const { data, error } = await supabase.storage.from('marketplace_beats').list();
        if (error) throw error;
        
        if (data && data.length > 0) {
          const fetchedBeats = data
            .filter(file => file.name.endsWith('.mp3') || file.name.endsWith('.wav'))
            .map((file, index) => {
              const bpmMatch = file.name.match(/_?(\d+)\s*BPM/i);
              const bpm = bpmMatch ? parseInt(bpmMatch[1]) : 120;
              
              let calculatedLeasePrice = 29.99;
              if (bpm >= 140) calculatedLeasePrice = 149.99;
              else if (bpm >= 125) calculatedLeasePrice = 99.99;
              else if (bpm >= 110) calculatedLeasePrice = 49.99;

              const { data: urlData } = supabase.storage.from('marketplace_beats').getPublicUrl(file.name);
              const cleanTitle = file.name.replace(/\.(mp3|wav)$/i, '').replace(/_?\d+\s*BPM/i, '').replace(/_/g, ' ').trim();
              
              return { 
                id: `supa_${index}`, 
                title: cleanTitle || file.name, 
                producer: "GetNice Node", 
                url: urlData.publicUrl, 
                leasePrice: calculatedLeasePrice,
                exclusivePrice: 500.00, 
                bpm: bpm,
                key: "Unknown"
              };
            });
          
          if (fetchedBeats.length > 0) {
            setBeats(prev => {
              const existingUrls = new Set(prev.map(p => p.url));
              const newBeats = fetchedBeats.filter(fb => !existingUrls.has(fb.url));
              return [...prev, ...newBeats];
            });
          }
        }
      } catch (err) {
        console.error("Failed to load beats from Supabase marketplace:", err);
      }
    };
    
    fetchMarketplaceBeats();
  }, []);

   // --- RESTORING THE MISSING PREVIEW LOGIC ---
  const [previewProgress, setPreviewProgress] = useState(0);
  const handlePreviewTimeUpdate = () => {
    if (previewAudioRef.current) {
      const current = previewAudioRef.current.currentTime;
      const total = previewAudioRef.current.duration;
      if (total > 0) {
        setPreviewProgress((current / total) * 100);
      }
    }
  };

  // --- GLOBAL FREE LEASE OVERRIDE (Room 01 Forge) ---
  const IS_FREE_LEASE_DAY = true;

  const handleFreeLeaseFulfillment = async (beat: any) => {
    if (addToast) addToast(`Open Market Access: ${beat.title} Lease acquired!`, "info");
    
    // 1. Log the lead in your new free_acquisitions table
    try {
      await supabase.from('free_acquisitions').insert({
        user_id: userSession?.id,
        beat_id: beat.id,
        beat_name: beat.title,
        acquired_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn("Lead telemetry skipped:", e);
    }

    // 2. Pass the Supabase URL to the DSP extraction engine
    // We use beat.url because that was generated by getPublicUrl in your mapping loop
    handlePurchasedBeatDSP(beat.url, `${beat.title}_Lease.mp3`);
  };

  const handleMarketplaceSelect = async (beat: any, licenseType: 'lease' | 'exclusive') => {
    if (!isDisclaimerAccepted) {
      if (addToast) addToast("Please accept the IP & Licensing Declaration below first.", "error");
      return;
    }
    
    if (previewAudioRef.current) previewAudioRef.current.pause();
    setPlayingPreview(null);

    if (licenseType === 'lease' && IS_FREE_LEASE_DAY) {
      handleFreeLeaseFulfillment(beat);
      return;
    }

    // Standard Stripe flow for Exclusives
    setStatus("analyzing"); 
    try {
      const res = await fetch('/api/stripe/beat-lease', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beatName: licenseType === 'lease' ? `${beat.title} (Lease)` : `${beat.title} (Exclusive Buyout)`,
          beatUrl: beat.url,
          price: licenseType === 'lease' ? beat.leasePrice : beat.exclusivePrice,
          userId: userSession?.id
        })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      if (addToast) addToast(err.message, "error");
      setStatus("idle");
    }
  };

  // HANDLE RETURNING USERS AFTER SUCCESSFUL STRIPE LEASE
  const handlePurchasedBeatDSP = async (url: string, fileName: string) => {
    setStatus("analyzing");
    try {
      // 1. Trigger the actual RunPod Worker via your Next.js API route
      const response = await fetch('/api/dsp/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url, 
          fileName, 
          userId: userSession?.id,
          isFreeLease: true // Flag to tell the backend to skip Stripe checks
        })
      });

      const result = await response.json();
      
      // 2. Start polling for the ID returned by the worker
      if (result.jobId) {
        pollDSPJob(result.jobId); 
      } else {
        throw new Error("No JobID returned from DSP engine");
      }
    } catch (err) {
      console.error("DSP Trigger Error:", err);
      if (addToast) addToast("Failed to wake up the DSP worker.", "error");
      setStatus("idle");
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-8 animate-in fade-in duration-500">
      
      {/* Hidden audio player for 60s beat previews */}
      <audio 
        ref={previewAudioRef} 
        onTimeUpdate={handlePreviewTimeUpdate}
        onEnded={() => setPlayingPreview(null)}
        className="hidden" 
      />

      {/* LEFT COLUMN: UPLOAD & DSP */}
      <div className="flex-1 flex flex-col">
        <div className="mb-6">
          <h2 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white flex items-center gap-3">
            <UploadCloud className="text-[#E60000]" /> Room 01 // The Lab
          </h2>
          <p className="font-mono text-[10px] text-[#888] uppercase tracking-widest mt-2">
            Initialize Digital Signal Processing (DSP) & BPM Extraction
          </p>
        </div>

        <div 
          className={`flex-1 border-2 border-dashed rounded-lg text-center relative overflow-hidden flex flex-col items-center justify-center min-h-[400px] transition-all group
            ${status === 'idle' ? 'border-[#222] bg-[#050505] hover:border-[#E60000]' : 'border-[#E60000] bg-[#110000] border-solid'}`}
          onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
          onClick={() => {
            if (status !== 'idle') return;
            if (!isDisclaimerAccepted) {
              if (addToast) addToast("Please accept the IP & Licensing Declaration below first.", "error");
              return;
            }
            fileInputRef.current?.click();
          }}
        >
          <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleChange} className="hidden" />

          {status === "idle" && (
            <div className={`text-center flex flex-col items-center animate-in zoom-in transition-opacity w-full ${!isDisclaimerAccepted ? 'opacity-40' : 'opacity-100'}`}>
              <div className="absolute top-4 right-4 bg-[#111] border border-[#333] px-3 py-1 flex items-center gap-2 rounded-full">
                <Zap size={12} className="text-[#E60000]" />
                <span className="text-[9px] font-mono uppercase tracking-widest text-[#888]">Cost: 1 Credit</span>
              </div>

              <div className="w-20 h-20 bg-black border border-[#333] rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                <FileAudio size={32} className="text-[#E60000]" />
              </div>
              <h3 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-2">Drop Artifact Here</h3>
              <p className="font-mono text-xs text-[#555] uppercase tracking-widest mb-6">WAV / MP3 (MAX 20MB)</p>
              <button 
                className={`px-8 py-3 font-bold text-[10px] uppercase tracking-widest transition-colors ${!isDisclaimerAccepted ? 'bg-[#333] text-[#888]' : 'bg-white text-black hover:bg-[#E60000] hover:text-white'}`}
              >
                {isDisclaimerAccepted ? "Browse Local Files" : "Awaiting IP Declaration"}
              </button>
            </div>
          )}

          {status === "uploading" && (
            <div className="relative z-10 flex flex-col items-center animate-in zoom-in">
              <Loader2 size={48} className="text-[#E60000] animate-spin mb-6" />
              <h3 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-2">Transmitting Payload</h3>
              <p className="font-mono text-xs text-[#888] uppercase tracking-widest">Encrypting to secure storage node...</p>
            </div>
          )}

          {status === "analyzing" && (
            <div className="relative z-10 flex flex-col items-center animate-in zoom-in">
              <div className="relative w-24 h-24 flex items-center justify-center mb-6">
                <div className="absolute inset-0 border-4 border-[#333] rounded-full"></div>
                <div className="absolute inset-0 border-4 border-[#E60000] rounded-full border-t-transparent animate-spin"></div>
                <Music size={24} className="text-[#E60000] animate-pulse" />
              </div>
              <h3 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-2">Running DSP Analysis</h3>
              <p className="font-mono text-xs text-[#888] uppercase tracking-widest">Polling RunPod Serverless Architecture...</p>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-mono text-[#E60000] border border-[#E60000]/30 bg-[#E60000]/10 px-3 py-1">
                <Network size={12} className="animate-pulse" /> Compute Attempt: {pollingAttempts}
              </div>
            </div>
          )}

          {status === "success" && audioData && (
            <div className="relative z-10 flex flex-col items-center animate-in zoom-in w-full px-8 py-10">
              <Activity size={48} className="mx-auto mb-4 text-green-500 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full bg-green-500/10 p-2" />
              <h2 className="font-oswald text-3xl uppercase tracking-widest mb-6 font-bold text-white">Smart Analysis Complete</h2>
              
              <div className="bg-black border border-green-500/30 p-6 w-full max-w-sm mb-8 space-y-4 shadow-[0_0_20px_rgba(0,0,0,0.5)] text-left">
                <div className="flex justify-between items-center border-b border-[#222] pb-2">
                  <span className="text-[10px] text-[#888] font-mono uppercase tracking-widest">Detected BPM</span>
                  <span className="text-lg font-oswald text-green-500 font-bold">{Math.round(audioData.bpm)}</span>
                </div>
                <div className="flex justify-between items-center border-b border-[#222] pb-2">
                  <span className="text-[10px] text-[#888] font-mono uppercase tracking-widest">Extracted Key</span>
                  <span className="text-lg font-oswald text-green-500 font-bold">{audioData.key || "Unknown"}</span>
                </div>
                <div className="flex justify-between items-center border-b border-[#222] pb-2">
                  <span className="text-[10px] text-[#888] font-mono uppercase tracking-widest">Structural Length</span>
                  <span className="text-lg font-oswald text-green-500 font-bold">{audioData.totalBars} Bars</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-[#888] font-mono uppercase tracking-widest">Algorithm Routing</span>
                  <span className="text-[10px] font-mono text-green-500 font-bold tracking-widest flex items-center gap-1">
                     <ArrowRight size={10} /> Primed for Room 02
                  </span>
                </div>
              </div>

              <div className="w-full max-w-sm flex flex-col gap-3">
                <button 
                  onClick={() => setActiveRoom("02")}
                  className="w-full bg-white text-black py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center justify-center gap-2"
                >
                  Advance to Brain Train <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* THE LEGAL DISCLAIMER LOCK */}
        <div 
          onClick={() => setIsDisclaimerAccepted(!isDisclaimerAccepted)}
          className={`mt-6 border p-5 flex gap-4 items-start rounded-sm transition-all cursor-pointer select-none
            ${isDisclaimerAccepted ? 'border-[#E60000] bg-[#110000]' : 'border-[#330000] bg-[#0a0a0a] hover:bg-[#110000]'}`}
        >
          <div className="mt-0.5">
            <input 
              type="checkbox" 
              checked={isDisclaimerAccepted} 
              onChange={(e) => setIsDisclaimerAccepted(e.target.checked)} 
              onClick={(e) => e.stopPropagation()}
              className="accent-[#E60000] w-5 h-5 cursor-pointer" 
            />
          </div>
          <div>
            <h4 className="font-oswald text-sm uppercase tracking-widest font-bold text-[#E60000] mb-1 flex items-center gap-2">
              <ShieldCheck size={16} /> IP & Licensing Declaration
            </h4>
            <p className="font-mono text-[9px] text-[#888] uppercase tracking-wider leading-relaxed">
              By checking this box, I cryptographically attest that this artifact is an original, 100% owned work. 
              Bar-Code.ai acts strictly as a processing conduit and explicitly prohibits the upload of unauthorized copyrighted material. 
              All stems and processing metadata are securely sandboxed and are never utilized to train foundation AI models.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: MARKETPLACE */}
      <div className="w-full lg:w-96 flex flex-col bg-[#050505] border border-[#111] p-6">
        <div className="mb-6 pb-6 border-b border-[#111]">
          <h3 className="font-oswald text-xl uppercase tracking-widest font-bold text-white mb-2 flex items-center gap-2">
            <AlertTriangle size={16} className="text-yellow-500" /> Need a Canvas?
          </h3>
          <p className="font-mono text-[9px] text-[#666] uppercase tracking-widest leading-relaxed">
            Don't have a beat ready? Pull a royalty-free structural canvas directly from the A&R Neural Network.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
          {beats.length === 0 ? (
            <div className="text-center text-[#555] font-mono text-[9px] uppercase tracking-widest mt-10">
              <Loader2 size={16} className="animate-spin mx-auto mb-2" />
              Syncing Ledger...
            </div>
          ) : beats.map((beat) => (
            <div key={beat.id} className={`bg-black border p-4 transition-all group flex flex-col justify-between ${!isDisclaimerAccepted ? 'border-[#111] opacity-50' : 'border-[#222] hover:border-[#E60000]'}`}>
              <div className="mb-4 flex items-center gap-3">
                <button 
                  onClick={() => togglePreview(beat.url)}
                  disabled={!isDisclaimerAccepted}
                  className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-all disabled:cursor-not-allowed
                    ${playingPreview === beat.url ? 'bg-[#E60000] text-white shadow-[0_0_15px_rgba(230,0,0,0.5)] animate-pulse' : 'bg-[#111] text-[#888] hover:text-white hover:bg-[#222]'}`}
                >
                  {playingPreview === beat.url ? <Pause size={14} /> : <Play size={14} className="ml-1" />}
                </button>
                <div>
                  <h4 className={`font-oswald text-sm uppercase tracking-widest font-bold transition-colors ${!isDisclaimerAccepted ? 'text-[#888]' : 'text-white group-hover:text-[#E60000]'}`}>{beat.title}</h4>
                  <p className="font-mono text-[9px] text-[#555] uppercase tracking-widest mt-1">
                    PROD: {beat.producer}
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col gap-2 shrink-0">
                <button 
  onClick={() => handleMarketplaceSelect(beat, 'lease')}
  disabled={status !== "idle" || !isDisclaimerAccepted}
  className={`w-full px-4 py-2 flex flex-col items-center justify-center font-bold text-[9px] uppercase tracking-widest transition-all
    ${IS_FREE_LEASE_DAY ? 'bg-[#E60000] text-white animate-pulse' : 'bg-[#111] text-[#888] hover:bg-white hover:text-black'}`}
>
  {IS_FREE_LEASE_DAY ? (
    <>
      <span className="line-through opacity-50">${beat.leasePrice.toFixed(2)}</span>
      <span>FREE LEASE TODAY</span>
    </>
  ) : (
    `$${beat.leasePrice.toFixed(2)} Lease`
  )}
</button>
                <button 
                  onClick={() => handleMarketplaceSelect(beat, 'exclusive')}
                  disabled={status !== "idle" || !isDisclaimerAccepted}
                  className={`w-full px-4 py-2 flex items-center justify-center font-bold text-[9px] uppercase tracking-widest transition-all disabled:cursor-not-allowed
                    ${!isDisclaimerAccepted ? 'bg-[#111] text-[#333]' : 'border border-yellow-500/50 text-yellow-500 hover:bg-yellow-500 hover:text-black'}`}
                >
                  ${beat.exclusivePrice.toFixed(2)} Exclusive Buyout
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      
    </div>
  );
}