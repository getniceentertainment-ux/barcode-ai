"use client";

import React, { useState, useRef, useEffect } from "react";
import { UploadCloud, FileAudio, Loader2, CheckCircle2, AlertTriangle, ShieldCheck, Music, ArrowRight, Zap, Activity } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function Room01_Lab() {
  const { audioData, setAudioData, setActiveRoom, addToast, userSession } = useMatrixStore();
  
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "analyzing" | "success">(audioData ? "success" : "idle");
  const [isDisclaimerAccepted, setIsDisclaimerAccepted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hardcoded premium beats + state for dynamic Supabase beats
  const [beats, setBeats] = useState<any[]>([
    { id: "gn1", title: "NEON BLOOD", producer: "GetNice", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", leasePrice: 29.99, exclusivePrice: 500.00, bpm: 120, key: "C Min" },
    { id: "gn2", title: "GHOST PROTOCOL", producer: "Vex", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", leasePrice: 49.99, exclusivePrice: 500.00, bpm: 142, key: "F# Min" },
    { id: "gn3", title: "SILICON SOUL", producer: "GetNice", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", leasePrice: 29.99, exclusivePrice: 500.00, bpm: 95, key: "A Min" }
  ]);

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
              // Extract BPM from filename (e.g., "Dark_Trap_142BPM.mp3")
              const bpmMatch = file.name.match(/_?(\d+)\s*BPM/i);
              const bpm = bpmMatch ? parseInt(bpmMatch[1]) : 120;
              
              // Dynamic Pricing Logic based on BPM intensity for Leases
              let calculatedLeasePrice = 29.99;
              if (bpm >= 140) calculatedLeasePrice = 149.99;
              else if (bpm >= 125) calculatedLeasePrice = 99.99;
              else if (bpm >= 110) calculatedLeasePrice = 49.99;

              const { data: urlData } = supabase.storage.from('marketplace_beats').getPublicUrl(file.name);
              
              // Clean up the title for the UI
              const cleanTitle = file.name.replace(/\.(mp3|wav)$/i, '').replace(/_?\d+\s*BPM/i, '').replace(/_/g, ' ').trim();

              return { 
                id: `supa_${index}`, 
                title: cleanTitle || file.name, 
                producer: "Network Node", 
                url: urlData.publicUrl, 
                leasePrice: calculatedLeasePrice,
                exclusivePrice: 500.00, // Fixed Full Buyout Price mapped from Monetization Strategy
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
        const beatName = params.get('beat_name');
        if (beatUrl && beatName) {
          window.history.replaceState({}, document.title, window.location.pathname);
          setIsDisclaimerAccepted(true); // Auto-accept to prevent blocking the returning user
          handlePurchasedBeatDSP(beatUrl, beatName);
        }
      }
    }
  }, [userSession]);

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
      // 1. Upload to Secure Supabase Bucket
      const filePath = `${userSession.id}/${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from('audio_raw').upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('audio_raw').getPublicUrl(filePath);
      const currentCloudUrl = publicUrlData.publicUrl;

      // 2. Fetch Secure JWT Token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Security Exception: Valid JWT Token required.");

      setStatus("analyzing");

      // 3. DSP Forensics Call
      const res = await fetch('/api/dsp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ file_url: currentCloudUrl })
      });

      const analysis = await res.json();

      if (!res.ok) {
        await supabase.storage.from('audio_raw').remove([filePath]);
        throw new Error(analysis.error || "DSP Processing failed");
      }

      // 4. Save to Global Matrix Store
      setAudioData({
        url: currentCloudUrl,
        fileName: selectedFile.name,
        bpm: analysis.bpm || 120,
        totalBars: analysis.total_bars || 64,
        key: analysis.key || "Unknown",
        grid: analysis.grid || []
      });

      setStatus("success");
      if (addToast) addToast("Audio imported & analyzed successfully", "success");

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
      
      const analysis = await res.json();
      if (!res.ok) throw new Error(analysis.error || "DSP Processing failed");

      setAudioData({
        url: beatUrl,
        fileName: beatName,
        bpm: analysis.bpm || 120,
        totalBars: analysis.total_bars || 64,
        key: analysis.key || "Unknown",
        grid: analysis.grid || []
      });

      setStatus("success");
      if (addToast) addToast("Beat Licensed & Analyzed Successfully", "success");

    } catch (err: any) {
      console.error("Purchased Beat DSP Error:", err);
      if (addToast) addToast("Failed to analyze beat: " + err.message, "error");
      setStatus("idle");
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-8 animate-in fade-in duration-500">
      
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
              <p className="font-mono text-xs text-[#888] uppercase tracking-widest">Extracting BPM, Key, and Structural Bars...</p>
            </div>
          )}

          {status === "success" && audioData && (
            <div className="relative z-10 flex flex-col items-center animate-in zoom-in w-full px-8 py-10">
              <Activity size={48} className="mx-auto mb-4 text-green-500 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full bg-green-500/10 p-2" />
              <h2 className="font-oswald text-3xl uppercase tracking-widest mb-6 font-bold text-white">Smart Analysis Complete</h2>
              
              <div className="bg-black border border-green-500/30 p-6 w-full max-w-sm mb-8 space-y-4 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                <div className="flex justify-between items-center border-b border-[#222] pb-2">
                  <span className="text-[10px] text-[#888] font-mono uppercase tracking-widest">Detected BPM</span>
                  <span className="text-lg font-oswald text-green-500 font-bold">{Math.round(audioData.bpm)}</span>
                </div>
                <div className="flex justify-between items-center border-b border-[#222] pb-2">
                  <span className="text-[10px] text-[#888] font-mono uppercase tracking-widest">Extracted Key</span>
                  <span className="text-lg font-oswald text-green-500 font-bold">{audioData.key || "Unknown"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-[#888] font-mono uppercase tracking-widest">Structural Length</span>
                  <span className="text-lg font-oswald text-green-500 font-bold">{audioData.totalBars} Bars</span>
                </div>
              </div>

              <div className="w-full max-w-sm flex flex-col gap-3">
                <button 
                  onClick={() => setActiveRoom("02")}
                  className="w-full bg-white text-black py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center justify-center gap-2"
                >
                  Advance to Brain Train <ArrowRight size={18} />
                </button>
                
                <button 
                  onClick={() => setStatus("idle")}
                  className="w-full border border-[#333] text-[#888] py-3 font-oswald text-sm font-bold uppercase tracking-widest hover:bg-[#111] hover:text-white transition-all"
                >
                  Analyze New Track
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
          {beats.map((beat) => (
            <div key={beat.id} className={`bg-black border p-4 transition-all group flex flex-col justify-between ${!isDisclaimerAccepted ? 'border-[#111] opacity-50' : 'border-[#222] hover:border-[#E60000]'}`}>
              <div className="mb-4">
                <h4 className={`font-oswald text-sm uppercase tracking-widest font-bold transition-colors ${!isDisclaimerAccepted ? 'text-[#888]' : 'text-white group-hover:text-[#E60000]'}`}>{beat.title}</h4>
                <p className="font-mono text-[9px] text-[#555] uppercase tracking-widest mt-1">
                  PROD: {beat.producer} // {beat.bpm} BPM // {beat.key}
                </p>
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