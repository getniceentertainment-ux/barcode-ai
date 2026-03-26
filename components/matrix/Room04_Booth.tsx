"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Pause, ArrowRight, Save, Trash2, ListMusic, ChevronLeft, ChevronRight, Volume2, VolumeX, Scissors, X, Loader2, Lock, Layers, Activity, Info } from "lucide-react";
import WaveSurfer from 'wavesurfer.js';
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase"; 

type TrackType = "Lead" | "Adlib" | "Double";

// --- AUDIO TRIMMING UTILITIES ---
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new ArrayBuffer(length);
  const view = new DataView(out);
  const channels = [];
  let sample = 0; let offset = 0; let pos = 0;

  const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2; };
  const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4; };
  const writeString = (offset: number, string: string) => { for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i)); };
  
  writeString(0, 'RIFF'); setUint32(length - 8); writeString(8, 'WAVE'); writeString(12, 'fmt '); setUint32(16); setUint16(1); setUint16(numOfChan);
  setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * numOfChan); setUint16(numOfChan * 2); setUint16(16); writeString(36, 'data'); setUint32(length - pos - 4);

  for (let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));

  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset])); 
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(pos, sample, true); pos += 2;
    }
    offset++;
  }
  return new Blob([view], { type: "audio/wav" });
}

async function trimAudioBlob(originalBlob: Blob, startSec: number, endSec: number): Promise<Blob> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const arrayBuffer = await originalBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  const sampleRate = audioBuffer.sampleRate;
  const startOffset = Math.floor(startSec * sampleRate);
  const endOffset = Math.floor(endSec * sampleRate);
  const frameCount = endOffset - startOffset;

  const trimmedBuffer = audioContext.createBuffer(audioBuffer.numberOfChannels, frameCount, sampleRate);
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    const trimmedData = trimmedBuffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) trimmedData[i] = channelData[startOffset + i];
  }
  return audioBufferToWavBlob(trimmedBuffer);
}

