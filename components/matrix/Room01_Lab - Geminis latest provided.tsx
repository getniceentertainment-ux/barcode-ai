"use client";

import React, { useState, useRef, useEffect } from "react";
import { UploadCloud, Play, Pause, Activity, CheckCircle2, FlaskConical, ArrowRight, Lock, Zap, Loader2, Music, Trash2 } from "lucide-react";
import WaveSurfer from 'wavesurfer.js';
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function Room01_Lab() {
  const { audioData, setAudioData, setActiveRoom, userSession, addToast } = useMatrixStore();

  const [isUploading, setIsUploading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(!!audioData?.bpm);
  
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  // --- MONETIZATION: CREDIT CHECK ---
  const CREATOR_ID = process.env.NEXT_PUBLIC_CREATOR_ID;
  const isCreator = userSession?.id && userSession.id === CREATOR_ID;
  const hasCredits = isCreator || (userSession?.creditsRemaining && (userSession.creditsRemaining === "UNLIMITED" || userSession.creditsRemaining > 0));

  useEffect(() => {
    if (waveformRef.current && audioData?.url && !wavesurferRef.current) {
      wavesurferRef.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#333333',
        progressColor: '#E60000',
        cursorColor: '#ffffff',
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 100,
        normalize: true,
      });

      wavesurferRef.current.load(audioData.url);
      wavesurferRef.current.on('finish', () => setIsPlaying(false));
      wavesurferRef.current.on('ready', () => {
         const duration = wavesurferRef.current?.getDuration() || 0;
         if (duration > 0 && audioData && !audioData.duration) {
             setAudioData({ ...audioData, duration });
         }
      });
    }

    return () => {
      wavesurferRef.current?.destroy();
      wavesurferRef.current = null;
    };
  }, [audioData]);

  const togglePlayback = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
      setIsPlaying(wavesurferRef.current.isPlaying());
    }
  };

  const handleClearTrack = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.pause();
      setIsPlaying(false);
    }
    setAudioData(null);
    setAnalysisComplete(false);
  };

  // --- SURGICAL FIX: SUPABASE PERSISTENCE ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!userSession?.id) {
       if (addToast) addToast("Security Exception: You must be logged in to upload audio.", "error");
       return;
    }

    // Basic validation
    if (!file.type.includes('audio/')) {
        if (addToast) addToast("Invalid file type. Please upload an MP3 or WAV.", "error");
        return;
    }
    if (file.size > 20 * 1024 * 1024) { // 20MB limit for instrumentals
        if (addToast) addToast("File too large. Maximum size is 20MB.", "error");
        return;
    }

    setIsUploading(true);

    try {
      // 1. Sanitize filename and create storage path
      const fileExt = file.name.split('.').pop();
      const safeName = file.name.replace(/[^a-zA-Z0-9]/g, '_');
      const filePath = `${userSession.id}/INSTRUMENTAL_${Date.now()}_${safeName}.${fileExt}`;

      // 2. Upload to Supabase Storage 'raw-audio' bucket
      const { error: uploadError } = await supabase.storage
        .from('raw-audio')
        .upload(filePath, file, {
           cacheControl: '3600',
           upsert: false
        });

      if (uploadError) throw uploadError;

      // 3. Get the permanent Public URL
      const { data: publicData } = supabase.storage
        .from('raw-audio')
        .getPublicUrl(filePath);

      // 4. Update the global store with the permanent URL
      setAudioData({ 
          url: publicData.publicUrl, 
          fileName: file.name, 
          bpm: 0, 
          totalBars: 0 
      });
      
      setAnalysisComplete(false);
      if (addToast) addToast("Instrumental secured in vault.", "success");

    } catch (err: any) {
      console.error("Upload failed:", err);
      if (addToast) addToast(`Upload failed: ${err.message}`, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!audioData?.url) return;
    if (!hasCredits) {
      if (addToast) addToast("Insufficient Credits.", "error");
      return;
    }

    setIsAnalyzing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      // 1. Initiate DSP Job
      const res = await fetch('/api/dsp', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ 
          task_type: "analyze",
          file_url: audioData.url
        })
      });

      const initData = await res.json();
      if (!res.ok) throw new Error(initData.error || "Failed to initialize DSP extraction.");

      const jobId = initData.jobId;
      
      // 2. Poll for Completion
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/dsp?jobId=${jobId}&t=${Date.now()}`);
          const statusData = await statusRes.json();

          if (statusData.status === 'COMPLETED') {
            clearInterval(pollInterval);
            const output = statusData.output;

            const audioDuration = wavesurferRef.current?.getDuration() || 180;
            
            let detectedBpm = output.bpm || 120;
            if (detectedBpm < 70) detectedBpm *= 2;
            
            const detectedKey = output.key || "C Minor";

            // SURGICAL FIX: Calculate total bars
            const totalBars = Math.round((audioDuration / 60) * detectedBpm / 4);

            setAudioData({
              url: audioData.url,
              fileName: audioData.fileName,
              bpm: detectedBpm,
              totalBars: totalBars,
              key: detectedKey,
              grid: output.beats,
              duration: audioDuration
            });

            setAnalysisComplete(true);
            setIsAnalyzing(false);
            if (addToast) addToast("DSP Extraction Complete. Grid Locked.", "success");

          } else if (statusData.status === 'FAILED') {
            clearInterval(pollInterval);
            setIsAnalyzing(false);
            if (addToast) addToast("DSP Engine Failed to process audio.", "error");
          }
        } catch (pollErr) {
            console.error("Polling error:", pollErr);
        }
      }, 3000);

    } catch (err: any) {
      setIsAnalyzing(false);
      if (addToast) addToast(err.message, "error");
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center max-w-4xl mx-auto animate-in fade-in py-10">
      
      <div className="text-center mb-12">
        <h2 className="font-oswald text-5xl uppercase tracking-[0.2em] mb-4 font-bold flex items-center justify-center gap-4 text-white">
          <FlaskConical className="text-[#E60000]" size={48} /> The Lab
        </h2>
        <p className="font-mono text-xs text-[#888] uppercase tracking-widest max-w-lg mx-auto leading-relaxed">
          Upload raw instrumentals. The DSP Engine extracts BPM, Key, and Structural Grid metadata required for Neural Synthesis.
        </p>
      </div>

      {!audioData ? (
        <div className="w-full relative group">
          <div className="absolute inset-0 bg-[#E60000] blur-xl opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-xl"></div>
          <label className="border-2 border-dashed border-[#333] hover:border-[#E60000] bg-[#050505] p-20 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 rounded-xl relative z-10">
            <input type="file" className="hidden" accept="audio/*" onChange={handleFileUpload} disabled={isUploading} />
            {isUploading ? (
               <div className="flex flex-col items-center text-[#E60000]">
                  <Loader2 size={64} className="animate-spin mb-6" />
                  <span className="font-oswald text-2xl uppercase tracking-widest font-bold">Securing in Vault...</span>
               </div>
            ) : (
               <>
                  <div className="w-24 h-24 rounded-full bg-[#111] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 border border-[#222] group-hover:border-[#E60000]">
                    <UploadCloud size={40} className="text-[#555] group-hover:text-[#E60000] transition-colors" />
                  </div>
                  <span className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-2">Initialize Substrate</span>
                  <span className="font-mono text-[10px] text-[#555] uppercase tracking-widest">Drop MP3/WAV (Max 20MB)</span>
               </>
            )}
          </label>
        </div>
      ) : (
        <div className="w-full animate-in slide-in-from-bottom-8 duration-500">
          <div className="bg-[#050505] border border-[#222] p-8 rounded-xl shadow-2xl relative overflow-hidden">
            
            {/* Background Accent */}
            <div className="absolute -top-32 -right-32 w-64 h-64 bg-[#E60000] blur-[100px] opacity-5 pointer-events-none rounded-full"></div>

            <div className="flex justify-between items-start mb-8 relative z-10">
              <div>
                <h3 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-2 flex items-center gap-3">
                  <Music size={20} className="text-[#E60000]" /> Active Substrate
                </h3>
                <p className="font-mono text-xs text-[#555] uppercase tracking-widest">{audioData.fileName}</p>
              </div>
              <button 
                onClick={handleClearTrack}
                className="text-[#555] hover:text-[#E60000] transition-colors flex items-center gap-2 font-mono text-[10px] uppercase"
              >
                <Trash2 size={14} /> Eject
              </button>
            </div>

            {/* Waveform Player */}
            <div className="bg-black border border-[#111] rounded-lg p-6 mb-8 relative z-10 flex items-center gap-6">
               <button 
                 onClick={togglePlayback} 
                 className="w-16 h-16 shrink-0 rounded-full bg-[#E60000] text-white flex items-center justify-center hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.3)] hover:scale-105"
               >
                 {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
               </button>
               <div className="flex-1" ref={waveformRef} />
            </div>

            {/* DSP Status & Actions */}
            <div className="relative z-10">
              {!analysisComplete ? (
                <div className="relative group">
                  {!hasCredits && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center border border-[#E60000]/30 rounded-lg">
                      <Lock size={20} className="text-[#E60000] mb-2" />
                      <p className="text-xs uppercase font-bold text-white tracking-widest font-mono">Insufficient Credits</p>
                    </div>
                  )}
                  <button 
                    onClick={handleAnalyze} 
                    disabled={isAnalyzing || !hasCredits} 
                    className="w-full bg-[#111] border border-[#333] text-white py-6 font-oswald text-lg font-bold uppercase tracking-[0.2em] hover:bg-[#E60000] hover:border-[#E60000] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-4 rounded-lg"
                  >
                    {isAnalyzing ? (
                      <><Activity className="animate-spin text-[#E60000]" size={24} /> Executing Neural DSP Extraction...</>
                    ) : (
                      <><Activity size={24} className="text-[#555] group-hover:text-white transition-colors" /> Run DSP Diagnostics <Zap size={16} className="text-[#E60000]" /></>
                    )}
                  </button>
                </div>
              ) : (
                <div className="animate-in fade-in zoom-in-95 duration-500">
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-black border border-[#222] p-6 rounded-lg text-center">
                      <span className="block text-[10px] font-mono text-[#555] uppercase tracking-widest mb-2">Detected Tempo</span>
                      <span className="font-oswald text-3xl font-bold text-[#E60000]">{Math.round(audioData.bpm || 0)} <span className="text-sm text-white">BPM</span></span>
                    </div>
                    <div className="bg-black border border-[#222] p-6 rounded-lg text-center">
                      <span className="block text-[10px] font-mono text-[#555] uppercase tracking-widest mb-2">Tonal Key</span>
                      <span className="font-oswald text-3xl font-bold text-white">{audioData.key || "UNKNOWN"}</span>
                    </div>
                    <div className="bg-black border border-[#222] p-6 rounded-lg text-center">
                      <span className="block text-[10px] font-mono text-[#555] uppercase tracking-widest mb-2">Structural Grid</span>
                      <span className="font-oswald text-3xl font-bold text-white">{audioData.totalBars || 0} <span className="text-sm">BARS</span></span>
                    </div>
                  </div>

                  <button 
                    onClick={() => setActiveRoom("02")} 
                    className="w-full bg-white text-black py-5 font-oswald text-xl font-bold uppercase tracking-[0.3em] hover:bg-[#E60000] hover:text-white transition-all flex items-center justify-center gap-3 rounded-lg shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(230,0,0,0.4)]"
                  >
                    <CheckCircle2 size={24} /> Proceed to Brain Train <ArrowRight size={24} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}