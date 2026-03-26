"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Pause, ArrowRight, Save, Trash2, ListMusic, ChevronLeft, ChevronRight, Volume2, VolumeX, Scissors, X, Loader2, Lock, Layers, Activity, Info } from "lucide-react";
import WaveSurfer from 'wavesurfer.js';
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase"; 

type TrackType = "Lead" | "Adlib" | "Double";

// --- BULLETPROOF AUDIO TRIMMING UTILITIES ---
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

async function trimAudioBlob(originalBlob: Blob, startSec: number, endSec: number): Promise<Blob> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioContext.state === 'suspended') await audioContext.resume();
  
  const arrayBuffer = await originalBlob.arrayBuffer();
  
  const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
    audioContext.decodeAudioData(arrayBuffer, resolve, (err) => reject(new Error("Unable to decode audio format. " + (err?.message || ""))));
  });
  
  const sampleRate = audioBuffer.sampleRate;
  const startOffset = Math.floor(startSec * sampleRate);
  const endOffset = Math.floor(endSec * sampleRate);
  const frameCount = Math.max(1, endOffset - startOffset);

  const trimmedBuffer = audioContext.createBuffer(audioBuffer.numberOfChannels, frameCount, sampleRate);
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    const trimmedData = trimmedBuffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) trimmedData[i] = channelData[startOffset + i] || 0;
  }
  return audioBufferToWavBlob(trimmedBuffer);
}

