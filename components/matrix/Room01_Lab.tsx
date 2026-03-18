"use client";

import React, { useState, useRef, useEffect } from "react";
import { UploadCloud, FileAudio, Loader2, CheckCircle2, AlertTriangle, ShieldCheck, Music, ArrowRight, Zap } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function Room01_Lab() {
  const { audioData, setAudioData, setActiveRoom, addToast, userSession } = useMatrixStore();
  
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "analyzing" | "success">(audioData ? "success" : "idle");
  const [isDisclaimerAccepted, setIsDisclaimerAccepted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Catch returning Stripe redirects for purchased leases
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('beat_purchased') === 'true') {
        const beatUrl = params.get('beat_url');
        const beatName = params.get('beat_name');
        if (beatUrl && beatName) {
          window.history.replaceState({}, document.title, window.location.pathname);
          setIsDisclaimerAccepted(true);
          handlePurchasedBeatDSP(beatUrl, beatName);
        }
      }
    }
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDisclaimerAccepted) return; // Block drag visuals if not accepted
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

      // 3. DSP Forensics Call (RunPod Worker 2)
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

      // 5. Auto-route to Brain Train
      setTimeout(() => {
        setActiveRoom("02");
      }, 1500);

    } catch (err: any) {
      console.error("DSP Pipeline Error:", err);
      if (addToast) addToast(err.message || "Error processing audio.", "error");
      setStatus("idle");
    }
  };

  // STRIPE BEAT LEASING
  const handleMarketplaceSelect = async (beat: any) => {
    if (!isDisclaimerAccepted) {
      if (addToast) addToast("Please accept the IP & Licensing Declaration below first.", "error");
      return;
    }

    setStatus("analyzing"); // Briefly show loading while Stripe handshake happens
    try {
      const res = await fetch('/api/stripe/beat-lease', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beatName: beat.title,
          beatUrl: beat.url,
          price: beat.price,
          userId: userSession?.id
        })
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url; // Bounce to Stripe Checkout
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
      setTimeout(() => setActiveRoom("02"), 1500);

    } catch (err: any) {
      console.error("Purchased Beat DSP Error:", err);
      if (addToast) addToast("Failed to analyze beat: " + err.message, "error");
      setStatus("idle");
    }
  };

  const marketplaceBeats = [
    { id: 1, title: "NEON BLOOD", producer: "GetNice", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", price: 49.99, bpm: 120, key: "C Min" },
    { id: 2, title: "GHOST PROTOCOL", producer: "Vex", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", price: 99.99, bpm: 142, key: "F# Min" },
    { id: 3, title: "SILICON SOUL", producer: "GetNice", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", price: 29.99, bpm: 95, key: "A Min" }
  ];

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
          className={`flex-1 border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-10 transition-all relative overflow-hidden bg-[#050505]
            ${dragActive ? 'border-[#E60000] bg-[#110000]' : 'border-[#333] hover:border-[#555]'}
            ${status !== 'idle' ? 'pointer-events-none' : 'cursor-pointer'}
          `}
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
              <p className="font-mono text-xs text-[#555] uppercase tracking-widest mb-6">WAV / MP3 / FLAC (MAX 20MB)</p>
              <button 
                className={`px-8 py-3 font-bold text-[10px] uppercase tracking-widest transition-colors ${!isDisclaimerAccepted ? 'bg-[#333] text-[#888]' : 'bg-white text-black hover:bg-[#E60000] hover:text-white'}`}
              >
                {isDisclaimerAccepted ? "Browse Local Files" : "Awaiting IP Declaration"}
              </button>
            </div>
          )}

          {status === "uploading" && (
            <div className="text-center flex flex-col items-center animate-in zoom-in">
              <Loader2 size={48} className="text-[#E60000] animate-spin mb-6" />
              <h3 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-2">Transmitting Payload</h3>
              <p className="font-mono text-xs text-[#888] uppercase tracking-widest">Encrypting to secure storage node...</p>
            </div>
          )}

          {status === "analyzing" && (
            <div className="text-center flex flex-col items-center animate-in zoom-in">
              <div className="relative w-24 h-24 flex items-center justify-center mb-6">
                <div className="absolute inset-0 border-4 border-[#333] rounded-full"></div>
                <div className="absolute inset-0 border-4 border-[#E60000] rounded-full border-t-transparent animate-spin"></div>
                <Music size={24} className="text-[#E60000] animate-pulse" />
              </div>
              <h3 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-2">Running DSP Analysis</h3>
              <p className="font-mono text-xs text-[#888] uppercase tracking-widest">Extracting BPM, Key, and Structural Bars...</p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center flex flex-col items-center animate-in zoom-in">
              <CheckCircle2 size={64} className="text-green-500 mb-6 shadow-[0_0_30px_rgba(34,197,94,0.3)] rounded-full" />
              <h3 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-2">Blueprint Extracted</h3>
              <p className="font-mono text-xs text-green-500 uppercase tracking-widest">Routing to Brain Train...</p>
            </div>
          )}
        </div>

        {/* 🚨 THE LEGAL DISCLAIMER LOCK 🚨 */}
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
          {marketplaceBeats.map((beat) => (
            <div key={beat.id} className={`bg-black border p-4 transition-all group flex items-center justify-between ${!isDisclaimerAccepted ? 'border-[#111] opacity-50' : 'border-[#222] hover:border-[#E60000]'}`}>
              <div>
                <h4 className={`font-oswald text-sm uppercase tracking-widest font-bold transition-colors ${!isDisclaimerAccepted ? 'text-[#888]' : 'text-white group-hover:text-[#E60000]'}`}>{beat.title}</h4>
                <p className="font-mono text-[9px] text-[#555] uppercase tracking-widest mt-1">
                  PROD: {beat.producer} // {beat.bpm} BPM // {beat.key}
                </p>
              </div>
              <button 
                onClick={() => handleMarketplaceSelect(beat)}
                disabled={status !== "idle" || !isDisclaimerAccepted}
                className={`w-auto px-4 h-8 rounded-full flex items-center justify-center font-bold text-[9px] uppercase tracking-widest transition-all disabled:cursor-not-allowed
                  ${!isDisclaimerAccepted ? 'bg-[#111] text-[#333]' : 'bg-[#111] text-[#555] hover:bg-[#E60000] hover:text-white'}`}
              >
                ${beat.price} Lease
              </button>
            </div>
          ))}
        </div>
      </div>
      
    </div>
  );
}