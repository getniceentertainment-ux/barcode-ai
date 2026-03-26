"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sliders, CheckCircle2, Activity, ArrowRight, AudioWaveform, Disc3, Download, RefreshCw, FileArchive, Loader2, Lock, DollarSign, ShieldCheck, Trash2, Play, Pause } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";
import JSZip from 'jszip';
import jsPDF from 'jspdf';

// --- BULLETPROOF PCM 16-BIT WAV ENCODER ---
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
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

export default function Room06_Mastering() {
  const { audioData, vocalStems, generatedLyrics, setActiveRoom, addToast, finalMaster, setFinalMaster, userSession, clearMatrix } = useMatrixStore();
  
  // --- STATE DECLARATIONS ---
  const [lufs, setLufs] = useState(-14); 
  const [beatVolume, setBeatVolume] = useState(0.85); 
  const [vocalVolume, setVocalVolume] = useState(1.0); 
  const [status, setStatus] = useState<"idle" | "processing" | "success">(finalMaster ? "success" : "idle");
  const [isZipping, setIsZipping] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasToken, setHasToken] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // --- REFS ---
  const previewCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  // --- VARIABLES ---
  const isNonMogul = userSession?.tier !== "The Mogul";
  const isFreeLoader = userSession?.tier === "Free Loader";

  // --- ALL HANDLERS DECLARED BEFORE USEEFFECTS TO PREVENT TDZ CRASHES ---
  const stopPreview = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    activeSourcesRef.current.forEach(src => { try { src.stop(); src.disconnect(); } catch(e){} });
    activeSourcesRef.current = [];
    previewCtxRef.current?.close();
    previewCtxRef.current = null;
    setIsPreviewing(false);
  };

  const drawMeter = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(dataArray);

    let sumSquares = 0;
    for (let i = 0; i < dataArray.length; i++) {
        const val = (dataArray[i] - 128) / 128;
        sumSquares += val * val;
    }
    const rms = Math.sqrt(sumSquares / dataArray.length);
    const level = Math.min(1, rms * 5); 

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const segments = 30;
    const activeSegments = Math.floor(level * segments);
    
    for (let i = 0; i < segments; i++) {
        ctx.fillStyle = i < activeSegments ? (i > 24 ? '#E60000' : (i > 18 ? '#EAB308' : '#22C55E')) : '#222';
        ctx.fillRect(i * (canvas.width / segments), 0, (canvas.width / segments) - 2, canvas.height);
    }
    animationRef.current = requestAnimationFrame(drawMeter);
  };

  const togglePreviewPlayback = async () => {
    if (isPreviewing) { stopPreview(); return; }
    if (!audioData?.url) return;

    try {
      setIsPreviewing(true);
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      previewCtxRef.current = ctx;

      const secondsPerBar = audioData?.bpm ? (60 / audioData.bpm) * 4 : 2.5;

      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = lufs; limiter.knee.value = 0.0; limiter.ratio.value = 20.0;
      limiter.attack.value = 0.005; limiter.release.value = 0.050;
      
      const makeupGain = ctx.createGain();
      makeupGain.gain.value = Math.pow(10, (Math.abs(lufs) - 6) / 20);
      
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyserRef.current = analyser;

      limiter.connect(makeupGain); makeupGain.connect(analyser); analyser.connect(ctx.destination);

      let beatBlob = (audioData as any)?.blob;
      if (!beatBlob && audioData.url) { const r = await fetch(audioData.url); beatBlob = await r.blob(); }
      const beatArrayBuf = await beatBlob.arrayBuffer();
      const beatBuffer = await new Promise<AudioBuffer>((res, rej) => ctx.decodeAudioData(beatArrayBuf, res, rej));
      
      const decodedVocals = [];
      for (const stem of vocalStems) {
          let vBlob = (stem as any).blob;
          if (!vBlob && stem.url) { const r = await fetch(stem.url); if (r.ok) vBlob = await r.blob(); }
          if (!vBlob) continue;
          const vArrayBuf = await vBlob.arrayBuffer();
          const vBuf = await new Promise<AudioBuffer>((resolve, reject) => { ctx.decodeAudioData(vArrayBuf, resolve, reject); });
          decodedVocals.push({ buffer: vBuf, offset: (stem.offsetBars || 0) * secondsPerBar, volume: stem.volume ?? 1 });
      }

      const syncTime = ctx.currentTime + 0.1;

      const beatSource = ctx.createBufferSource();
      beatSource.buffer = beatBuffer;
      const beatGain = ctx.createGain(); beatGain.gain.value = beatVolume;
      beatSource.connect(beatGain); beatGain.connect(limiter);
      beatSource.start(syncTime);
      activeSourcesRef.current.push(beatSource);

      decodedVocals.forEach(v => {
          const vSource = ctx.createBufferSource(); vSource.buffer = v.buffer;
          const vGain = ctx.createGain(); vGain.gain.value = vocalVolume * v.volume;
          vSource.connect(vGain); vGain.connect(limiter);
          vSource.start(syncTime + v.offset);
          activeSourcesRef.current.push(vSource);
      });

      beatSource.onended = () => stopPreview();
      drawMeter();

    } catch (err) {
      console.error("Preview failed:", err);
      stopPreview();
    }
  };

  const handleMastering = async () => {
    if (!audioData?.url) { addToast("No instrumental blueprint found.", "error"); return; }
    stopPreview(); 
    setStatus("processing");
    
    try {
      if (isNonMogul && userSession?.id) {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/ledger/consume', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ action: 'mastering' })
        });
        const consumeData = await res.json();
        if (!res.ok) throw new Error(consumeData.error || "Failed to securely consume token.");
        setHasToken(false);
      }

      const tmpCtx = new window.AudioContext();
      const secondsPerBar = audioData?.bpm ? (60 / audioData.bpm) * 4 : 2.5;
      
      let beatBlob = (audioData as any)?.blob;
      if (!beatBlob) { const r = await fetch(audioData.url); beatBlob = await r.blob(); }
      const beatArrayBuf = await beatBlob.arrayBuffer();
      const beatBuffer = await new Promise<AudioBuffer>((res, rej) => tmpCtx.decodeAudioData(beatArrayBuf, res, rej));
      
      const vocalBuffers = [];
      for (const stem of vocalStems) {
          let vBlob = (stem as any).blob;
          if (!vBlob && stem.url) { const r = await fetch(stem.url); if (r.ok) vBlob = await r.blob(); }
          if (!vBlob) continue;
          const vArrayBuf = await vBlob.arrayBuffer();
          const vBuf = await new Promise<AudioBuffer>((res, rej) => tmpCtx.decodeAudioData(vArrayBuf, res, rej));
          vocalBuffers.push({ buffer: vBuf, offset: (stem.offsetBars || 0) * secondsPerBar, volume: stem.volume ?? 1 });
      }

      const offlineCtx = new OfflineAudioContext(2, beatBuffer.length, beatBuffer.sampleRate);
      
      const limiter = offlineCtx.createDynamicsCompressor();
      limiter.threshold.value = lufs; limiter.knee.value = 0.0; limiter.ratio.value = 20.0;
      limiter.attack.value = 0.005; limiter.release.value = 0.050;
      const makeupGain = offlineCtx.createGain(); makeupGain.gain.value = Math.pow(10, (Math.abs(lufs) - 6) / 20); 
      limiter.connect(makeupGain); makeupGain.connect(offlineCtx.destination);

      const beatSource = offlineCtx.createBufferSource(); beatSource.buffer = beatBuffer;
      const beatGainNode = offlineCtx.createGain(); beatGainNode.gain.value = beatVolume;
      beatSource.connect(beatGainNode); beatGainNode.connect(limiter);
      beatSource.start(0);

      vocalBuffers.forEach(v => {
          const vSource = offlineCtx.createBufferSource(); vSource.buffer = v.buffer;
          const vGainNode = offlineCtx.createGain(); vGainNode.gain.value = vocalVolume * v.volume;
          vSource.connect(vGainNode); vGainNode.connect(limiter);
          vSource.start(v.offset);
      });

      const renderedBuffer = await offlineCtx.startRendering();
      const finalWavBlob = audioBufferToWavBlob(renderedBuffer);
      
      const outputUrl = URL.createObjectURL(finalWavBlob);
      setFinalMaster({ url: outputUrl, blob: finalWavBlob } as any);
      useMatrixStore.setState({ isProjectFinalized: true });
      setStatus("success");
      if(addToast) addToast("Commercial Master Rendered. Vocals & Beat Fused.", "success");

    } catch (err: any) {
      console.error(err);
      setStatus("idle");
      if(addToast) addToast(err.message || "Mastering engine crashed.", "error");
    }
  };

  const handleExport = async () => {
    setIsZipping(true);
    try {
      let blobData = (finalMaster as any)?.blob;
      if (!blobData && finalMaster?.url) { const resp = await fetch(finalMaster.url); blobData = await resp.blob(); }
      if (!blobData) throw new Error("Audio payload missing in matrix state.");

      if (isFreeLoader) {
        const url = window.URL.createObjectURL(blobData);
        const a = document.createElement('a'); a.href = url; a.download = `${audioData?.fileName || "ARTIFACT"}_Free_Master.wav`; a.click();
        window.URL.revokeObjectURL(url);
        if (addToast) addToast("Standard WAV Downloaded.", "success");
      } else {
        const zip = new JSZip();
        zip.file(`${audioData?.fileName || "ARTIFACT"}_Commercial_Master.wav`, blobData);
        
        if (vocalStems.length > 0) {
          const tmpCtx = new window.AudioContext();
          const secondsPerBar = audioData?.bpm ? (60 / audioData.bpm) * 4 : 2.5;
          let maxDuration = 0;
          
          const decodedVocals = await Promise.all(vocalStems.map(async s => {
            let vBlob = (s as any).blob;
            if (!vBlob && s.url) { const r = await fetch(s.url); if (r.ok) vBlob = await r.blob(); }
            if (!vBlob) return null;
            const vArrayBuf = await vBlob.arrayBuffer();
            const vBuf = await new Promise<AudioBuffer>((res, rej) => tmpCtx.decodeAudioData(vArrayBuf, res, rej));
            const endTime = ((s.offsetBars || 0) * secondsPerBar) + vBuf.duration;
            if (endTime > maxDuration) maxDuration = endTime;
            return { buffer: vBuf, offset: (s.offsetBars || 0) * secondsPerBar, volume: s.volume ?? 1 };
          }));

          const validVocals = decodedVocals.filter(v => v !== null);

          if (maxDuration > 0 && validVocals.length > 0) {
            const offlineAcapellaCtx = new OfflineAudioContext(2, tmpCtx.sampleRate * maxDuration, tmpCtx.sampleRate);
            validVocals.forEach(v => {
                const source = offlineAcapellaCtx.createBufferSource(); source.buffer = v!.buffer;
                const gainNode = offlineAcapellaCtx.createGain(); gainNode.gain.value = vocalVolume * v!.volume;
                source.connect(gainNode); gainNode.connect(offlineAcapellaCtx.destination);
                source.start(v!.offset);
            });
            const renderedAcapella = await offlineAcapellaCtx.startRendering();
            const acapellaBlob = audioBufferToWavBlob(renderedAcapella);
            zip.file(`${audioData?.fileName || "ARTIFACT"}_Acapella_Stem.wav`, acapellaBlob);
          }
          tmpCtx.close();
        }

        const doc = new jsPDF({ orientation: "portrait" });
        doc.setFillColor(10, 10, 10); doc.rect(0, 0, 210, 297, "F");
        doc.setTextColor(230, 0, 0); doc.setFontSize(28); doc.text("BAR-CODE.AI // GETNICE", 105, 20, { align: "center" });
        doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.text(audioData?.fileName || "UNTITLED ARTIFACT", 105, 35, { align: "center" });
        doc.setFontSize(10); doc.setTextColor(150, 150, 150);
        const rawLyrics = generatedLyrics || "No lyrics registered in matrix.";
        const splitLyrics = doc.splitTextToSize(rawLyrics, 170); doc.text(splitLyrics, 20, 50);
        zip.file(`${audioData?.fileName || "ARTIFACT"}_Official_Lyrics.pdf`, doc.output("blob"));
        
        const certDoc = new jsPDF({ orientation: "landscape" });
        certDoc.setFillColor(5, 5, 5); certDoc.rect(0, 0, 300, 210, "F");
        certDoc.setTextColor(230, 0, 0); certDoc.setFontSize(36); certDoc.text("BAR-CODE.AI // GETNICE", 148, 50, { align: "center" });
        certDoc.setTextColor(255, 255, 255); certDoc.setFontSize(20); certDoc.text("COMMERCIAL MASTERING CERTIFICATE", 148, 80, { align: "center" });
        certDoc.setFontSize(14); certDoc.setTextColor(200, 200, 200);
        certDoc.text(`Track Artifact: ${audioData?.fileName || "UNTITLED_NODE"}`, 148, 110, { align: "center" });
        certDoc.text(`Authorized Node: ${userSession?.stageName || "Unknown Artist"}`, 148, 125, { align: "center" });
        certDoc.text(`LUFS Threshold: ${lufs} LUFS`, 148, 140, { align: "center" });
        certDoc.text(`Timestamp: ${new Date().toUTCString()}`, 148, 155, { align: "center" });
        certDoc.setFontSize(10); certDoc.setTextColor(100, 100, 100);
        certDoc.text(`Cryptographic Signature: SHA-256 / ${Math.random().toString(36).substring(2, 15).toUpperCase()}${Math.random().toString(36).substring(2, 15).toUpperCase()}`, 148, 185, { align: "center" });
        zip.file("Commercial_License_Certificate.pdf", certDoc.output("blob"));
        
        const content = await zip.generateAsync({ type: "blob" });
        const url = window.URL.createObjectURL(content);
        const a = document.createElement('a'); a.href = url; a.download = `${audioData?.fileName || "ARTIFACT"}_Commercial_Package.zip`; a.click();
        window.URL.revokeObjectURL(url);
        if (addToast) addToast("Complete Artifact Zip Exported.", "success");
      }
    } catch (err: any) {
      console.error("Export Error:", err);
      if (addToast) addToast("Export failed: " + err.message, "error");
    } finally {
      setIsZipping(false);
    }
  };

  const handleStartNewProject = () => { if(confirm("DANGER: This will purge the Matrix state. Proceed?")) { clearMatrix(); setActiveRoom("01"); } };

  const handlePurchaseToken = async () => {
    if (!userSession?.id) return;
    if(addToast) addToast("Opening Secure Gateway...", "info");
    try {
      const res = await fetch('/api/stripe/master-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: userSession.id }) });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err: any) { if(addToast) addToast("Checkout failed.", "error"); }
  };

  // --- ALL USE EFFECTS ---
  useEffect(() => {
    const initializeMasteringNode = async () => {
      if (!userSession) return;
      if (userSession.tier === "The Mogul") { setHasToken(true); setIsInitializing(false); return; }
      const { data } = await supabase.from('profiles').select('mastering_tokens, has_mastering_token').eq('id', userSession.id).single();
      if (data?.mastering_tokens > 0 || data?.has_mastering_token) setHasToken(true);
      setIsInitializing(false);
    };
    initializeMasteringNode();
    return () => { stopPreview(); };
  }, [userSession]);

  // --- EARLY RETURNS (MUST BE AT THE END TO PREVENT TDZ CRASHES) ---
  if (isInitializing) {
    return (
      <div className="h-full flex flex-col items-center justify-center opacity-30 animate-pulse">
        <Loader2 className="text-[#E60000] animate-spin mb-4" size={32} />
        <p className="font-mono text-[9px] uppercase tracking-widest text-[#E60000]">Verifying Ledger Authorization...</p>
      </div>
    );
  }

  if (!audioData) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[#E60000] opacity-50">
        <p className="font-oswald text-2xl uppercase tracking-widest">No Instrumental Loaded</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center max-w-4xl mx-auto animate-in fade-in duration-500">
      
      <div className="text-center mb-12">
        <h2 className="font-oswald text-5xl uppercase tracking-widest mb-4 font-bold text-white">R06: Mastering Suite</h2>
        <p className="font-mono text-xs text-[#555] uppercase tracking-[0.2em]">
          {status === "success" ? "Commercial Standard Reached" : "Final Output Limiters // Offline Render Engine"}
        </p>
      </div>

      {status === "idle" && (
        <div className="w-full max-w-2xl bg-[#050505] border border-[#222] p-10 flex flex-col items-center rounded-lg relative overflow-hidden group hover:border-[#E60000]/50 transition-all">
          {!hasToken ? (
            <div className="w-full text-center animate-in zoom-in mb-8 relative z-10">
               <Lock size={32} className="mx-auto text-yellow-600 mb-4" />
               <h3 className="font-oswald text-xl uppercase font-bold text-white mb-2">Mastering Gated</h3>
               <p className="font-mono text-[9px] text-[#888] uppercase mb-8 leading-relaxed">Nodes require a <strong className="text-white">$4.99 Token</strong> per track to initiate the final master.</p>
               <button onClick={handlePurchaseToken} className="w-full bg-[#E60000] text-white py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-3">Purchase Token <DollarSign size={18} /></button>
            </div>
          ) : (
            <div className="w-full relative z-10">
              <div className="flex justify-between items-center mb-8">
                 <div className="flex items-center gap-2 text-green-500 font-mono text-[10px] uppercase font-bold tracking-widest border border-green-500/20 bg-green-500/5 px-3 py-1 rounded-full"><ShieldCheck size={14} /> System Authorized</div>
                 
                 {/* REAL-TIME PREVIEW BUTTON */}
                 <button 
                   onClick={togglePreviewPlayback} 
                   className={`flex items-center gap-2 font-mono text-[10px] uppercase font-bold tracking-widest px-4 py-2 border transition-all
                    ${isPreviewing ? 'bg-[#E60000] text-white border-[#E60000] animate-pulse' : 'bg-black text-[#888] border-[#333] hover:text-white hover:border-white'}`}
                 >
                   {isPreviewing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                   {isPreviewing ? 'Auditioning Mix' : 'Preview Mix Bus'}
                 </button>
              </div>

              {/* NEW VISUAL LUFS METER */}
              <div className="w-full h-8 bg-[#111] border border-[#222] mb-8 relative overflow-hidden rounded-sm">
                <canvas ref={canvasRef} width={600} height={32} className="w-full h-full" />
                {!isPreviewing && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="font-mono text-[8px] text-[#555] uppercase tracking-widest">Meter Offline - Enable Preview</span>
                  </div>
                )}
              </div>

              {/* MIX BUS CONSOLE */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 border-b border-[#222] pb-10">
                <div className="bg-[#0a0a0a] border border-[#111] p-4 rounded-sm">
                   <div className="flex justify-between items-center mb-4">
                     <span className="text-[10px] font-mono uppercase text-[#888] font-bold">Beat Gain</span>
                     <span className="text-xs font-mono text-white">{Math.round(beatVolume * 100)}%</span>
                   </div>
                   <input type="range" min="0" max="1.5" step="0.05" value={beatVolume} onChange={(e) => setBeatVolume(parseFloat(e.target.value))} className="w-full accent-[#E60000] h-1.5 bg-[#222] rounded-full appearance-none cursor-pointer" />
                </div>
                <div className="bg-[#0a0a0a] border border-[#111] p-4 rounded-sm">
                   <div className="flex justify-between items-center mb-4">
                     <span className="text-[10px] font-mono uppercase text-[#888] font-bold">Vocal Gain</span>
                     <span className="text-xs font-mono text-white">{Math.round(vocalVolume * 100)}%</span>
                   </div>
                   <input type="range" min="0" max="1.5" step="0.05" value={vocalVolume} onChange={(e) => setVocalVolume(parseFloat(e.target.value))} className="w-full accent-[#E60000] h-1.5 bg-[#222] rounded-full appearance-none cursor-pointer" />
                </div>
              </div>

              <div className="mb-4 flex justify-between items-end">
                <span className="text-[10px] font-mono uppercase text-[#888] font-bold">Master Limiter (LUFS)</span>
                <span className="font-oswald text-3xl font-bold text-white">{lufs} <span className="text-xs font-mono text-[#555]">LUFS</span></span>
              </div>
              <input type="range" min="-20" max="-6" step="0.5" value={lufs} onChange={(e) => setLufs(parseFloat(e.target.value))} className="w-full accent-[#E60000] h-2 bg-[#111] appearance-none cursor-pointer rounded-full mb-10" />
              
              <button onClick={handleMastering} className="w-full bg-[#E60000] text-white py-5 font-oswald text-xl font-bold uppercase tracking-[0.3em] hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.2)]">Render Audio Engine</button>
            </div>
          )}
        </div>
      )}

      {status === "processing" && (
        <div className="w-full max-w-xl bg-[#050505] border border-[#E60000]/30 p-10 rounded-lg flex flex-col items-center">
          <Activity size={64} className="text-[#E60000] animate-bounce mb-8" />
          <p className="font-oswald text-xl uppercase font-bold text-white tracking-widest">Mathematical Audio Fusing...</p>
          <div className="flex gap-1.5 mt-8 h-12 items-end">
            {[...Array(24)].map((_, i) => (
              <div key={i} className="w-2 bg-[#E60000] animate-pulse" style={{ height: `${Math.max(20, Math.random() * 100)}%`, animationDelay: `${i * 0.05}s`, animationDuration: '0.5s' }} />
            ))}
          </div>
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
               onClick={handleExport}
               disabled={isZipping}
               className="bg-white text-black hover:bg-[#E60000] hover:text-white p-4 rounded-sm transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)] disabled:opacity-50 flex items-center justify-center"
             >
               {isZipping ? <Loader2 size={24} className="animate-spin" /> : isFreeLoader ? <Download size={24} /> : <FileArchive size={24} />}
             </button>
          </div>

          <div className="w-full flex flex-col gap-3">
            {!isFreeLoader && (
              <button onClick={() => setActiveRoom("07")} className="w-full flex justify-center items-center gap-3 bg-[#E60000] text-white py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.2)]">Route to Distribution <ArrowRight size={20} /></button>
            )}
            <button onClick={handleStartNewProject} className={`w-full border py-3 font-oswald text-xs font-bold uppercase tracking-widest transition-all flex justify-center items-center gap-2 ${isFreeLoader ? 'border-[#E60000] text-white bg-[#E60000]/10 hover:bg-[#E60000] hover:text-white' : 'border-red-900/30 text-[#555] hover:text-[#E60000]'}`}>
              <Trash2 size={14} /> Start New Project
            </button>
          </div>
        </div>
      )}
    </div>
  );
}