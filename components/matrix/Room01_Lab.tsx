"use client";

import React, { useState, useRef, useEffect } from "react";
import { UploadCloud, FileAudio, Loader2, CheckCircle2, AlertTriangle, ShieldCheck, Music, ArrowRight, Zap, Activity, Network, Play, Pause, Dices, Square, Waves } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

// --- SURGICAL ADDITION: The Silent Extractor ---
const getExactAudioDuration = (url: string): Promise<number> => {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => resolve(audio.duration));
    audio.addEventListener('error', () => resolve(0)); 
  });
};

// --- BULLETPROOF PCM 16-BIT WAV ENCODER ---
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; 
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = buffer.length * blockAlign;

  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
  };

  writeString(view, 0, 'RIFF'); view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE'); writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true); view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true); writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const channels = [];
  for (let i = 0; i < numChannels; i++) channels.push(buffer.getChannelData(i));

  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = Math.max(-1, Math.min(1, channels[channel][i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
}

// --- PURE MATH DRUM SYNTHESIS (Zero Latency, No Samples Required) ---
const createNoiseBuffer = (ctx: BaseAudioContext) => {
  const bufferSize = ctx.sampleRate * 2; 
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
  return buffer;
};

const play808 = (ctx: BaseAudioContext, time: number, dest: AudioNode) => {
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.connect(gain); gain.connect(dest);
  osc.frequency.setValueAtTime(150, time); osc.frequency.exponentialRampToValueAtTime(45, time + 0.05); osc.frequency.exponentialRampToValueAtTime(40, time + 1.2);
  gain.gain.setValueAtTime(1, time); gain.gain.exponentialRampToValueAtTime(0.001, time + 1.2);
  osc.start(time); osc.stop(time + 1.2);
};

const playSnare = (ctx: BaseAudioContext, noiseBuffer: AudioBuffer, time: number, dest: AudioNode) => {
  const osc = ctx.createOscillator(); const oscGain = ctx.createGain();
  osc.type = 'triangle'; osc.connect(oscGain); oscGain.connect(dest);
  osc.frequency.setValueAtTime(250, time); oscGain.gain.setValueAtTime(0.7, time); oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
  osc.start(time); osc.stop(time + 0.1);
  const noiseSource = ctx.createBufferSource(); noiseSource.buffer = noiseBuffer;
  const noiseFilter = ctx.createBiquadFilter(); noiseFilter.type = 'highpass'; noiseFilter.frequency.value = 1000;
  const noiseGain = ctx.createGain(); noiseSource.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(dest);
  noiseGain.gain.setValueAtTime(1, time); noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
  noiseSource.start(time); noiseSource.stop(time + 0.2);
};

const playHat = (ctx: BaseAudioContext, noiseBuffer: AudioBuffer, time: number, dest: AudioNode, isOpen = false) => {
  const noiseSource = ctx.createBufferSource(); noiseSource.buffer = noiseBuffer;
  const bandpass = ctx.createBiquadFilter(); bandpass.type = 'bandpass'; bandpass.frequency.value = 10000;
  const highpass = ctx.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = 7000;
  const gain = ctx.createGain(); noiseSource.connect(bandpass); bandpass.connect(highpass); highpass.connect(gain); gain.connect(dest);
  const decay = isOpen ? 0.3 : 0.05;
  gain.gain.setValueAtTime(0.6, time); gain.gain.exponentialRampToValueAtTime(0.01, time + decay);
  noiseSource.start(time); noiseSource.stop(time + decay);
};

export default function Room01_Lab() {
  const { audioData, setAudioData, setActiveRoom, addToast, userSession } = useMatrixStore();
  
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "analyzing" | "success">(audioData ? "success" : "idle");
  const [isDisclaimerAccepted, setIsDisclaimerAccepted] = useState(false);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [beats, setBeats] = useState<any[]>([]);

  // --- DUAL MODE CANVAS STATE ---
  const [canvasMode, setCanvasMode] = useState<"marketplace" | "synth">("marketplace");
  const [synthBpm, setSynthBpm] = useState(140);
  const [grid, setGrid] = useState<boolean[][]>(Array(4).fill(0).map(() => Array(16).fill(false)));
  const [isSynthPlaying, setIsSynthPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isBaking, setIsBaking] = useState(false);
  
  const synthCtxRef = useRef<AudioContext | null>(null);
  const noiseBufferRef = useRef<AudioBuffer | null>(null);
  const nextNoteTimeRef = useRef(0);
  const currentStepRef = useRef(0);
  const timerIDRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current.src = ""; }
      if (timerIDRef.current) clearTimeout(timerIDRef.current);
      if (synthCtxRef.current?.state !== 'closed') synthCtxRef.current?.close();
    };
  }, []);

  useEffect(() => {
    const fetchMarketplaceBeats = async () => {
      try {
        const { data, error } = await supabase.storage.from('marketplace_beats').list();
        if (error) throw error;
        if (data && data.length > 0) {
          const fetchedBeats = data.filter(file => file.name.endsWith('.mp3') || file.name.endsWith('.wav')).map((file, index) => {
              const bpmMatch = file.name.match(/_?(\d+)\s*BPM/i);
              const bpm = bpmMatch ? parseInt(bpmMatch[1]) : 120;
              let calculatedLeasePrice = 29.99;
              if (bpm >= 140) calculatedLeasePrice = 149.99; else if (bpm >= 125) calculatedLeasePrice = 99.99; else if (bpm >= 110) calculatedLeasePrice = 49.99;
              const { data: urlData } = supabase.storage.from('marketplace_beats').getPublicUrl(file.name);
              const cleanTitle = file.name.replace(/\.(mp3|wav)$/i, '').replace(/_?\d+\s*BPM/i, '').replace(/_/g, ' ').trim();
              return { id: `supa_${index}`, title: cleanTitle || file.name, producer: "GetNice Node", url: urlData.publicUrl, leasePrice: calculatedLeasePrice, exclusivePrice: 500.00, bpm: bpm, key: "Unknown" };
            });
          if (fetchedBeats.length > 0) {
            setBeats(prev => {
              const existingUrls = new Set(prev.map(p => p.url));
              const newBeats = fetchedBeats.filter(fb => !existingUrls.has(fb.url));
              return [...prev, ...newBeats];
            });
          }
        }
      } catch (err) { console.error("Failed to load beats:", err); }
    };
    fetchMarketplaceBeats();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('beat_purchased') === 'true') {
        const beatUrl = params.get('beat_url'); let beatName = params.get('beat_name');
        if (beatUrl) {
          if (!beatName) { try { const urlParts = beatUrl.split('/'); beatName = decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]); } catch (err) { beatName = "GetNice_Marketplace_Beat.mp3"; } }
          window.history.replaceState({}, document.title, window.location.pathname);
          setIsDisclaimerAccepted(true); 
          if (addToast) addToast(`License Acquired: ${beatName}. Booting DSP...`, "info");
          setTimeout(() => { if (handlePurchasedBeatDSP) handlePurchasedBeatDSP(beatUrl, beatName || "GetNice_Marketplace_Beat.mp3"); }, 500);
        }
      }
    }
  }, []);

  useEffect(() => { if (audioData) { if (status === "idle") setStatus("success"); } else { if (status === "success") setStatus("idle"); } }, [audioData, status]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!isDisclaimerAccepted) return; 
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true); else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (!isDisclaimerAccepted) { if (addToast) addToast("Please accept the IP & Licensing Declaration below first.", "error"); return; }
    if (e.dataTransfer.files && e.dataTransfer.files[0]) processRealFile(e.dataTransfer.files[0]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) processRealFile(e.target.files[0]);
  };

  const togglePreview = (url: string) => {
    if (playingPreview === url) { previewAudioRef.current?.pause(); setPlayingPreview(null); } 
    else { setPlayingPreview(url); if (previewAudioRef.current) { previewAudioRef.current.src = url; previewAudioRef.current.currentTime = 0; previewAudioRef.current.play().catch(e => console.error("Preview play failed:", e)); } }
  };

  const handlePreviewTimeUpdate = () => {
    if (previewAudioRef.current && previewAudioRef.current.currentTime >= 60) {
      previewAudioRef.current.pause(); setPlayingPreview(null);
      if (addToast) addToast("Preview limited to 60 seconds. Secure a lease to unlock.", "info");
    }
  };

  const pollDSPJob = (jobId: string, cloudUrl: string, fileName: string) => {
    let attempts = 0;
    pollIntervalRef.current = setInterval(async () => {
      attempts++; setPollingAttempts(attempts);
      try {
        const statusRes = await fetch(`/api/dsp?jobId=${jobId}&t=${Date.now()}`);
        const statusData = await statusRes.json();
        if (statusData.status === 'COMPLETED') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          const exactDuration = await getExactAudioDuration(cloudUrl);
          setAudioData({
            url: cloudUrl, fileName: fileName, bpm: statusData.output.bpm || 120, totalBars: statusData.output.total_bars || 64,
            key: statusData.output.key || "Unknown", grid: statusData.output.grid || [],
            dynamic_array: statusData.output.dynamic_array, contour: statusData.output.contour, 
            duration: exactDuration > 0 ? exactDuration : undefined
          });
          setStatus("success");
          setTimeout(async () => {
            const currentState = useMatrixStore.getState();
            if (userSession?.id) { try { await supabase.from('matrix_sessions').upsert({ user_id: userSession.id, session_state: currentState, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }); } catch (err) {} }
          }, 500);
          if (addToast) addToast("Smart Analysis Complete. Blueprint Primed & Ledger Saved.", "success");
        } else if (statusData.status === 'FAILED') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setStatus("idle");
          if (addToast) addToast("RunPod DSP Execution Failed.", "error");
        }
      } catch (pollErr) { console.error("DSP Polling Error", pollErr); }
    }, 3000);
  };

  const processRealFile = async (selectedFile: File) => {
    if (!selectedFile || !userSession?.id) return;
    if (!selectedFile.type.includes("audio/")) { if (addToast) addToast("Invalid artifact. Audio files only.", "error"); return; }
    if (selectedFile.size > 20 * 1024 * 1024) { if (addToast) addToast("Payload Exceeds 20MB Limit. Please compress audio file.", "error"); return; }
    setFile(selectedFile); setStatus("uploading");

    try {
      const filePath = `${userSession.id}/${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from('audio_raw').upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('audio_raw').getPublicUrl(filePath);
      const currentCloudUrl = publicUrlData.publicUrl;

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Security Exception: Valid JWT Token required.");

      setStatus("analyzing"); setPollingAttempts(0);
      const res = await fetch('/api/dsp', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ file_url: currentCloudUrl }) });
      const initData = await res.json();
      if (!res.ok) { await supabase.storage.from('audio_raw').remove([filePath]); throw new Error(initData.error || "DSP Initialization failed"); }
      if (initData.jobId) pollDSPJob(initData.jobId, currentCloudUrl, selectedFile.name); else throw new Error("No DSP Job ID returned from worker.");
    } catch (err: any) { console.error("DSP Error:", err); if (addToast) addToast(err.message || "Error processing audio.", "error"); setStatus("idle"); }
  };

  const handleMarketplaceSelect = async (beat: any, licenseType: 'lease' | 'exclusive') => {
    if (!isDisclaimerAccepted) { if (addToast) addToast("Please accept the IP & Licensing Declaration below first.", "error"); return; }
    if (previewAudioRef.current) previewAudioRef.current.pause();
    setPlayingPreview(null);
    const price = licenseType === 'lease' ? beat.leasePrice : beat.exclusivePrice;
    const beatNameLabel = licenseType === 'lease' ? `${beat.title} (Lease)` : `${beat.title} (Exclusive Buyout)`;
    setStatus("analyzing"); 
    try {
      const res = await fetch('/api/stripe/beat-lease', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ beatName: beatNameLabel, beatUrl: beat.url, price: price, userId: userSession?.id }) });
      const data = await res.json();
      if (data.url) window.location.href = data.url; else throw new Error(data.error || "Failed to initialize Stripe.");
    } catch (err: any) { console.error("Marketplace Error:", err); if (addToast) addToast(err.message, "error"); setStatus("idle"); }
  };

  const handlePurchasedBeatDSP = async (beatUrl: string, beatName: string) => {
    setStatus("analyzing"); setPollingAttempts(0);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch('/api/dsp', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ file_url: beatUrl }) });
      const initData = await res.json();
      if (!res.ok) throw new Error(initData.error || "DSP Processing failed");
      if (initData.jobId) pollDSPJob(initData.jobId, beatUrl, beatName); else throw new Error("No DSP Job ID returned.");
    } catch (err: any) { console.error("Purchased Beat DSP Error:", err); if (addToast) addToast("Failed to analyze beat: " + err.message, "error"); setStatus("idle"); }
  };

  // --- ALGORITHMIC TRAP SYNTHESIS LOGIC ---
  const generateTrapMath = () => {
    const nextGrid = Array(4).fill(0).map(() => Array(16).fill(false));
    nextGrid[0][0] = true; if (Math.random() > 0.3) nextGrid[0][10] = true; if (Math.random() > 0.7) nextGrid[0][7] = true; if (Math.random() > 0.8) nextGrid[0][14] = true;
    nextGrid[1][8] = true; if (Math.random() > 0.85) nextGrid[1][15] = true; 
    for (let i = 0; i < 16; i++) { if (i % 2 === 0) nextGrid[2][i] = true; else if (Math.random() > 0.75) nextGrid[2][i] = true; }
    if (Math.random() > 0.5) nextGrid[3][6] = true; if (Math.random() > 0.5) nextGrid[3][14] = true;
    setGrid(nextGrid);
    if (!isSynthPlaying) toggleSynthPlayback(); 
  };

  const scheduleNote = (stepNumber: number, time: number) => {
    if (!synthCtxRef.current || !noiseBufferRef.current) return;
    const ctx = synthCtxRef.current; const dest = ctx.destination;
    if (grid[0][stepNumber]) play808(ctx, time, dest);
    if (grid[1][stepNumber]) playSnare(ctx, noiseBufferRef.current, time, dest);
    if (grid[2][stepNumber]) playHat(ctx, noiseBufferRef.current, time, dest, false);
    if (grid[3][stepNumber]) playHat(ctx, noiseBufferRef.current, time, dest, true);
    requestAnimationFrame(() => setCurrentStep(stepNumber));
  };

  const scheduler = () => {
    if (!synthCtxRef.current) return;
    const lookahead = 0.1; const secondsPerBeat = 60.0 / synthBpm; const secondsPer16th = secondsPerBeat * 0.25;
    while (nextNoteTimeRef.current < synthCtxRef.current.currentTime + lookahead) {
      scheduleNote(currentStepRef.current, nextNoteTimeRef.current);
      nextNoteTimeRef.current += secondsPer16th;
      currentStepRef.current = (currentStepRef.current + 1) % 16;
    }
    timerIDRef.current = window.setTimeout(scheduler, 25);
  };

  const toggleSynthPlayback = async () => {
    if (!synthCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        synthCtxRef.current = new AudioContextClass();
        noiseBufferRef.current = createNoiseBuffer(synthCtxRef.current);
    }
    if (synthCtxRef.current.state === 'suspended') await synthCtxRef.current.resume();
    if (isSynthPlaying) {
      if (timerIDRef.current) clearTimeout(timerIDRef.current);
      setIsSynthPlaying(false); setCurrentStep(0);
    } else {
      currentStepRef.current = 0; nextNoteTimeRef.current = synthCtxRef.current.currentTime + 0.05;
      scheduler(); setIsSynthPlaying(true);
    }
  };

  const handleBakeBeat = async () => {
    if (isSynthPlaying) toggleSynthPlayback(); 
    setStatus("analyzing"); setIsBaking(true);
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const tmpCtx = new AudioContextClass(); const noiseBuf = createNoiseBuffer(tmpCtx);
        const barsToRender = 64; const beatsPerBar = 4; const secondsPerBeat = 60.0 / synthBpm;
        const totalDuration = (barsToRender * beatsPerBar * secondsPerBeat) + 2.0; 
        const offlineCtx = new OfflineAudioContext(2, tmpCtx.sampleRate * totalDuration, tmpCtx.sampleRate);
        const secondsPer16th = secondsPerBeat * 0.25;
        let renderTime = 0; const totalSteps = barsToRender * 16;

        for (let i = 0; i < totalSteps; i++) {
            const step = i % 16;
            if (grid[0][step]) play808(offlineCtx, renderTime, offlineCtx.destination);
            if (grid[1][step]) playSnare(offlineCtx, noiseBuf, renderTime, offlineCtx.destination);
            if (grid[2][step]) playHat(offlineCtx, noiseBuf, renderTime, offlineCtx.destination, false);
            if (grid[3][step]) playHat(offlineCtx, noiseBuf, renderTime, offlineCtx.destination, true);
            renderTime += secondsPer16th;
        }

        const renderedBuffer = await offlineCtx.startRendering();
        const wavBlob = audioBufferToWavBlob(renderedBuffer);
        const objectUrl = URL.createObjectURL(wavBlob);

        setAudioData({ url: objectUrl, fileName: `MATH_TRAP_${synthBpm}BPM.wav`, bpm: synthBpm, totalBars: barsToRender, duration: totalDuration, blob: wavBlob });
        if (addToast) addToast("Algorithmic Artifact Baked Successfully.", "success");
        setTimeout(() => setActiveRoom("02"), 500);
    } catch (err) {
        console.error("Baking Failed:", err);
        if (addToast) addToast("Failed to render mathematical array.", "error");
        setStatus("idle");
    } finally { setIsBaking(false); }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-8 animate-in fade-in duration-500">
      
      <audio ref={previewAudioRef} onTimeUpdate={handlePreviewTimeUpdate} onEnded={() => setPlayingPreview(null)} className="hidden" />

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
            if (!isDisclaimerAccepted) { if (addToast) addToast("Please accept the IP & Licensing Declaration below first.", "error"); return; }
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
              <button className={`px-8 py-3 font-bold text-[10px] uppercase tracking-widest transition-colors ${!isDisclaimerAccepted ? 'bg-[#333] text-[#888]' : 'bg-white text-black hover:bg-[#E60000] hover:text-white'}`}>
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
              <h3 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-2">{isBaking ? "Baking Synthetic Audio..." : "Running DSP Analysis"}</h3>
              <p className="font-mono text-xs text-[#888] uppercase tracking-widest">{isBaking ? "Synthesizing 64 Bars to RAM" : "Polling RunPod Serverless Architecture..."}</p>
              {!isBaking && (
                <div className="mt-4 flex items-center gap-2 text-[10px] font-mono text-[#E60000] border border-[#E60000]/30 bg-[#E60000]/10 px-3 py-1">
                  <Network size={12} className="animate-pulse" /> Compute Attempt: {pollingAttempts}
                </div>
              )}
            </div>
          )}

          {status === "success" && audioData && (
            <div className="relative z-10 flex flex-col items-center animate-in zoom-in w-full px-8 py-10">
              <Activity size={48} className="mx-auto mb-4 text-green-500 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full bg-green-500/10 p-2" />
              <h2 className="font-oswald text-3xl uppercase tracking-widest mb-6 font-bold text-white">Smart Analysis Complete</h2>
              <div className="bg-black border border-green-500/30 p-6 w-full max-w-sm mb-8 space-y-4 shadow-[0_0_20px_rgba(0,0,0,0.5)] text-left">
                <div className="flex justify-between items-center border-b border-[#222] pb-2"><span className="text-[10px] text-[#888] font-mono uppercase tracking-widest">Detected BPM</span><span className="text-lg font-oswald text-green-500 font-bold">{Math.round(audioData.bpm)}</span></div>
                <div className="flex justify-between items-center border-b border-[#222] pb-2"><span className="text-[10px] text-[#888] font-mono uppercase tracking-widest">Extracted Key</span><span className="text-lg font-oswald text-green-500 font-bold">{audioData.key || "Unknown"}</span></div>
                <div className="flex justify-between items-center border-b border-[#222] pb-2"><span className="text-[10px] text-[#888] font-mono uppercase tracking-widest">Structural Length</span><span className="text-lg font-oswald text-green-500 font-bold">{audioData.totalBars} Bars</span></div>
                <div className="flex justify-between items-center"><span className="text-[10px] text-[#888] font-mono uppercase tracking-widest">Algorithm Routing</span><span className="text-[10px] font-mono text-green-500 font-bold tracking-widest flex items-center gap-1"><ArrowRight size={10} /> Primed for Room 02</span></div>
              </div>
              <div className="w-full max-w-sm flex flex-col gap-3">
                <button onClick={() => setActiveRoom("02")} className="w-full bg-white text-black py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center justify-center gap-2">Advance to Brain Train <ArrowRight size={18} /></button>
              </div>
            </div>
          )}
        </div>

        {/* LEGAL DISCLAIMER */}
        <div onClick={() => setIsDisclaimerAccepted(!isDisclaimerAccepted)} className={`mt-6 border p-5 flex gap-4 items-start rounded-sm transition-all cursor-pointer select-none ${isDisclaimerAccepted ? 'border-[#E60000] bg-[#110000]' : 'border-[#330000] bg-[#0a0a0a] hover:bg-[#110000]'}`}>
          <div className="mt-0.5"><input type="checkbox" checked={isDisclaimerAccepted} onChange={(e) => setIsDisclaimerAccepted(e.target.checked)} onClick={(e) => e.stopPropagation()} className="accent-[#E60000] w-5 h-5 cursor-pointer" /></div>
          <div>
            <h4 className="font-oswald text-sm uppercase tracking-widest font-bold text-[#E60000] mb-1 flex items-center gap-2"><ShieldCheck size={16} /> IP & Licensing Declaration</h4>
            <p className="font-mono text-[9px] text-[#888] uppercase tracking-wider leading-relaxed">By checking this box, I cryptographically attest that this artifact is an original, 100% owned work. Bar-Code.ai acts strictly as a processing conduit and explicitly prohibits the upload of unauthorized copyrighted material. All stems and processing metadata are securely sandboxed and are never utilized to train foundation AI models.</p>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: DUAL MODE CANVAS */}
      <div className="w-full lg:w-[420px] flex flex-col bg-[#050505] border border-[#111] p-6 relative">
        <div className="flex mb-6 border-b border-[#222]">
           <button onClick={() => setCanvasMode("marketplace")} className={`flex-1 pb-3 font-oswald text-sm uppercase tracking-widest font-bold transition-all border-b-2 ${canvasMode === "marketplace" ? "border-[#E60000] text-white" : "border-transparent text-[#555] hover:text-white"}`}>Marketplace</button>
           <button onClick={() => setCanvasMode("synth")} className={`flex-1 pb-3 font-oswald text-sm uppercase tracking-widest font-bold transition-all border-b-2 ${canvasMode === "synth" ? "border-[#E60000] text-white" : "border-transparent text-[#555] hover:text-white"}`}>Beat Synth Lab</button>
        </div>

        {/* MODE 1: MARKETPLACE */}
        {canvasMode === "marketplace" && (
          <>
            <div className="mb-6">
              <h3 className="font-oswald text-xl uppercase tracking-widest font-bold text-white mb-2 flex items-center gap-2"><AlertTriangle size={16} className="text-yellow-500" /> Need a Canvas?</h3>
              <p className="font-mono text-[9px] text-[#666] uppercase tracking-widest leading-relaxed">Don't have a beat ready? Pull a royalty-free structural canvas directly from the A&R Neural Network.</p>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
              {beats.length === 0 ? (
                <div className="text-center text-[#555] font-mono text-[9px] uppercase tracking-widest mt-10"><Loader2 size={16} className="animate-spin mx-auto mb-2" />Syncing Ledger...</div>
              ) : beats.map((beat) => (
                <div key={beat.id} className={`bg-black border p-4 transition-all group flex flex-col justify-between ${!isDisclaimerAccepted ? 'border-[#111] opacity-50' : 'border-[#222] hover:border-[#E60000]'}`}>
                  <div className="mb-4 flex items-center gap-3">
                    <button onClick={() => togglePreview(beat.url)} disabled={!isDisclaimerAccepted} className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-all disabled:cursor-not-allowed ${playingPreview === beat.url ? 'bg-[#E60000] text-white shadow-[0_0_15px_rgba(230,0,0,0.5)] animate-pulse' : 'bg-[#111] text-[#888] hover:text-white hover:bg-[#222]'}`}>
                      {playingPreview === beat.url ? <Pause size={14} /> : <Play size={14} className="ml-1" />}
                    </button>
                    <div>
                      <h4 className={`font-oswald text-sm uppercase tracking-widest font-bold transition-colors ${!isDisclaimerAccepted ? 'text-[#888]' : 'text-white group-hover:text-[#E60000]'}`}>{beat.title}</h4>
                      <p className="font-mono text-[9px] text-[#555] uppercase tracking-widest mt-1">PROD: {beat.producer}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => handleMarketplaceSelect(beat, 'lease')} disabled={status !== "idle" || !isDisclaimerAccepted} className={`w-full px-4 py-2 flex items-center justify-center font-bold text-[9px] uppercase tracking-widest transition-all disabled:cursor-not-allowed ${!isDisclaimerAccepted ? 'bg-[#111] text-[#333]' : 'bg-[#111] text-[#888] hover:bg-white hover:text-black'}`}>${beat.leasePrice.toFixed(2)} Lease</button>
                    <button onClick={() => handleMarketplaceSelect(beat, 'exclusive')} disabled={status !== "idle" || !isDisclaimerAccepted} className={`w-full px-4 py-2 flex items-center justify-center font-bold text-[9px] uppercase tracking-widest transition-all disabled:cursor-not-allowed ${!isDisclaimerAccepted ? 'bg-[#111] text-[#333]' : 'border border-yellow-500/50 text-yellow-500 hover:bg-yellow-500 hover:text-black'}`}>${beat.exclusivePrice.toFixed(2)} Exclusive Buyout</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* MODE 2: BEAT LAB SYNTHESIS */}
        {canvasMode === "synth" && (
          <div className="flex-1 flex flex-col">
            <div className="mb-6">
              <h3 className="font-oswald text-xl uppercase tracking-widest font-bold text-[#E60000] mb-2 flex items-center gap-2"><Dices size={16} /> Algorithmic Drum Synth</h3>
              <p className="font-mono text-[9px] text-[#666] uppercase tracking-widest leading-relaxed">Synthesize an 808 Trap bounce in real-time using pure WebAudio mathematics. No samples required.</p>
            </div>
            
            <div className="flex justify-between items-center mb-6 border-b border-[#111] pb-6">
                <div className="flex items-center gap-4">
                  <button onClick={toggleSynthPlayback} disabled={status !== "idle" || !isDisclaimerAccepted} className={`w-12 h-12 flex items-center justify-center rounded-full border transition-all disabled:opacity-50 ${isSynthPlaying ? 'bg-[#E60000] text-white border-[#E60000]' : 'bg-[#111] border-[#333] hover:bg-white hover:text-black'}`}>
                    {isSynthPlaying ? <Square size={18} /> : <Play size={18} className="ml-1" />}
                  </button>
                  <div className="flex flex-col">
                    <span className="font-mono text-[9px] text-[#555] uppercase font-bold tracking-widest">Tempo (BPM)</span>
                    <span className="font-oswald text-lg text-white tracking-widest">{synthBpm}</span>
                  </div>
                </div>
                <input type="range" min="100" max="180" step="1" value={synthBpm} onChange={(e) => setSynthBpm(parseInt(e.target.value))} className="w-24 accent-[#E60000] h-1.5 bg-[#222] rounded-full appearance-none cursor-pointer" />
            </div>

            <div className="space-y-3 mb-8 flex-1">
              <div className="flex justify-end mb-2">
                 <button onClick={generateTrapMath} disabled={status !== "idle" || !isDisclaimerAccepted} className="text-[#888] hover:text-[#E60000] transition-colors flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest font-bold disabled:opacity-50"><Zap size={10} /> Randomize Array</button>
              </div>
              {["808 Sub", "Snare", "Hi-Hat", "O.Hat/Perc"].map((label, trackIndex) => (
                <div key={trackIndex} className="flex items-center gap-3">
                  <div className="w-14 text-right"><span className="font-mono text-[8px] text-[#888] uppercase tracking-widest font-bold">{label}</span></div>
                  <div className="flex-1 flex gap-0.5">
                    {grid[trackIndex].map((isActive, stepIndex) => {
                      const isCurrentStep = isSynthPlaying && currentStep === stepIndex;
                      const isDownbeat = stepIndex % 4 === 0;
                      return (
                        <button key={stepIndex} onClick={() => { const newGrid = [...grid]; newGrid[trackIndex][stepIndex] = !isActive; setGrid(newGrid); }} disabled={!isDisclaimerAccepted} className={`flex-1 h-8 rounded-sm transition-all border disabled:cursor-not-allowed ${isActive ? 'bg-[#E60000] border-[#E60000] shadow-[0_0_10px_rgba(230,0,0,0.5)]' : isDownbeat ? 'bg-[#151515] border-[#222]' : 'bg-[#0a0a0a] border-[#111]'} ${isCurrentStep ? 'brightness-150 scale-105 z-10' : ''}`} />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={handleBakeBeat} disabled={status !== "idle" || !isDisclaimerAccepted} className={`w-full py-4 font-oswald text-lg font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-3 disabled:opacity-50 ${!isDisclaimerAccepted ? 'bg-[#111] text-[#555]' : 'bg-[#E60000] text-white hover:bg-red-700'}`}>
               <Waves size={20} /> Bake Math to Matrix
            </button>
          </div>
        )}

      </div>
    </div>
  );
}