"use client";

import React, { useState, useRef, useEffect } from "react";
import { UploadCloud, FileAudio, Loader2, CheckCircle2, AlertTriangle, ShieldCheck, Music, ArrowRight, Zap, Activity, Network, Play, Pause } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

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

  // Hardcoded beats removed - relying purely on Supabase Fetch
  const [beats, setBeats] = useState<any[]>([]);

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

  // Catch returning Stripe redirects for purchased leases
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      
      if (params.get('beat_purchased') === 'true') {
        const beatUrl = params.get('beat_url');
        let beatName = params.get('beat_name');
        
        if (beatUrl) {
          // --- SUPABASE URL EXTRACTOR ---
          // Since your test link didn't have the name, this slices it perfectly from the end of the .mp3 URL
          if (!beatName) {
            try {
              const urlParts = beatUrl.split('/');
              beatName = decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]);
            } catch (err) {
              beatName = "GetNice_Marketplace_Beat.mp3";
            }
          }

          // 1. Clean the URL instantly so it doesn't double-fire if the user refreshes
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // 2. Visually check the disclaimer box for the user
          setIsDisclaimerAccepted(true); 
          
          if (addToast) addToast(`License Acquired: ${beatName}. Booting DSP...`, "info");
          
          // 3. SURGICAL FIX: The Delay-Fire 
          // We wait exactly 500ms to guarantee React has checked the box BEFORE the function runs!
          setTimeout(() => {
            if (handlePurchasedBeatDSP) {
               handlePurchasedBeatDSP(beatUrl, beatName);
            }
          }, 500);
        }
      }
    }
  }, []);

  // --- SURGICAL FIXER: The Hydration Catcher ---
  // Listens for the audioData to arrive from the hard drive after a refresh
  useEffect(() => {
    if (audioData) {
      // If the beat arrives, but the UI is stuck on idle, flip it to success
      if (status === "idle") {
        setStatus("success");
      }
    } else {
      // If the matrix gets cleared (e.g., user hits trash can), reset the room
      if (status === "success") {
        setStatus("idle");
      }
    }
  }, [audioData, status]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDisclaimerAccepted) return; 
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (!isDisclaimerAccepted) {
      if (addToast) addToast("Please accept the IP & Licensing Declaration below first.", "error");
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processRealFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processRealFile(e.target.files[0]);
    }
  };

  // --- AUDIO PREVIEW LOGIC (60s Limit) ---
  const togglePreview = (url: string) => {
    if (playingPreview === url) {
      previewAudioRef.current?.pause();
      setPlayingPreview(null);
    } else {
      setPlayingPreview(url);
      if (previewAudioRef.current) {
        previewAudioRef.current.src = url;
        previewAudioRef.current.currentTime = 0;
        previewAudioRef.current.play().catch(e => console.error("Preview play failed:", e));
      }
    }
  };

  const handlePreviewTimeUpdate = () => {
    if (previewAudioRef.current && previewAudioRef.current.currentTime >= 60) {
      previewAudioRef.current.pause();
      setPlayingPreview(null);
      if (addToast) addToast("Preview limited to 60 seconds. Secure a lease to unlock.", "info");
    }
  };

  // --- THE ASYNC POLLING LOGIC ---
  const pollDSPJob = (jobId: string, cloudUrl: string, fileName: string) => {
    let attempts = 0;
    
    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      setPollingAttempts(attempts);
      
      try {
        const statusRes = await fetch(`/api/dsp?jobId=${jobId}&t=${Date.now()}`);
        const statusData = await statusRes.json();

        if (statusData.status === 'COMPLETED') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          
          setAudioData({
            url: cloudUrl,
            fileName: fileName,
            bpm: statusData.output.bpm || 120,
            totalBars: statusData.output.total_bars || 64,
            key: statusData.output.key || "Unknown",
            grid: statusData.output.grid || []
          });

          setStatus("success");
          if (addToast) addToast("Smart Analysis Complete. Blueprint Primed.", "success");
          
          // REMOVED: Auto-advancing to Room 02. The user must manually review and advance.

        } else if (statusData.status === 'FAILED') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setStatus("idle");
          if (addToast) addToast("RunPod DSP Execution Failed.", "error");
        }
      } catch (pollErr) {
        console.error("DSP Polling Error", pollErr);
      }
    }, 3000);
  };

  // THE LIVE DSP INGESTION PIPELINE
  const processRealFile = async (selectedFile: File) => {
    if (!selectedFile || !userSession?.id) return;

    if (!selectedFile.type.includes("audio/")) {
      if (addToast) addToast("Invalid artifact. Audio files only.", "error");
      return;
    }

    if (selectedFile.size > 20 * 1024 * 1024) {
      if (addToast) addToast("Payload Exceeds 20MB Limit. Please compress audio file.", "error");
      return;
    }
    
    setFile(selectedFile);
    setStatus("uploading");

    try {
      const filePath = `${userSession.id}/${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from('audio_raw').upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('audio_raw').getPublicUrl(filePath);
      const currentCloudUrl = publicUrlData.publicUrl;

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Security Exception: Valid JWT Token required.");

      setStatus("analyzing");
      setPollingAttempts(0);

      const res = await fetch('/api/dsp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ file_url: currentCloudUrl })
      });

      const initData = await res.json();

      if (!res.ok) {
        await supabase.storage.from('audio_raw').remove([filePath]);
        throw new Error(initData.error || "DSP Initialization failed");
      }

      // Initiate Polling with the real Job ID
      if (initData.jobId) {
        pollDSPJob(initData.jobId, currentCloudUrl, selectedFile.name);
      } else {
        throw new Error("No DSP Job ID returned from worker.");
      }

    } catch (err: any) {
      console.error("DSP Pipeline Error:", err);
      if (addToast) addToast(err.message || "Error processing audio.", "error");
      setStatus("idle");
    }
  };

  // STRIPE BEAT LEASING & BUYOUT
  const handleMarketplaceSelect = async (beat: any, licenseType: 'lease' | 'exclusive') => {
    if (!isDisclaimerAccepted) {
      if (addToast) addToast("Please accept the IP & Licensing Declaration below first.", "error");
      return;
    }
    
    // Stop preview if it's playing
    if (previewAudioRef.current) previewAudioRef.current.pause();
    setPlayingPreview(null);

    const price = licenseType === 'lease' ? beat.leasePrice : beat.exclusivePrice;
    const beatNameLabel = licenseType === 'lease' ? `${beat.title} (Lease)` : `${beat.title} (Exclusive Buyout)`;

    setStatus("analyzing"); 
    try {
      const res = await fetch('/api/stripe/beat-lease', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beatName: beatNameLabel,
          beatUrl: beat.url,
          price: price,
          userId: userSession?.id
        })
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url; 
      } else {
        throw new Error(data.error || "Failed to initialize Stripe.");
      }
    } catch (err: any) {
      console.error("Marketplace Error:", err);
      if (addToast) addToast(err.message, "error");
      setStatus("idle");
    }
  };

  // HANDLE RETURNING USERS AFTER SUCCESSFUL STRIPE LEASE
  const handlePurchasedBeatDSP = async (beatUrl: string, beatName: string) => {
    setStatus("analyzing");
    setPollingAttempts(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const res = await fetch('/api/dsp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ file_url: beatUrl })
      });
      
      const initData = await res.json();
      if (!res.ok) throw new Error(initData.error || "DSP Processing failed");

      if (initData.jobId) {
        pollDSPJob(initData.jobId, beatUrl, beatName);
      } else {
        throw new Error("No DSP Job ID returned.");
      }

    } catch (err: any) {
      console.error("Purchased Beat DSP Error:", err);
      if (addToast) addToast("Failed to analyze beat: " + err.message, "error");
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
                  className={`w-full px-4 py-2 flex items-center justify-center font-bold text-[9px] uppercase tracking-widest transition-all disabled:cursor-not-allowed
                    ${!isDisclaimerAccepted ? 'bg-[#111] text-[#333]' : 'bg-[#111] text-[#888] hover:bg-white hover:text-black'}`}
                >
                  ${beat.leasePrice.toFixed(2)} Lease
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