function encodeWAV(samples: Float32Array, sampleRate: number) {
  const numChannels = 1; 
  const format = 1;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * blockAlign;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  
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
  for (let i = 0; i < samples.length; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export default function Room04_Booth() {
  const { generatedLyrics, audioData, vocalStems, addVocalStem, removeVocalStem, updateStemOffset, updateStemVolume, setActiveRoom, blueprint, userSession, addToast } = useMatrixStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [lyricLines, setLyricLines] = useState<{text: string, startTime: number, isHeader: boolean, timestamp?: string}[]>([]);
  const [mutedStems, setMutedStems] = useState<Set<string>>(new Set());
  const [activeTrack, setActiveTrack] = useState<TrackType>("Lead");

  const [trimmingStem, setTrimmingStem] = useState<any | null>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [trimDuration, setTrimDuration] = useState(0);
  const [isProcessingTrim, setIsProcessingTrim] = useState(false);

  const trimWaveformRef = useRef<HTMLDivElement>(null);
  const trimWavesurferRef = useRef<WaveSurfer | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const stemBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recordedChunksRef = useRef<Float32Array[]>([]);
  const workletLoadedRef = useRef(false);
  const teleprompterRef = useRef<HTMLDivElement>(null);

  const secondsPerBar = audioData?.bpm ? (60 / audioData.bpm) * 4 : 2.5;
  const isFreeLoader = (userSession?.tier as string)?.includes("Free Loader");
  const hasEngToken = (userSession as any)?.has_engineering_token === true;

  const handleUpdateTakeType = (id: string, newType: string) => {
    const updatedStems = vocalStems.map(stem => stem.id === id ? { ...stem, type: newType as TrackType } : stem);
    useMatrixStore.setState({ vocalStems: updatedStems } as any);
  };

  const handlePurchaseEngineering = async () => {
    if (!userSession?.id) return;
    if(addToast) addToast("Routing to Secure Checkout...", "info");
    try {
      const res = await fetch('/api/stripe/engineering-token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: userSession.id })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error || "Failed to route to checkout.");
    } catch (err: any) {
      if(addToast) addToast("Checkout failed: " + err.message, "error");
    }
  };

  const handleProceedToEngineering = () => {
    if (vocalStems.length === 0) {
      if(addToast) addToast("You must record at least one take to enter Engineering.", "error");
      return;
    }
    stopEverything();
    if (isFreeLoader && !hasEngToken) handlePurchaseEngineering();
    else setActiveRoom("05");
  };

  const toggleMute = (id: string) => {
    setMutedStems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const applyTrim = async () => {
    if (!trimmingStem) return;
    setIsProcessingTrim(true);
    try {
      let originalBlob = trimmingStem.blob;
      if (!originalBlob && trimmingStem.url) {
        const resp = await fetch(trimmingStem.url);
        if (!resp.ok) throw new Error(`Storage Access Denied (HTTP ${resp.status}).`);
        originalBlob = await resp.blob();
        if (originalBlob.type.includes('text/html') || originalBlob.type.includes('application/json')) throw new Error("Invalid audio payload received.");
      }
      if (!originalBlob) throw new Error("Audio payload missing entirely");

      const newBlob = await trimAudioBlob(originalBlob, trimStart, trimEnd);
      const trimId = `TRIM_${Date.now()}`;
      const fileName = `${userSession?.id || 'anon'}/${trimId}.wav`;

      const { error } = await supabase.storage.from('raw-audio').upload(fileName, newBlob, { contentType: 'audio/wav', upsert: true });
      if (error) throw error;

      const { data: publicData } = supabase.storage.from('raw-audio').getPublicUrl(fileName);

      removeVocalStem(trimmingStem.id);
      addVocalStem({ id: trimId, type: trimmingStem.type, url: publicData.publicUrl, blob: newBlob, volume: trimmingStem.volume, offsetBars: trimmingStem.offsetBars });
      
      setTrimmingStem(null);
      if (addToast) addToast("Trimmed audio successfully synced to vault.", "success");
    } catch (err: any) {
      console.error("Trim math failed:", err);
      if (addToast) addToast(err.message || "Failed to slice audio.", "error");
    } finally {
      setIsProcessingTrim(false);
    }
  };

  const togglePlayback = async () => {
    if (!wavesurferRef.current || !audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContextClass();
      if (!wavesurferRef.current) return;
    }
    
    if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();

    const willPlay = !isPlaying;
    setIsPlaying(willPlay);
    const playheadTime = wavesurferRef.current.getCurrentTime();

    if (willPlay) {
      const scheduleTime = audioCtxRef.current.currentTime + 0.05; 
      wavesurferRef.current.play();
      activeSourcesRef.current.forEach(src => { try { src.disconnect() } catch(e){} });
      activeSourcesRef.current = [];

      vocalStems.forEach(stem => {
        if (mutedStems.has(stem.id)) return;
        const buffer = stemBuffersRef.current.get(stem.id);
        if (buffer) {
          const source = audioCtxRef.current!.createBufferSource();
          const gainNode = audioCtxRef.current!.createGain();
          source.buffer = buffer;
          gainNode.gain.value = stem.volume ?? 1;
          source.connect(gainNode);
          gainNode.connect(audioCtxRef.current!.destination);
          
          const offsetSecs = (stem.offsetBars || 0) * secondsPerBar;
          if (playheadTime < offsetSecs) {
            source.start(scheduleTime + (offsetSecs - playheadTime));
          } else {
            const bufferOffset = playheadTime - offsetSecs;
            if (bufferOffset < buffer.duration) source.start(scheduleTime, bufferOffset);
          }
          activeSourcesRef.current.push(source);
        }
      });
    } else {
      wavesurferRef.current.pause();
      activeSourcesRef.current.forEach(src => { try { src.stop(); src.disconnect(); } catch (e) {} });
      activeSourcesRef.current = [];
    }
  };

  const stopEverything = async () => {
    wavesurferRef.current?.pause(); 
    wavesurferRef.current?.seekTo(0);
    activeSourcesRef.current.forEach(src => { try { src.stop(); src.disconnect(); } catch (e) {} });
    activeSourcesRef.current = [];

    if (isRecording && workletNodeRef.current && audioCtxRef.current) {
      workletNodeRef.current.disconnect();
      if (mediaSourceRef.current) mediaSourceRef.current.disconnect();
      
      const totalLength = recordedChunksRef.current.reduce((acc, val) => acc + val.length, 0);
      const merged = new Float32Array(totalLength);
      let offset = 0;
      for (let chunk of recordedChunksRef.current) { merged.set(chunk, offset); offset += chunk.length; }
      const wavBlob = encodeWAV(merged, audioCtxRef.current.sampleRate);
      
      setIsRecording(false);
      setIsUploading(true);
      
      try {
        const takeId = `TAKE_${Date.now()}`;
        const fileName = `${userSession?.id || 'anon'}/${takeId}.wav`;

        const { error } = await supabase.storage.from('raw-audio').upload(fileName, wavBlob, { contentType: 'audio/wav', upsert: true });
        if (error) throw error;

        const { data: publicData } = supabase.storage.from('raw-audio').getPublicUrl(fileName);

        addVocalStem({ id: takeId, type: activeTrack, url: publicData.publicUrl, blob: wavBlob, volume: 1, offsetBars: 0 });
        if (addToast) addToast("Vocal take secured in raw-audio ledger.", "success");
      } catch (err) {
        console.error("Upload error", err);
        if (addToast) addToast("Storage sync failed. Temporarily mapped to local blob.", "error");
        addVocalStem({ id: `TAKE_${Date.now()}`, type: activeTrack, url: URL.createObjectURL(wavBlob), blob: wavBlob, volume: 1, offsetBars: 0 });
      } finally {
        setIsUploading(false);
      }
    }
    
    setIsPlaying(false); setIsRecording(false); setCurrentTime(0);
  };

  const startHardwareRecording = async () => {
    const isMogul = (userSession?.tier as string) === "The Mogul";
    const currentCredits = Number((userSession as any)?.creditsRemaining || (userSession as any)?.credits || 0);

    if (!isMogul) {
      if (currentCredits <= 0) {
        if (addToast) addToast("Insufficient Credits. Top up to record a take.", "error");
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/ledger/consume', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ action: 'record_take', description: 'The Booth: Hardware Vocal Take' })
        });
        if (!res.ok) throw new Error("Ledger Sync Verification Failed.");
        useMatrixStore.setState({ userSession: { ...userSession, creditsRemaining: currentCredits - 1, credits: currentCredits - 1 } as any });
      } catch (err) {
        console.error("Secure Ledger Sync Error:", err);
        if (addToast) addToast("Ledger Sync Error. Take aborted.", "error");
        return; 
      }
    }

    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
    }

    try {
      if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();
      if (!mediaStreamRef.current) {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        mediaSourceRef.current = audioCtxRef.current.createMediaStreamSource(mediaStreamRef.current);
      }
      
      const currentWS_Time = wavesurferRef.current?.getCurrentTime() || 0;
      const LATENCY_OFFSET = 0.05; 
      let padTime = Math.max(0, currentWS_Time - LATENCY_OFFSET);
      recordedChunksRef.current = [new Float32Array(Math.floor(padTime * audioCtxRef.current.sampleRate))];
      
      if (!workletLoadedRef.current) {
        const workletCode = `class RecorderWorklet extends AudioWorkletProcessor { process(inputs) { if (inputs[0] && inputs[0][0]) { this.port.postMessage(new Float32Array(inputs[0][0])); } return true; } } registerProcessor('recorder-worklet', RecorderWorklet);`;
        const blob = new Blob([workletCode], { type: 'application/javascript' });
        await audioCtxRef.current.audioWorklet.addModule(URL.createObjectURL(blob));
        workletLoadedRef.current = true;
      }
      
      const workletNode = new AudioWorkletNode(audioCtxRef.current, 'recorder-worklet');
      workletNodeRef.current = workletNode;
      workletNode.port.onmessage = (e) => recordedChunksRef.current.push(new Float32Array(e.data));
      
      if (mediaSourceRef.current) mediaSourceRef.current.connect(workletNode);
      
      const silenceNode = audioCtxRef.current.createGain();
      silenceNode.gain.value = 0;
      workletNode.connect(silenceNode);
      silenceNode.connect(audioCtxRef.current.destination);
      
      setIsRecording(true); 
      if (!isPlaying) await togglePlayback();
      
    } catch (err) { alert("Hardware microphone access required for Worklet processing."); }
  };

  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    try { audioCtxRef.current = new AudioContextClass(); } catch (e) {}
    return () => {
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') audioCtxRef.current.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('engineering_unlocked') === 'true') {
        window.history.replaceState({}, document.title, window.location.pathname);
        useMatrixStore.setState((state) => ({ userSession: state.userSession ? { ...state.userSession, has_engineering_token: true } as any : null }));
        if (addToast) addToast("Engineering Token Secured. Suite Unlocked.", "success");
        setActiveRoom("05");
      }
    }
  }, [userSession, setActiveRoom, addToast]);

  useEffect(() => {
    let isMounted = true;
    const loadBuffers = async () => {
      if (!audioCtxRef.current) return;
      for (const stem of vocalStems) {
        if (!stemBuffersRef.current.has(stem.id)) {
          try {
            let arrayBuf: ArrayBuffer;
            if (stem.blob) { arrayBuf = await stem.blob.arrayBuffer(); } 
            else {
               const controller = new AbortController();
               const timeoutId = setTimeout(() => controller.abort(), 10000); 
               const resp = await fetch(stem.url, { signal: controller.signal });
               clearTimeout(timeoutId);
               if (!resp.ok) continue;
               const contentType = resp.headers.get('content-type') || '';
               if (contentType.includes('text/html') || contentType.includes('application/json')) continue;
               arrayBuf = await resp.arrayBuffer();
            }
            if (!isMounted) return;
            const audioBuf = await new Promise<AudioBuffer>((resolve, reject) => {
               audioCtxRef.current!.decodeAudioData(arrayBuf, resolve, reject);
            });
            if (isMounted) stemBuffersRef.current.set(stem.id, audioBuf);
          } catch (e: any) { 
            if (e.name !== 'AbortError') console.warn(`Soft-fail decoding stem ${stem.id}:`, e); 
          }
        }
      }
    };
    loadBuffers();
    return () => { isMounted = false; };
  }, [vocalStems]);

  useEffect(() => {
    if (waveformRef.current && audioData?.url && !wavesurferRef.current) {
      wavesurferRef.current = WaveSurfer.create({
        container: waveformRef.current, waveColor: '#333333', progressColor: '#E60000',
        cursorColor: '#ffffff', barWidth: 2, barGap: 1, barRadius: 2, height: 80, normalize: true,
      });
      wavesurferRef.current.on('error', (err) => console.warn("WaveSurfer Soft-fail:", err));
      wavesurferRef.current.load(audioData.url).catch(e => console.warn("WaveSurfer Load Aborted:", e.message));
      
      let lastRender = 0;
      wavesurferRef.current.on('audioprocess', (time) => {
        if (time - lastRender > 0.1) { setCurrentTime(time); lastRender = time; }
      });
      wavesurferRef.current.on('finish', () => stopEverything());
    }
    return () => { wavesurferRef.current?.destroy(); wavesurferRef.current = null; };
  }, [audioData]);

  useEffect(() => {
    if (!generatedLyrics) return;
    const lines = generatedLyrics.split('\n');
    let currentBlockIndex = -1; let barOffsetWithinBlock = 0; 
    const parsed = lines.filter(l => l.trim()).map((text) => {
      if (text.startsWith('[')) { currentBlockIndex++; barOffsetWithinBlock = 0; return { text, startTime: 0, isHeader: true, timestamp: "" }; }
      let blockStartBar = 0;
      if (currentBlockIndex >= 0 && currentBlockIndex < blueprint.length) blockStartBar = (blueprint[currentBlockIndex] as any).startBar ?? 0;
      const absoluteBar = blockStartBar + barOffsetWithinBlock;
      const startTimeSec = absoluteBar * secondsPerBar;
      barOffsetWithinBlock++;
      return { text, startTime: startTimeSec, isHeader: false, timestamp: `(${Math.floor(startTimeSec / 60)}:${Math.floor(startTimeSec % 60).toString().padStart(2, '0')})` };
    });
    setLyricLines(parsed);
  }, [generatedLyrics, audioData, blueprint, secondsPerBar]);

  useEffect(() => {
    if (trimmingStem && trimWaveformRef.current) {
      trimWavesurferRef.current = WaveSurfer.create({
        container: trimWaveformRef.current, waveColor: '#555', progressColor: '#E60000', cursorColor: '#fff', barWidth: 2, barGap: 1, height: 100, normalize: true,
      });
      trimWavesurferRef.current.on('error', (err) => console.warn("Trim WaveSurfer Soft-fail:", err));
      trimWavesurferRef.current.load(trimmingStem.url).catch(e => console.warn("Trim Load Aborted:", e.message));
      trimWavesurferRef.current.on('ready', () => {
        const dur = trimWavesurferRef.current?.getDuration() || 0;
        setTrimDuration(dur); setTrimStart(0); setTrimEnd(dur);
      });
    }
    return () => { trimWavesurferRef.current?.destroy(); trimWavesurferRef.current = null; };
  }, [trimmingStem]);

  useEffect(() => {
    const currentLineIndex = lyricLines.findIndex((l, i) => {
      const nextLine = lyricLines[i + 1];
      return currentTime >= l.startTime && (!nextLine || currentTime < nextLine.startTime);
    });
    if (currentLineIndex !== -1 && teleprompterRef.current) {
      const activeEl = teleprompterRef.current.children[currentLineIndex] as HTMLElement;
      if (activeEl) teleprompterRef.current.scrollTo({ top: activeEl.offsetTop - 150, behavior: 'smooth' });
    }
  }, [currentTime, lyricLines]);

  if (!audioData) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[#E60000] opacity-50">
        <Layers size={64} className="mb-4" />
        <p className="font-oswald text-2xl uppercase tracking-widest">No Instrumental Loaded</p>
        <button onClick={() => setActiveRoom("01")} className="mt-4 text-white text-[10px] uppercase font-mono border border-[#333] px-4 py-2 hover:bg-white hover:text-black transition-all">Return to Lab</button>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[#050505] border border-[#222] rounded-lg overflow-hidden animate-in fade-in duration-500 relative">
      
      {/* LEFT SIDEBAR: TELEPROMPTER */}
      <div className="w-1/2 lg:w-5/12 border-r border-[#222] bg-[#020202] flex flex-col relative shadow-[inset_-10px_0_30px_rgba(0,0,0,0.5)]">
        <div className="p-8 pb-4 border-b border-[#111] flex justify-between items-center">
           <h2 className="font-oswald text-xl uppercase tracking-widest font-bold text-[#555]">Teleprompter</h2>
           {audioData?.bpm && <span className="text-[10px] text-[#E60000] font-mono">{Math.round(audioData.bpm)} BPM</span>}
        </div>
        <div ref={teleprompterRef} className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-12 text-gray-300 font-mono text-sm leading-loose">
          {lyricLines.map((line, i) => {
            const isActive = !line.isHeader && isPlaying && currentTime >= line.startTime && currentTime < (line.startTime + secondsPerBar);
            return (
              <div key={i} className={`${line.isHeader ? 'text-[#E60000] font-bold mt-8 mb-2 tracking-widest text-xs' : 'mb-2 flex items-start gap-3 transition-all duration-300'} ${isActive ? 'text-white bg-[#E60000]/20 py-1 px-3 rounded' : 'py-1 px-3'}`}>
                {!line.isHeader && line.timestamp && <span className="text-[9px] mt-1.5 shrink-0 text-[#555]">{line.timestamp}</span>}
                <span className="flex-1">{line.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT PANEL: MIXER & RECORDER */}
      <div className="flex-1 flex flex-col relative bg-black">
        <div className="h-24 bg-black border-b border-[#222] flex items-center justify-between px-10 relative">
          <div className="flex items-center gap-4">
            <button onClick={togglePlayback} disabled={isUploading} className="w-14 h-14 rounded-full border border-[#333] flex items-center justify-center bg-[#111] hover:bg-white hover:text-black transition-all disabled:opacity-50">
              {isPlaying && !isRecording ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
            </button>
            <button onClick={stopEverything} disabled={isUploading} className="w-14 h-14 rounded-full border border-[#333] flex items-center justify-center bg-[#111] hover:bg-white hover:text-black transition-all text-[#888] disabled:opacity-50">
              <Square size={20} />
            </button>
            <button onClick={isRecording ? stopEverything : startHardwareRecording} disabled={isUploading} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all disabled:opacity-50 ${isRecording ? 'bg-red-950 text-[#E60000] border-2 border-[#E60000] animate-pulse' : 'bg-[#111] border border-[#333] text-white hover:text-[#E60000]'}`}>
              {isUploading ? <Loader2 size={24} className="animate-spin" /> : <Mic size={24} />}
            </button>
          </div>
          
          {isUploading && (
             <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 text-[#E60000] bg-[#110000] px-4 py-1.5 border border-[#E60000]/30 rounded-full animate-pulse">
               <Activity size={14} />
               <span className="font-mono text-[9px] uppercase tracking-widest font-bold">Syncing storage node...</span>
             </div>
          )}
          <div className="font-mono text-3xl font-bold tracking-widest text-[#E60000]">
            {Math.floor(currentTime / 60).toString().padStart(2, '0')}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
          </div>
        </div>

        <div className="p-6 border-b border-[#222] bg-[#050505]">
          <div ref={waveformRef} className="w-full h-20 bg-black border border-[#111] rounded-lg"></div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          <div className="flex border-b border-[#111] mb-6">
            {(["Lead", "Adlib", "Double"] as TrackType[]).map(t => (
              <button key={t} onClick={() => setActiveTrack(t)} className={`flex-1 py-3 font-oswald text-[10px] uppercase tracking-[0.2em] font-bold transition-all ${activeTrack === t ? 'bg-[#E60000] text-white' : 'text-[#444] hover:text-white hover:bg-[#0a0a0a]'}`}>{t} Tracking</button>
            ))}
          </div>

          <h4 className="text-[10px] uppercase font-bold text-[#888] tracking-widest mb-4 flex items-center gap-2"><ListMusic size={14} /> Timeline Layers</h4>
          <div className="space-y-3">
            {vocalStems.map(s => {
              const isMuted = mutedStems.has(s.id);
              return (
              <div key={s.id} className="bg-[#0a0a0a] border border-[#222] p-4 rounded group transition-all">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-4">
                    <select value={s.type || "Lead"} onChange={(e) => handleUpdateTakeType(s.id, e.target.value)} className="bg-black border border-[#333] text-[9px] uppercase font-bold tracking-widest text-[#888] px-2 py-1 outline-none hover:text-white">
                      <option value="Lead">Lead</option><option value="Adlib">Adlib</option><option value="Double">Double</option>
                    </select>
                    <span className="font-mono text-[10px] text-[#444]">{s.id.substring(5, 12)}</span>
                    <span className="font-mono text-[8px] px-1 bg-green-500/10 text-green-500 border border-green-500/20">RAW-AUDIO</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 mr-4">
                      <button onClick={() => setTrimmingStem(s)} className="text-[#888] hover:text-[#E60000] transition-colors"><Scissors size={14} /></button>
                      <button onClick={() => toggleMute(s.id)} className={`transition-colors ${isMuted ? 'text-[#E60000]' : 'text-[#888] hover:text-white'}`}>{isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}</button>
                    </div>
                    <button onClick={() => removeVocalStem(s.id)} className="text-[#333] group-hover:text-red-600 transition-colors"><Trash2 size={14}/></button>
                  </div>
                </div>

                <div className="flex flex-col gap-4 mt-3 border-t border-[#111] pt-4">
                  <div className="flex items-center gap-4">
                    <span className="text-[9px] font-mono text-[#555] uppercase w-16 tracking-widest">Start Bar</span>
                    <div className="flex-1 flex items-center gap-3">
                      <button onClick={() => updateStemOffset(s.id, Math.max(0, (s.offsetBars||0) - 1))} className="text-[#444] hover:text-white"><ChevronLeft size={16}/></button>
                      <div className="flex-1 h-1 bg-[#111] rounded-full relative"><div className="absolute h-full bg-[#E60000] transition-all" style={{ width: `${((s.offsetBars||0) / 64) * 100}%` }}></div></div>
                      <button onClick={() => updateStemOffset(s.id, (s.offsetBars||0) + 1)} className="text-[#444] hover:text-white"><ChevronRight size={16}/></button>
                    </div>
                    <span className="text-xs font-mono text-[#E60000] w-8 text-right font-bold">{s.offsetBars || 0}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[9px] font-mono text-[#555] uppercase w-16 tracking-widest">Take Gain</span>
                    <input type="range" min="0" max="2" step="0.05" value={s.volume ?? 1} onChange={(e) => updateStemVolume(s.id, parseFloat(e.target.value))} className="flex-1 accent-[#E60000] h-1.5 bg-[#222] rounded-full appearance-none cursor-pointer" />
                    <span className="text-xs font-mono text-[#E60000] w-8 text-right font-bold">{Math.round((s.volume ?? 1) * 100)}%</span>
                  </div>
                </div>
              </div>
            )})}
          </div>
        </div>

        <div className="h-16 bg-black border-t border-[#222] flex items-center justify-between px-10">
          <div className="flex items-center gap-2 text-[10px] font-mono text-green-500 uppercase tracking-widest opacity-80">
            {vocalStems.length > 0 && <><Save size={14} /> Storage Synchronized</>}
          </div>
          {isFreeLoader && !hasEngToken ? (
            <button onClick={handleProceedToEngineering} disabled={vocalStems.length === 0} className="flex items-center gap-3 bg-[#E60000] text-white px-8 py-2 font-oswald font-bold uppercase tracking-widest text-xs hover:bg-red-700 transition-all disabled:opacity-30">Unlock Engineering ($4.99) <Lock size={14} /></button>
          ) : (
            <button onClick={handleProceedToEngineering} disabled={vocalStems.length === 0 || isUploading} className="flex items-center gap-3 bg-white text-black px-8 py-2 font-oswald font-bold uppercase tracking-widest text-xs hover:bg-[#E60000] hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed">Engineering Suite <ArrowRight size={16} /></button>
          )}
        </div>
      </div>

      {/* OVERLAYS: TRIMMING STEM */}
      {trimmingStem && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-8 animate-in zoom-in duration-300">
          <div className="bg-[#050505] border border-[#E60000] rounded-lg w-full max-w-2xl p-8 shadow-[0_0_50px_rgba(230,0,0,0.2)]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-oswald text-2xl uppercase tracking-widest text-[#E60000] font-bold flex items-center gap-3"><Scissors size={24} /> Slice Region</h3>
              <button onClick={() => setTrimmingStem(null)} className="text-[#555] hover:text-white"><X size={24}/></button>
            </div>
            <p className="font-mono text-[10px] text-gray-400 uppercase tracking-widest mb-6">Drag sliders to crop dead air from the microphone take.</p>
            <div className="bg-black border border-[#222] p-4 rounded-lg relative">
              <div ref={trimWaveformRef} className="w-full h-24 pointer-events-none"></div>
              <div className="absolute inset-0 px-4 flex flex-col justify-center">
                <input type="range" min={0} max={trimDuration} step={0.01} value={trimStart} onChange={(e) => setTrimStart(Math.min(parseFloat(e.target.value), trimEnd - 0.1))} className="w-full absolute opacity-50 cursor-ew-resize h-full top-0 left-0 accent-[#E60000]" style={{ zIndex: 10 }} />
                <input type="range" min={0} max={trimDuration} step={0.01} value={trimEnd} onChange={(e) => setTrimEnd(Math.max(parseFloat(e.target.value), trimStart + 0.1))} className="w-full absolute opacity-50 cursor-ew-resize h-full top-0 left-0 accent-white" style={{ zIndex: 11 }} />
              </div>
              {trimDuration > 0 && <div className="absolute top-4 bottom-4 bg-[#E60000]/20 border-l-2 border-r-2 border-[#E60000] pointer-events-none" style={{ left: `calc(1rem + ${(trimStart / trimDuration) * (100 - 2)}%)`, width: `${((trimEnd - trimStart) / trimDuration) * (100 - 2)}%` }} />}
            </div>
            <div className="flex justify-between font-mono text-[10px] text-[#888] mt-4 uppercase"><span>Start: {trimStart.toFixed(2)}s</span><span>Keep: {(trimEnd - trimStart).toFixed(2)}s</span><span>End: {trimEnd.toFixed(2)}s</span></div>
            <button onClick={applyTrim} disabled={isProcessingTrim} className="w-full mt-8 bg-[#E60000] text-white py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50">{isProcessingTrim ? <Loader2 size={20} className="animate-spin" /> : <><Scissors size={20} /> Execute Destructive Slice & Upload</>}</button>
          </div>
        </div>
      )}
    </div>
  );
}