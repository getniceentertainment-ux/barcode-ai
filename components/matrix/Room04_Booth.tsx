"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic2, Play, Pause, Square, RefreshCw, Layers, ArrowRight, Activity, Volume2, Info, ChevronRight, Lock } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";


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
  const { audioData, generatedLyrics, vocalStems, addVocalStem, removeVocalStem, setActiveRoom, addToast, userSession } = useMatrixStore();

  const [activeTrack, setActiveTrack] = useState<TrackType>("Lead");
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedChunksRef = useRef<Float32Array[]>([]);
  const workletLoadedRef = useRef(false);
  const teleprompterRef = useRef<HTMLDivElement>(null);

  // --- SECURITY GATE VARS ---
  // Using .includes() catches both "Free Loader" and "The Free Loader" variations securely
  const isFreeLoader = (userSession?.tier as string)?.includes("Free Loader");
  const hasEngToken = (userSession as any)?.has_engineering_token === true;

  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtxRef.current = new AudioContextClass();
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
    };
  }, []);

  // --- STRIPE REDIRECT CATCHER: AUTO-ADVANCE TO ENGINEERING ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('engineering_unlocked') === 'true') {
        // 1. Clean the URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // 2. Optimistically unlock the UI before the webhook finishes to prevent bounce-back
        useMatrixStore.setState((state) => ({
          userSession: state.userSession ? { ...state.userSession, has_engineering_token: true } as any : null
        }));
        
        // 3. Auto-Advance the user into Room 05
        if (addToast) addToast("Engineering Token Secured. Suite Unlocked.", "success");
        setActiveRoom("05");
      }
    }
  }, [userSession, setActiveRoom, addToast]);

  // --- TELEPROMPTER PARSING ---
  const parseLyrics = () => {
    if (!generatedLyrics) return [];
    const lines = generatedLyrics.split('\n');
    return lines.map(line => {
      const match = line.match(/^\((\d+):(\d{2})\)\s*(.*)/);
      if (match) {
        const seconds = parseInt(match[1]) * 60 + parseInt(match[2]);
        return { time: seconds, text: match[3], raw: line };
      }
      return { time: -1, text: line, raw: line };
    }).filter(l => l.text.trim() !== "");
  };

  const lyricLines = parseLyrics();

  // --- RECORDING LOGIC ---
  const startRecording = async () => {
    const isMogul = (userSession?.tier as string) === "The Mogul";
    const currentCredits = Number((userSession as any)?.creditsRemaining || (userSession as any)?.credits || 0);

    // DEDUCT CREDIT PER TAKE FROM FREE LOADER AND THE ARTIST
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
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        mediaSourceRef.current = audioCtxRef.current.createMediaStreamSource(streamRef.current);
      }
      
      const currentWS_Time = audioRef.current?.currentTime || 0;
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
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
        setIsPlaying(true);
      }
      
    } catch (err) { 
      if(addToast) addToast("Hardware microphone access required.", "error"); 
    }
  };

  const stopRecording = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    
    if (isRecording && workletNodeRef.current && audioCtxRef.current) {
      workletNodeRef.current.disconnect();
      if (mediaSourceRef.current) mediaSourceRef.current.disconnect();
      
      const totalLength = recordedChunksRef.current.reduce((acc, val) => acc + val.length, 0);
      const merged = new Float32Array(totalLength);
      let offset = 0;
      for (let chunk of recordedChunksRef.current) { merged.set(chunk, offset); offset += chunk.length; }
      const wavBlob = encodeWAV(merged, audioCtxRef.current.sampleRate);
      
      addVocalStem({ 
        id: `TAKE_${Date.now()}`, 
        type: activeTrack, 
        url: URL.createObjectURL(wavBlob), 
        blob: wavBlob, 
        volume: 1, 
        offsetBars: 0 
      });
      if(addToast) addToast(`${activeTrack} Take Captured.`, "success");
    }
    
    setIsRecording(false);
  };

  const stopEverything = () => {
    if (isRecording) stopRecording();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
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

  // --- HARDENED NAVIGATION LOGIC ---
  const handleProceedToEngineering = () => {
    if (vocalStems.length === 0) {
      if(addToast) addToast("You must record at least one take to enter Engineering.", "error");
      return;
    }
    stopEverything();
    
    // Force the checkout intercept if they don't have the key
    if (isFreeLoader && !hasEngToken) {
      handlePurchaseEngineering();
    } else {
      setActiveRoom("05");
    }
  };

  // --- SYNCED SCROLLING ---
  useEffect(() => {
    const currentLineIndex = lyricLines.findIndex((l, i) => {
      const nextLine = lyricLines[i + 1];
      return currentTime >= l.time && (!nextLine || currentTime < nextLine.time);
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

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
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
    <div className="h-full flex flex-col bg-[#050505] border border-[#222] rounded-lg overflow-hidden animate-in fade-in duration-500">
      
      <audio 
        ref={audioRef} 
        src={audioData.url} 
        onTimeUpdate={handleTimeUpdate} 
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* TOP: TELEPROMPTER ENVIRONMENT */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-b from-[#050505] via-transparent to-[#050505]" />
        
        <div 
          ref={teleprompterRef}
          className="flex-1 overflow-y-auto custom-scrollbar p-12 space-y-6 text-center"
        >
          {lyricLines.length > 0 ? lyricLines.map((line, i) => {
            const isActive = currentTime >= line.time && (i === lyricLines.length - 1 || currentTime < lyricLines[i+1].time);
            return (
              <div 
                key={i} 
                className={`transition-all duration-300 font-oswald uppercase tracking-widest text-3xl md:text-5xl
                  ${isActive ? 'text-white scale-110 opacity-100' : 'text-[#222] opacity-30 scale-95'}`}
              >
                {line.text}
              </div>
            );
          }) : (
            <div className="h-full flex flex-col items-center justify-center opacity-20">
              <Info size={48} className="mb-4" />
              <p className="font-mono text-xs uppercase tracking-widest">Awaiting Lyric Synchronization...</p>
            </div>
          )}
        </div>

        {/* HUD OVERLAY */}
        <div className="absolute top-6 right-6 z-20 flex gap-3">
          <div className="bg-black/80 border border-[#333] p-3 rounded-sm text-right">
            <p className="text-[8px] font-mono text-[#555] uppercase mb-1">Timecode</p>
            <p className="text-xl font-oswald text-[#E60000] font-bold tabular-nums">
              {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')}
            </p>
          </div>
        </div>
      </div>

      {/* BOTTOM: TRACK STACK & CONTROLS */}
      <div className="h-72 bg-black border-t border-[#222] flex flex-col">
        
        {/* Track Selector Tab */}
        <div className="flex border-b border-[#111]">
          {(["Lead", "Adlib", "Dub"] as TrackType[]).map(t => (
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

        <div className="flex-1 flex items-center px-8 gap-8">
          
          {/* Main Record Trigger */}
          <div className="flex flex-col items-center gap-4">
            <button 
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all border-4 shadow-2xl
                ${isRecording 
                  ? 'bg-transparent border-[#E60000] animate-pulse' 
                  : 'bg-[#E60000] border-[#E60000] hover:scale-105 active:scale-95'}`}
            >
              {isRecording ? <Square size={32} className="text-[#E60000]" /> : <Mic2 size={32} className="text-white" />}
            </button>
            <p className={`font-mono text-[9px] uppercase tracking-widest font-bold ${isRecording ? 'text-[#E60000] animate-bounce' : 'text-[#555]'}`}>
              {isRecording ? "Live Capture" : `Ready for ${activeTrack}`}
            </p>
          </div>

          {/* Stem History */}
          <div className="flex-1 flex gap-4 overflow-x-auto custom-scrollbar h-40 items-center">
            {vocalStems.length === 0 ? (
              <div className="flex flex-col items-center justify-center opacity-10 w-full border border-dashed border-[#333] h-32">
                <Activity size={32} />
                <p className="text-[8px] font-mono uppercase mt-2">Buffer Empty // Awaiting Takes</p>
              </div>
            ) : vocalStems.map(stem => (
              <div key={stem.id} className="w-32 h-32 bg-[#050505] border border-[#222] p-3 flex flex-col justify-between shrink-0 group relative hover:border-[#E60000] transition-colors">
                <button 
                  onClick={() => removeVocalStem(stem.id)}
                  className="absolute -top-2 -right-2 bg-red-900 text-white w-5 h-5 rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
                <div className="text-[8px] font-mono text-[#E60000] uppercase font-bold tracking-widest">{stem.type}</div>
                <div className="flex-1 flex items-center justify-center text-[#333]"><Activity size={24} /></div>
                <div className="text-[8px] font-mono text-[#555] truncate">Take_{stem.id.slice(0,4)}</div>
              </div>
            ))}
          </div>

          {/* Transport Controls - SECURED NAVIGATION */}
          <div className="w-48 border-l border-[#111] pl-8 flex flex-col justify-center gap-4">
            <div className="flex justify-between items-center text-[9px] font-mono text-[#555] uppercase font-bold tracking-widest mb-2">
              <span>Mix Balance</span>
              <Volume2 size={12} />
            </div>
            
            <button 
              onClick={handleProceedToEngineering}
              className="bg-white text-black py-3 font-oswald text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#E60000] hover:text-white transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)]"
            >
              {isFreeLoader && !hasEngToken ? (
                <><Lock size={12}/> Unlock Engineering</>
              ) : (
                <>To Engineering Suite <ChevronRight size={14} /></>
              )}
            </button>
            
          </div>
        </div>
        
        {/* STRIPE ENGINEERING GATE UI */}
        <div className="h-14 bg-black border-t border-[#111] flex items-center justify-between px-8">
          <div className="flex items-center gap-2 text-[9px] font-mono text-green-500 uppercase tracking-widest opacity-80">
            {vocalStems.length > 0 && <><Activity size={12} /> Raw Audio Buffered</>}
          </div>
          
          {isFreeLoader && !hasEngToken ? (
            <button 
              onClick={handleProceedToEngineering} 
              disabled={vocalStems.length === 0} 
              className="flex items-center gap-3 bg-[#E60000] text-white px-6 py-1.5 font-oswald font-bold uppercase tracking-widest text-[10px] hover:bg-red-700 transition-all disabled:opacity-30"
            >
              Unlock Engineering ($4.99) <Lock size={12} />
            </button>
          ) : (
            <button 
              onClick={handleProceedToEngineering} 
              disabled={vocalStems.length === 0} 
              className="flex items-center gap-3 bg-[#111] text-[#888] border border-[#333] px-6 py-1.5 font-oswald font-bold uppercase tracking-widest text-[10px] hover:bg-white hover:text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Engineering Suite <ArrowRight size={12} />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}