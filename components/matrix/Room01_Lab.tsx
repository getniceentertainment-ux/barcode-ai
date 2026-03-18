"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, FileAudio, Loader2, CheckCircle2, AlertTriangle, ShieldCheck, Music, ArrowRight } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";

export default function Room01_Lab() {
  const { setAudioData, setActiveRoom, addToast } = useMatrixStore();
  
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "analyzing" | "success">("idle");
  const [isDisclaimerAccepted, setIsDisclaimerAccepted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDisclaimerAccepted) return; // Block drag visuals if not accepted
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const processFile = async (selectedFile: File) => {
    if (!selectedFile.type.includes("audio/")) {
      if (addToast) addToast("Invalid artifact. Audio files only.", "error");
      return;
    }
    
    setFile(selectedFile);
    setStatus("uploading");

    // 1. Simulate secure upload to Supabase Storage
    await new Promise(r => setTimeout(r, 1500));
    setStatus("analyzing");

    // 2. Simulate DSP Handoff to RunPod Serverless
    await new Promise(r => setTimeout(r, 2000));
    
    // 3. DSP Success & Store Update
    const mockDSP = {
      url: URL.createObjectURL(selectedFile),
      fileName: selectedFile.name,
      bpm: Math.floor(Math.random() * (140 - 85 + 1) + 85), // Random BPM between 85-140
      key: ["C Min", "G Min", "F# Maj", "A Min"][Math.floor(Math.random() * 4)],
      duration: 180, // 3 minutes
      totalBars: 64
    };
    
    setAudioData(mockDSP);
    setStatus("success");
    if (addToast) addToast("DSP extraction complete. Blueprint generated.", "success");

    // 4. Auto-route to Brain Train
    setTimeout(() => {
      setActiveRoom("02");
    }, 1500);
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
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const marketplaceBeats = [
    { id: 1, title: "NEON BLOOD", producer: "GetNice", bpm: 120, key: "C Min" },
    { id: 2, title: "GHOST PROTOCOL", producer: "Vex", bpm: 142, key: "F# Min" },
    { id: 3, title: "SILICON SOUL", producer: "GetNice", bpm: 95, key: "A Min" }
  ];

  const handleMarketplaceSelect = (beat: any) => {
    if (!isDisclaimerAccepted) {
      if (addToast) addToast("Please accept the IP & Licensing Declaration below first.", "error");
      return;
    }

    // Mocking a marketplace selection
    setStatus("analyzing");
    setTimeout(() => {
      setAudioData({
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", // Safe placeholder audio
        fileName: `${beat.title} (Prod. ${beat.producer}).mp3`,
        bpm: beat.bpm,
        key: beat.key,
        duration: 210,
        totalBars: 88
      });
      setStatus("success");
      setTimeout(() => setActiveRoom("02"), 1000);
    }, 1500);
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
            <div className={`text-center flex flex-col items-center animate-in zoom-in transition-opacity ${!isDisclaimerAccepted ? 'opacity-40' : 'opacity-100'}`}>
              <div className="w-20 h-20 bg-black border border-[#333] rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                <FileAudio size={32} className="text-[#E60000]" />
              </div>
              <h3 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-2">Drop Artifact Here</h3>
              <p className="font-mono text-xs text-[#555] uppercase tracking-widest mb-6">WAV / MP3 / FLAC (MAX 50MB)</p>
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
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:cursor-not-allowed
                  ${!isDisclaimerAccepted ? 'bg-[#111] text-[#333]' : 'bg-[#111] text-[#555] group-hover:bg-[#E60000] group-hover:text-white'}`}
              >
                <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
      
    </div>
  );
}