function encodeWAV(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
  };

  writeString(view, 0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE'); writeString(view, 12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  writeString(view, 36, 'data'); view.setUint32(40, samples.length * 2, true);
  
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export default function Room04_Booth() {
  const { generatedLyrics, audioData, vocalStems, addVocalStem, removeVocalStem, updateStemOffset, setActiveRoom, blueprint, userSession, addToast } = useMatrixStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // New state to show upload progress
  const [currentTime, setCurrentTime] = useState(0);
  const [lyricLines, setLyricLines] = useState<{text: string, startTime: number, isHeader: boolean, timestamp?: string}[]>([]);
  const [mutedStems, setMutedStems] = useState<Set<string>>(new Set());
  const [activeTrack, setActiveTrack] = useState<TrackType>("Lead");

  // --- TRIM MODAL STATE ---
  const [trimmingStem, setTrimmingStem] = useState<any | null>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [trimDuration, setTrimDuration] = useState(0);
  const [isProcessingTrim, setIsProcessingTrim] = useState(false);
  const trimWaveformRef = useRef<HTMLDivElement>(null);
  const trimWavesurferRef = useRef<WaveSurfer | null>(null);

  // Web Audio API & Wasm Architecture Refs
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

  // --- SECURITY GATE VARS ---
  const isFreeLoader = (userSession?.tier as string)?.includes("Free Loader");
  const hasEngToken = (userSession as any)?.has_engineering_token === true;

  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtxRef.current = new AudioContextClass();
    return () => {
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
    };
  }, []);

  // --- STRIPE REDIRECT CATCHER ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('engineering_unlocked') === 'true') {
        window.history.replaceState({}, document.title, window.location.pathname);
        
        useMatrixStore.setState((state) => ({
          userSession: state.userSession ? { ...state.userSession, has_engineering_token: true } as any : null
        }));
        
        if (addToast) addToast("Engineering Token Secured. Suite Unlocked.", "success");
        setActiveRoom("05");
      }
    }
  }, [userSession, setActiveRoom, addToast]);

  useEffect(() => {
    const loadBuffers = async () => {
      if (!audioCtxRef.current) return;
      for (const stem of vocalStems) {
        if (!stemBuffersRef.current.has(stem.id)) {
          try {
            const resp = await fetch(stem.url);
            const arrayBuf = await resp.arrayBuffer();
            const audioBuf = await audioCtxRef.current.decodeAudioData(arrayBuf);
            stemBuffersRef.current.set(stem.id, audioBuf);
          } catch (e) { console.error("Failed to decode stem buffer", e); }
        }
      }
    };
    loadBuffers();
  }, [vocalStems]);

  useEffect(() => {
    if (waveformRef.current && audioData?.url && !wavesurferRef.current) {
      wavesurferRef.current = WaveSurfer.create({
        container: waveformRef.current, waveColor: '#333333', progressColor: '#E60000',
        cursorColor: '#ffffff', barWidth: 2, barGap: 1, barRadius: 2, height: 80, normalize: true,
      });
      wavesurferRef.current.load(audioData.url);
      
      let lastRender = 0;
      wavesurferRef.current.on('audioprocess', (time) => {
        if (time - lastRender > 0.1) { setCurrentTime(time); lastRender = time; }
      });
      wavesurferRef.current.on('finish', () => stopEverything());
    }
    return () => { wavesurferRef.current?.destroy(); wavesurferRef.current = null; };
  }, [audioData]);

  // --- TELEPROMPTER PARSING ---
  useEffect(() => {
    if (!generatedLyrics) return;
    const lines = generatedLyrics.split('\n');
    let currentBlockIndex = -1; let barOffsetWithinBlock = 0; 
    const parsed = lines.filter(l => l.trim()).map((text) => {
      if (text.startsWith('[')) { currentBlockIndex++; barOffsetWithinBlock = 0; return { text, startTime: 0, isHeader: true, timestamp: "" }; }
      let blockStartBar = 0;
      if (currentBlockIndex >= 0 && currentBlockIndex < blueprint.length) {
         blockStartBar = (blueprint[currentBlockIndex] as any).startBar ?? 0;
      }
      const absoluteBar = blockStartBar + barOffsetWithinBlock;
      const startTimeSec = absoluteBar * secondsPerBar;
      barOffsetWithinBlock++;
      return { text, startTime: startTimeSec, isHeader: false, timestamp: `(${Math.floor(startTimeSec / 60)}:${Math.floor(startTimeSec % 60).toString().padStart(2, '0')})` };
    });
    setLyricLines(parsed);
  }, [generatedLyrics, audioData, blueprint]);

  useEffect(() => {
    if (trimmingStem && trimWaveformRef.current) {
      trimWavesurferRef.current = WaveSurfer.create({
        container: trimWaveformRef.current, waveColor: '#555', progressColor: '#E60000',
        cursorColor: '#fff', barWidth: 2, barGap: 1, height: 100, normalize: true,
      });
      trimWavesurferRef.current.load(trimmingStem.url);
      trimWavesurferRef.current.on('ready', () => {
        const dur = trimWavesurferRef.current?.getDuration() || 0;
        setTrimDuration(dur);
        setTrimStart(0);
        setTrimEnd(dur);
      });
    }
    return () => { trimWavesurferRef.current?.destroy(); trimWavesurferRef.current = null; };
  }, [trimmingStem]);

  // --- SYNCED SCROLLING ---
  useEffect(() => {
    const currentLineIndex = lyricLines.findIndex((l, i) => {
      const nextLine = lyricLines[i + 1];
      return currentTime >= l.startTime && (!nextLine || currentTime < nextLine.startTime);
    });

    if (currentLineIndex !== -1 && teleprompterRef.current) {
      const activeEl = teleprompterRef.current.children[currentLineIndex] as HTMLElement;
      if (activeEl) {
        teleprompterRef.current.scrollTo({
          top: activeEl.offsetTop - 150,
          behavior: 'smooth'
        });
      }
    }
  }, [currentTime]);

  // --- PERSISTENT STORE SYNC ---
  const handleUpdateTakeType = (id: string, newType: string) => {
    const updatedStems = vocalStems.map(stem => 
      stem.id === id ? { ...stem, type: newType } : stem
    );
    useMatrixStore.setState({ vocalStems: updatedStems } as any);
  };

  // --- STRIPE CHECKOUT FOR ENGINEERING ---
  const handlePurchaseEngineering = async () => {
    if (!userSession?.id) return;
    if(addToast) addToast("Routing to Secure Checkout...", "info");
    try {
      const res = await fetch('/api/stripe/engineering-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userSession.id })
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
    
    if (isFreeLoader && !hasEngToken) {
      handlePurchaseEngineering();
    } else {
      setActiveRoom("05");
    }
  };

  // --- 1. FIXED: Trim Upload to Supabase raw-audio ---
  const applyTrim = async () => {
    if (!trimmingStem) return;
    setIsProcessingTrim(true);
    try {
      // Gracefully handle missing local blob by fetching it from the existing URL
      let originalBlob = trimmingStem.blob;
      if (!originalBlob && trimmingStem.url) {
        const resp = await fetch(trimmingStem.url);
        originalBlob = await resp.blob();
      }
      if (!originalBlob) throw new Error("Audio payload missing");

      const newBlob = await trimAudioBlob(originalBlob, trimStart, trimEnd);
      const trimId = `TRIM_${Date.now()}`;
      const fileName = `${userSession?.id || 'anon'}/${trimId}.wav`;

      // Upload newly trimmed blob directly to Supabase storage
      const { data, error } = await supabase.storage
        .from('raw-audio')
        .upload(fileName, newBlob, {
          contentType: 'audio/wav',
          upsert: true
        });

      if (error) throw error;

      const { data: publicData } = supabase.storage
        .from('raw-audio')
        .getPublicUrl(fileName);

      removeVocalStem(trimmingStem.id);
      addVocalStem({
        id: trimId,
        type: trimmingStem.type,
        url: publicData.publicUrl, // Persistent storage URL
        blob: newBlob, // Kept in memory to prevent refetching during session
        volume: trimmingStem.volume,
        offsetBars: trimmingStem.offsetBars
      });
      
      setTrimmingStem(null);
      if (addToast) addToast("Trimmed audio successfully synced to vault.", "success");
    } catch (err) {
      console.error("Trim failed", err);
      if (addToast) addToast("Failed to upload trimmed file.", "error");
    } finally {
      setIsProcessingTrim(false);
    }
  };

  const togglePlayback = () => {
    if (!wavesurferRef.current || !audioCtxRef.current) return;
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();

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

  // --- 2. FIXED: Record Upload to Supabase raw-audio ---
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

        // Upload directly to Supabase storage bucket
        const { data, error } = await supabase.storage
          .from('raw-audio')
          .upload(fileName, wavBlob, {
            contentType: 'audio/wav',
            upsert: true
          });

        if (error) throw error;

        // Retrieve public URL
        const { data: publicData } = supabase.storage
          .from('raw-audio')
          .getPublicUrl(fileName);

        addVocalStem({ 
          id: takeId, 
          type: activeTrack, 
          url: publicData.publicUrl, // Setting state to the permanent Supabase URL
          blob: wavBlob, // Keep local copy active in memory for instant engineering rendering
          volume: 1, 
          offsetBars: 0 
        });

        if (addToast) addToast("Vocal take secured in raw-audio ledger.", "success");
      } catch (err) {
        console.error("Upload error", err);
        if (addToast) addToast("Storage sync failed. Temporarily mapped to local blob.", "error");
        
        // Fallback to local Blob URL if Supabase throws an error (e.g. internet disconnects)
        addVocalStem({ 
          id: `TAKE_${Date.now()}`, 
          type: activeTrack, 
          url: URL.createObjectURL(wavBlob), 
          blob: wavBlob, 
          volume: 1, 
          offsetBars: 0 
        });
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
      
      if (userSession?.id) {
        const { error } = await supabase
          .from('profiles')
          .update({ credits: currentCredits - 1 })
          .eq('id', userSession.id);

        if (error) {
          console.error("Credit Sync Error:", error);
          if (addToast) addToast("Ledger Sync Error. Take aborted.", "error");
          return;
        }
        
        useMatrixStore.setState({ 
          userSession: { ...userSession, creditsRemaining: currentCredits - 1, credits: currentCredits - 1 } as any
        });
      }
    }

    if (!audioCtxRef.current) return;
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
      workletNode.connect(audioCtxRef.current.destination);
      
      setIsRecording(true); 
      if (!isPlaying) togglePlayback();
      
    } catch (err) { alert("Hardware microphone access required for Worklet processing."); }
  };
  
  const toggleMute = (id: string) => {
    setMutedStems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleTimeUpdate = () => {
    if (wavesurferRef.current) setCurrentTime(wavesurferRef.current.getCurrentTime());
  };

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
      
      {/* LEFT: TELEPROMPTER */}
      <div className="w-1/2 lg:w-5/12 border-r border-[#222] bg-[#020202] flex flex-col relative shadow-[inset_-10px_0_30px_rgba(0,0,0,0.5)]">
        <div className="p-8 pb-4 border-b border-[#111] flex justify-between items-center">
           <h2 className="font-oswald text-xl uppercase tracking-widest font-bold text-[#555]">Teleprompter</h2>
           {audioData?.bpm && <span className="text-[10px] text-[#E60000] font-mono">{Math.round(audioData.bpm)} BPM</span>}
        </div>
        <div ref={teleprompterRef} className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-12 text-gray-300 font-mono text-sm leading-loose">
          {lyricLines.map((line, i) => {
            const isActive = !line.isHeader && isPlaying && currentTime >= line.startTime && currentTime < (line.startTime + secondsPerBar);
            return (
              <div key={i} className={`${line.isHeader ? 'text-[#E60000] font-bold mt-8 mb-2 tracking-widest text-xs' : 'mb-2 flex items-start gap-3 transition-all duration-300'} ${isActive ? 'text-white text-lg font-bold bg-[#E60000]/20 py-1 px-3 border-l-2 border-[#E60000] translate-x-2' : ''}`}>
                {!line.isHeader && line.timestamp && <span className="text-[9px] mt-1.5 shrink-0 text-[#555]">{line.timestamp}</span>}
                <span className="flex-1">{line.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT: TIMELINE & DAW */}
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
          
          {/* UPLOAD STATUS INDICATOR */}
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
              <button 
                key={t}
                onClick={() => setActiveTrack(t)}
                className={`flex-1 py-3 font-oswald text-[10px] uppercase tracking-[0.2em] font-bold transition-all
                  ${activeTrack === t ? 'bg-[#E60000] text-white' : 'text-[#444] hover:text-white hover:bg-[#0a0a0a]'}`}
              >
                {t} Tracking
              </button>
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
                  <div className="flex items-center gap-2 mr-4">
                    <button onClick={() => setTrimmingStem(s)} className="text-[#888] hover:text-[#E60000] transition-colors" title="Trim Dead Air">
                      <Scissors size={14} />
                    </button>
                    <button onClick={() => toggleMute(s.id)} className={`transition-colors ${isMuted ? 'text-[#E60000]' : 'text-[#888] hover:text-white'}`}>
                      {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    </button>
                  </div>
                  <button onClick={() => removeVocalStem(s.id)} className="text-[#333] group-hover:text-red-600 transition-colors"><Trash2 size={14}/></button>
                </div>
              </div>

              <div className="flex flex-col gap-4 mt-3 border-t border-[#111] pt-4">
                <div className="flex items-center gap-4">
                  <span className="text-[9px] font-mono text-[#555] uppercase w-16 tracking-widest">Start Bar</span>
                  <div className="flex-1 flex items-center gap-3">
                    <button onClick={() => updateStemOffset(s.id, Math.max(0, (s.offsetBars||0) - 1))} className="text-[#444] hover:text-white"><ChevronLeft size={16}/></button>
                    <div className="flex-1 h-1 bg-[#111] rounded-full relative">
                       <div className="absolute h-full bg-[#E60000] transition-all" style={{ width: `${((s.offsetBars||0) / 64) * 100}%` }}></div>
                    </div>
                    <button onClick={() => updateStemOffset(s.id, (s.offsetBars||0) + 1)} className="text-[#444] hover:text-white"><ChevronRight size={16}/></button>
                  </div>
                  <span className="text-xs font-mono text-[#E60000] w-8 text-right font-bold">{s.offsetBars || 0}</span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-[9px] font-mono text-[#555] uppercase w-16 tracking-widest">Take Gain</span>
                  <input 
                    type="range" min="0" max="2" step="0.05" value={s.volume ?? 1} 
                    onChange={(e) => updateStemVolume(s.id, parseFloat(e.target.value))} 
                    className="flex-1 accent-[#E60000] h-1.5 bg-[#222] rounded-full appearance-none cursor-pointer" 
                  />
                  <span className="text-xs font-mono text-[#E60000] w-8 text-right font-bold">{Math.round((s.volume ?? 1) * 100)}%</span>
                </div>
              </div>
            </div>
          )})}
        </div>
      </div>

      {trimmingStem && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-8 animate-in zoom-in duration-300">
          <div className="bg-[#050505] border border-[#E60000] rounded-lg w-full max-w-2xl p-8 shadow-[0_0_50px_rgba(230,0,0,0.2)]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-oswald text-2xl uppercase tracking-widest text-[#E60000] font-bold flex items-center gap-3">
                <Scissors size={24} /> Slice Region
              </h3>
              <button onClick={() => setTrimmingStem(null)} className="text-[#555] hover:text-white"><X size={24}/></button>
            </div>
            
            <p className="font-mono text-[10px] text-gray-400 uppercase tracking-widest mb-6">Drag sliders to crop dead air from the microphone take.</p>

            <div className="bg-black border border-[#222] p-4 rounded-lg relative">
              <div ref={trimWaveformRef} className="w-full h-24 pointer-events-none"></div>
              
              <div className="absolute inset-0 px-4 flex flex-col justify-center">
                <input 
                  type="range" min={0} max={trimDuration} step={0.01} value={trimStart}
                  onChange={(e) => setTrimStart(Math.min(parseFloat(e.target.value), trimEnd - 0.1))}
                  className="w-full absolute opacity-50 cursor-ew-resize h-full top-0 left-0 accent-[#E60000]"
                  style={{ zIndex: 10 }}
                />
                <input 
                  type="range" min={0} max={trimDuration} step={0.01} value={trimEnd}
                  onChange={(e) => setTrimEnd(Math.max(parseFloat(e.target.value), trimStart + 0.1))}
                  className="w-full absolute opacity-50 cursor-ew-resize h-full top-0 left-0 accent-white"
                  style={{ zIndex: 11 }}
                />
              </div>

              {trimDuration > 0 && (
                <div 
                  className="absolute top-4 bottom-4 bg-[#E60000]/20 border-l-2 border-r-2 border-[#E60000] pointer-events-none"
                  style={{
                    left: `calc(1rem + ${(trimStart / trimDuration) * (100 - 2)}%)`,
                    width: `${((trimEnd - trimStart) / trimDuration) * (100 - 2)}%`
                  }}
                />
              )}
            </div>

            <div className="flex justify-between font-mono text-[10px] text-[#888] mt-4 uppercase">
              <span>Start: {trimStart.toFixed(2)}s</span>
              <span>Keep: {(trimEnd - trimStart).toFixed(2)}s</span>
              <span>End: {trimEnd.toFixed(2)}s</span>
            </div>

            <button 
              onClick={applyTrim} 
              disabled={isProcessingTrim}
              className="w-full mt-8 bg-[#E60000] text-white py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isProcessingTrim ? <Loader2 size={20} className="animate-spin" /> : <><Scissors size={20} /> Execute Destructive Slice & Upload</>}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}