"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Mic, Square, Play, Pause, ArrowRight, Save, Trash2, ListMusic, ChevronLeft, ChevronRight, Volume2, VolumeX, Scissors, X, Loader2, Lock, Layers, Activity, ToggleLeft, ToggleRight, Crosshair, ListVideo
} from "lucide-react";
import WaveSurfer from 'wavesurfer.js';
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase"; 

type TrackType = "Lead" | "Adlib" | "Double" | "Guide";

type WordMapping = { id: string; word: string; startTime: number; duration: number; slot: number; isWordEnd?: boolean };
type LyricLine = { id: string; text: string; originalText: string; startTime: number; lineDuration?: number; isHeader: boolean; timestamp?: string; words?: WordMapping[]; barIndex: number };

// --- THE MACRO-RHYTHMIC NEURAL ENGINE ---
function determineRhythmicPattern(style: string, pocket: string, strikeZone: string, hookType: string, flowEvolution: string, isHook: boolean): number[] {
  const st = (style || "").toLowerCase();
  const p = (pocket || "").toLowerCase();
  const sz = (strikeZone || "").toLowerCase();
  const ht = (hookType || "").toLowerCase();

  if (isHook) {
    if (ht.includes("bouncy")) return [2, 1, 1, 2, 2];
    if (ht.includes("triplet")) return [3, 3, 2, 3, 3, 2];
    if (ht.includes("symmetry")) return [4, 2, 2, 4, 4];
    if (ht.includes("prime")) return [5, 3, 5, 3];
    return [6, 2, 8]; 
  }

  if (sz.includes("strike zone") || sz.includes("strike")) return [1, 1, 2, 1, 1, 2, 1, 1, 2];
  if (sz.includes("snare") || sz.includes("2 & 4")) return [4, 2, 2, 4, 2, 2];
  if (sz.includes("downbeat")) return [4, 4, 4, 4];
  if (p.includes("chainlink") || p.includes("chain-link")) return [2, 2, 2, 2, 2, 2, 1, 1, 1, 1];
  if (p.includes("drag") || p.includes("pickup")) return [6, 2, 2, 2, 2, 2];

  if (st.includes("chopper")) return [1, 1, 1, 1, 1, 1, 1, 1];
  if (st.includes("heartbeat")) return [2, 2, 2, 2];
  if (st.includes("triplet")) return [3, 3, 2];
  if (st.includes("lazy")) return [4, 4, 2, 6];
  
  return [4, 2, 2, 3, 1, 4, 2, 2, 2, 2];
}

function chunkWordForVisuals(word: string): string[] {
  const match = word.match(/^([^a-zA-Z]*)([a-zA-Z\']+)([^a-zA-Z]*)$/);
  if (!match || match[2].length <= 3) return [word];
  const alpha = match[2];
  const vowelClusters = alpha.match(/[aeiouy]+/gi);
  if (!vowelClusters || vowelClusters.length <= 1) return [word];
  
  const chunks = [];
  let currentChunk = "";
  for (let i = 0; i < alpha.length; i++) {
    currentChunk += alpha[i];
    const isVowel = /[aeiouy]/i.test(alpha[i]);
    const nextIsVowel = i + 1 < alpha.length ? /[aeiouy]/i.test(alpha[i+1]) : false;
    if (isVowel && !nextIsVowel && i + 2 < alpha.length) {
      const remaining = alpha.slice(i + 1);
      if (/[aeiouy]/i.test(remaining)) {
        currentChunk += alpha[i+1];
        chunks.push(currentChunk);
        currentChunk = "";
        i++; 
      }
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks.filter(c => c.length > 0);
}

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
  const writeString = (v: DataView, o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
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
    audioContext.decodeAudioData(arrayBuffer, resolve, (err) => reject(new Error("Unable to decode audio format.")));
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
  const writeString = (v: DataView, o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
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
  const { 
    generatedLyrics, audioData, vocalStems, addVocalStem, removeVocalStem, 
    updateStemOffset, updateStemVolume, setActiveRoom, blueprint, userSession, 
    addToast, gwStyle, gwPocket, gwStrikeZone, gwHookType, gwFlowEvolution, gwGender
  } = useMatrixStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false); 
  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false);
  const [guideProgress, setGuideProgress] = useState(0); 
  const [autoScroll, setAutoScroll] = useState(true);
  const [teleprompterEnabled, setTeleprompterEnabled] = useState(true);
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
  const [mutedStems, setMutedStems] = useState<Set<string>>(new Set());
  const [activeTrack, setActiveTrack] = useState<TrackType>("Lead");
  const [trimmingStem, setTrimmingStem] = useState<any | null>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [trimDuration, setTrimDuration] = useState(0);
  const [isProcessingTrim, setIsProcessingTrim] = useState(false);
  const [trackDuration, setTrackDuration] = useState<number>(audioData?.duration || 128);

  const waveformRef = useRef<HTMLDivElement>(null);
  const trimWaveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const trimWavesurferRef = useRef<WaveSurfer | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const stemBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recordedChunksRef = useRef<Float32Array[]>([]);
  const workletLoadedRef = useRef(false);
  const teleprompterRef = useRef<HTMLDivElement>(null);
  const timeDisplayRef = useRef<HTMLDivElement>(null);

  const animationFrameRef = useRef<number>();
  const lastActiveLineRef = useRef<number>(-1);
  const isPlayingRef = useRef(false);
  const isRecordingRef = useRef(false);

  const isFreeLoader = (userSession?.tier as string)?.includes("Free Loader");
  const hasEngToken = (userSession as any)?.has_engineering_token === true || (userSession as any)?.hasEngineeringToken === true;

  const actualBeatBars = audioData?.totalBars || 64;
  const preciseBpm = audioData?.bpm || 120;
  const secondsPerBar = (60 / preciseBpm) * 4;
  const secondsPerSlot = secondsPerBar / 16; 

  const handleDragStart = (e: React.DragEvent, lineId: string, syllableId: string, originalSlot: number) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ lineId, syllableId, originalSlot }));
  };

  const handleDrop = (e: React.DragEvent, targetLineId: string, targetSlot: number) => {
    e.preventDefault();
    const dataString = e.dataTransfer.getData("application/json");
    if (!dataString) return;
    const { lineId, syllableId, originalSlot } = JSON.parse(dataString);
    if (lineId !== targetLineId) return; 
    const delta = targetSlot - originalSlot;
    if (delta === 0) return;

    setLyricLines(prev => prev.map(line => {
      if (line.id === targetLineId && !line.isHeader && line.words) {
        const targetIndex = line.words.findIndex(w => w.id === syllableId);
        if (targetIndex === -1) return line;
        const newWords = [...line.words];

        for (let i = targetIndex; i < newWords.length; i++) {
           let newSlot = newWords[i].slot + delta;
           newSlot = Math.max(0, Math.min(15, newSlot)); 
           newWords[i] = { 
             ...newWords[i], 
             slot: newSlot, 
             startTime: (line.barIndex * secondsPerBar) + (newSlot * secondsPerSlot) 
           };
        }
        return { ...line, words: newWords };
      }
      return line;
    }));
  };

  const handleGenerateGuide = async () => {
    if (!lyricLines || lyricLines.length === 0) return;
    setIsGeneratingGuide(true); setGuideProgress(0);
    try {
      const parsedLines = lyricLines.filter(l => !l.isHeader && l.text.trim().length > 0);
      const renderDuration = trackDuration > 0 ? trackDuration + 10 : 300;
      const sampleRate = 44100;
      const OfflineCtxClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
      const offlineCtx = new OfflineCtxClass(1, Math.ceil(sampleRate * renderDuration), sampleRate);

      for (let i = 0; i < parsedLines.length; i++) {
        const line = parsedLines[i];
        setGuideProgress(Math.round(((i + 1) / parsedLines.length) * 100));
        try {
          const res = await fetch('/api/audio/generate-guide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lyrics: line.text.replace(/\|/g, ''), bpm: preciseBpm, gender: gwGender || "male", pitch: "low" })
          });
          const arrayBuffer = await res.arrayBuffer();
          const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
          const mappedWords = line.words;
          if (!mappedWords || mappedWords.length === 0) continue;

          const ttsDuration = audioBuffer.duration;
          const mathLineDuration = line.lineDuration || 2;
          mappedWords.forEach((wObj) => {
            const relativeWordStart = wObj.startTime - line.startTime;
            const ttsOffset = (relativeWordStart / mathLineDuration) * ttsDuration;
            const ttsWordDuration = (wObj.duration / mathLineDuration) * ttsDuration;
            const source = offlineCtx.createBufferSource();
            source.buffer = audioBuffer;
            const gainNode = offlineCtx.createGain();
            
            gainNode.gain.setValueAtTime(0, wObj.startTime);
            gainNode.gain.linearRampToValueAtTime(1, wObj.startTime + 0.01);
            gainNode.gain.setValueAtTime(1, wObj.startTime + wObj.duration);
            gainNode.gain.linearRampToValueAtTime(0, wObj.startTime + wObj.duration + 0.35);
            
            source.connect(gainNode); gainNode.connect(offlineCtx.destination);
            source.start(wObj.startTime, ttsOffset, Math.min(ttsWordDuration + 0.35, ttsDuration - ttsOffset));
          });
        } catch (lineErr) { console.warn("TTS Error", lineErr); }
      }
      const renderedBuffer = await offlineCtx.startRendering();
      const blob = audioBufferToWavBlob(renderedBuffer);
      const url = URL.createObjectURL(blob);
      addVocalStem({ id: `GUIDE_${Date.now()}`, type: "Guide", url, blob, volume: 0.3, offsetBars: 0 });
    } catch (err: any) { addToast("Guide failed", "error"); } finally { setIsGeneratingGuide(false); }
  };

  const updateVisualsRef = useRef<() => void>(() => {});
  updateVisualsRef.current = () => {
    if (!wavesurferRef.current) return;
    const time = wavesurferRef.current.getCurrentTime();
    
    if (timeDisplayRef.current) {
      const mins = Math.floor(time / 60).toString().padStart(2, '0');
      const secs = Math.floor(time % 60).toString().padStart(2, '0');
      timeDisplayRef.current.innerText = `${mins}:${secs}`;
    }
    
    const visualTime = time + 0.08; 

    if (!isReviewMode && teleprompterEnabled && teleprompterRef.current) {
      const lineNodes = teleprompterRef.current.querySelectorAll('.lyric-line-container');
      let currentLineIndex = -1;
      for (let i = 0; i < lyricLines.length; i++) {
        const line = lyricLines[i];
        if (line.isHeader) continue;
        const lineNode = lineNodes[i] as HTMLElement;
        if (!lineNode) continue;
        const nextLine = lyricLines.slice(i+1).find(l => !l.isHeader);
        const endTime = nextLine ? nextLine.startTime : (line.startTime + (line.lineDuration || 2));

        if (visualTime >= line.startTime && visualTime < endTime) {
          currentLineIndex = i;
          lineNode.classList.add('bg-[#E60000]/10', 'border-[#E60000]');
          const chunks = lineNode.querySelectorAll('.syllable-chunk');
          
          line.words?.forEach((wObj, wIdx) => {
            const chunkNode = chunks[wIdx] as HTMLElement;
            if (!chunkNode) return;
            const ballNode = chunkNode.querySelector('.bouncing-ball') as HTMLElement;
            
            if (visualTime >= wObj.startTime && visualTime < wObj.startTime + wObj.duration) {
              chunkNode.classList.add('text-white', 'font-bold', 'drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]');
              chunkNode.classList.remove('text-[#444]', 'text-[#888]');
              
              if (ballNode) {
                ballNode.classList.remove('opacity-0');
                ballNode.classList.add('opacity-100');
                
                let progress = (visualTime - wObj.startTime) / wObj.duration;
                progress = Math.max(0, Math.min(1, progress)); 
                const maxBounce = Math.min(16, wObj.duration * 50); 
                const bounceHeight = Math.sin(progress * Math.PI) * maxBounce;
                
                ballNode.style.transform = `translateX(-50%) translateY(-${bounceHeight}px)`;
              }
            } else if (visualTime >= wObj.startTime + wObj.duration) {
              chunkNode.classList.add('text-[#888]');
              chunkNode.classList.remove('text-white', 'font-bold', 'drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]', 'text-[#444]');
              if (ballNode) {
                ballNode.classList.add('opacity-0');
                ballNode.classList.remove('opacity-100');
                ballNode.style.transform = `translateX(-50%) translateY(0px)`;
              }
            } else {
              chunkNode.classList.add('text-[#444]');
              chunkNode.classList.remove('text-white', 'font-bold', 'drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]', 'text-[#888]');
              if (ballNode) {
                ballNode.classList.add('opacity-0');
                ballNode.classList.remove('opacity-100');
                ballNode.style.transform = `translateX(-50%) translateY(0px)`;
              }
            }
          });
        } else {
          lineNode.classList.remove('bg-[#E60000]/10', 'border-[#E60000]');
          const chunks = lineNode.querySelectorAll('.syllable-chunk');
          chunks.forEach(c => {
             const ball = c.querySelector('.bouncing-ball') as HTMLElement;
             if (ball) {
               ball.classList.add('opacity-0');
               ball.classList.remove('opacity-100');
               ball.style.transform = `translateX(-50%) translateY(0px)`;
             }
             c.classList.remove('text-white', 'font-bold', 'drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]');
          });
        }
      }
      if (autoScroll && currentLineIndex !== -1 && currentLineIndex !== lastActiveLineRef.current) {
        const activeNode = lineNodes[currentLineIndex] as HTMLElement;
        if (activeNode) teleprompterRef.current.scrollTo({ top: activeNode.offsetTop - 150, behavior: 'smooth' });
        lastActiveLineRef.current = currentLineIndex;
      }
    }
  };

  const animationTick = () => {
    updateVisualsRef.current();
    if (isPlayingRef.current || isRecordingRef.current) {
      animationFrameRef.current = requestAnimationFrame(animationTick);
    } else {
      animationFrameRef.current = undefined;
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
    isPlayingRef.current = willPlay; 
    
    const playheadTime = wavesurferRef.current.getCurrentTime();

    if (willPlay) {
      const scheduleTime = audioCtxRef.current.currentTime + 0.05; 
      wavesurferRef.current.play();
      
      if (!animationFrameRef.current) {
         animationFrameRef.current = requestAnimationFrame(animationTick);
      }

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
      if (animationFrameRef.current) {
         cancelAnimationFrame(animationFrameRef.current);
         animationFrameRef.current = undefined;
      }
      activeSourcesRef.current.forEach(src => { try { src.stop(); src.disconnect(); } catch (e) {} });
      activeSourcesRef.current = [];
    }
  };

  const stopEverything = async () => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    setIsRecording(false);
    isRecordingRef.current = false;

    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
    }
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
      
      setIsRecording(false); setIsUploading(true);
      
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
      } finally { setIsUploading(false); }
    }
    
    if (timeDisplayRef.current) timeDisplayRef.current.innerText = "00:00";
    updateVisualsRef.current(); 
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
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } 
        });
        mediaSourceRef.current = audioCtxRef.current.createMediaStreamSource(mediaStreamRef.current);
      }
      
      const LATENCY_OFFSET = 0.06; 
      const currentWS_Time = wavesurferRef.current?.getCurrentTime() || 0;
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
      isRecordingRef.current = true;
      if (!isPlayingRef.current) {
         await togglePlayback();
      }
      
    } catch (err) { 
      alert("Hardware microphone access required for Worklet processing."); 
    }
  };

  const handleUpdateTakeType = (id: string, newType: string) => {
    const updatedStems = vocalStems.map(stem => stem.id === id ? { ...stem, type: newType as TrackType } : stem);
    useMatrixStore.setState({ vocalStems: updatedStems } as any);
  };

  const handlePurchaseEngineering = async () => {
    if (!userSession?.id) return;
    if(addToast) addToast("Routing to Secure Checkout...", "info");
    try {
      const res = await fetch('/api/stripe/engineering-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: userSession.id }) });
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
    } finally { setIsProcessingTrim(false); }
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
      
      wavesurferRef.current.on('ready', () => {
        const dur = wavesurferRef.current?.getDuration() || 0;
        if (dur > 0) setTrackDuration(dur);
      });

      wavesurferRef.current.on('seeking', () => {
         if (!isPlayingRef.current && !isRecordingRef.current) {
            updateVisualsRef.current();
         }
      });
      
      wavesurferRef.current.on('finish', () => stopEverything());
    }
    return () => { wavesurferRef.current?.destroy(); wavesurferRef.current = null; };
  }, [audioData]);

  const lastParsedLyricsRef = useRef<string>("");

  useEffect(() => {
    if (!generatedLyrics) return;
    if (lyricLines.length > 0 && lastParsedLyricsRef.current === generatedLyrics) return; 
    lastParsedLyricsRef.current = generatedLyrics;

    const lines = generatedLyrics.split('\n');
    
    const sanitizedLines = lines.map(l => {
      let text = l.replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ').trim();
      if (text.startsWith('[') && text.includes(']')) return { text, isHeader: true }; 
      
      text = text.replace(/\(?[0-9]{1,2}:[0-9]{2}\)?/g, '') 
                 .replace(/bars?\s*\d+\s*(?:-|to|and)?\s*\d*/gi, '') 
                 .replace(/\(\d+\s*syllables?.*?\)/gi, '') 
                 .replace(/\[\d+\s*syllables?.*?\]/gi, '') 
                 .replace(/\s+/g, ' ').trim();

      return { text, isHeader: false };
    }).filter(obj => obj.text.length > 0);

    const llmBlocks: { header: string, lines: typeof sanitizedLines }[] = [];
    let currentLlmBlock = { header: "", lines: [] as typeof sanitizedLines };

    sanitizedLines.forEach(obj => {
      if (obj.isHeader) {
        if (currentLlmBlock.header || currentLlmBlock.lines.length > 0) llmBlocks.push(currentLlmBlock);
        currentLlmBlock = { header: obj.text, lines: [] };
      } else { currentLlmBlock.lines.push(obj); }
    });
    if (currentLlmBlock.header || currentLlmBlock.lines.length > 0) llmBlocks.push(currentLlmBlock);

    const parsed: LyricLine[] = [];
    let runningBlockStartBar = 0;
    let lineIdCounter = 0;

    blueprint.forEach((bp, index) => {
      const blockData = llmBlocks[index] || { header: `[${bp.type}]`, lines: [] };
      const blockStartBar = (bp as any).startBar !== undefined ? (bp as any).startBar : runningBlockStartBar;
      
      const bars = bp.bars || (bp.type === "INSTRUMENTAL" ? 8 : 4);
      const blockStartTime = blockStartBar * secondsPerBar;

      parsed.push({ id: `hdr-${lineIdCounter++}`, barIndex: blockStartBar, text: `[${bp.type}]`, originalText: `[${bp.type}]`, startTime: blockStartTime, isHeader: true, words: [] });

      if (bp.type === "INSTRUMENTAL") {
         const hums = Array(bars).fill("Mmm. Mmm.").join(" ");
         blockData.lines = [{ text: hums, isHeader: false }];
      }

      const numLines = blockData.lines.length;
      if (numLines > 0) {
        const isHook = bp.type.toUpperCase().includes("HOOK");
        let activePattern = (bp as any).patternArray || determineRhythmicPattern(gwStyle, gwPocket, gwStrikeZone, gwHookType, gwFlowEvolution, isHook);
        
        const safeLines = blockData.lines.slice(0, bars);

        safeLines.forEach((lineObj, lineIndex) => {
          const rawWords = lineObj.text.split(/\s+/).filter(w => w.length > 0);
          const mappedWords: WordMapping[] = [];

          // 🚨 RESTORED EXACT 1-BAR-PER-LINE MATH: Forces absolute bar alignment
          const lineStartTime = blockStartBar * secondsPerBar + (lineIndex * secondsPerBar);
          const actualBarIndex = blockStartBar + lineIndex;

          let totalLineSteps = 0;
          let tempPatternIndex = 0;

          if (lineObj.text.trim().startsWith('...')) totalLineSteps += 4; 

          const wordChunksArray: string[][] = [];
          
          rawWords.forEach(w => {
            const cleanW = w.replace(/\|/g, '').replace(/,/g, '').trim();
            if (cleanW) {
              const chunks = chunkWordForVisuals(cleanW);
              chunks.forEach(() => {
                const stepVal = Number(activePattern[tempPatternIndex % activePattern.length]) || 2;
                totalLineSteps += stepVal; 
                tempPatternIndex++;
              });
              wordChunksArray.push(chunks);
            }
          });

          const cleanTextEnd = lineObj.text.trim().slice(-1);
          if (cleanTextEnd === '.') totalLineSteps += 4;
          else if (cleanTextEnd === ',') totalLineSteps += 1;

          /// 🚨 ABSOLUTE GRID SNAPPING
          // Locks the visual bounce to the exact BPM of the instrumental.
          const timePerStep = secondsPerSlot; 
          
          let localWordTime = lineStartTime;
          let currentSlot = 0;

          if (lineObj.text.trim().startsWith('...')) {
             localWordTime += (4 * timePerStep);
             currentSlot += 4;
          }

          let patternIndex = 0;

          wordChunksArray.forEach((chunks) => {
            chunks.forEach((chunk, cIdx) => {
              const stepsRequired = Number(activePattern[patternIndex % activePattern.length]) || 2;
              patternIndex++;

              const chunkDuration = stepsRequired * timePerStep;
              
              // Map slot proportionately across the grid (0 to 15) so they never stack
              const mappedSlot = currentSlot % 16;

              mappedWords.push({
                id: `syl-${lineIdCounter}-${Math.random().toString(36).substr(2, 5)}`,
                word: chunk,
                slot: mappedSlot,
                startTime: localWordTime,
                duration: chunkDuration, 
                isWordEnd: (cIdx === chunks.length - 1)
              });

              localWordTime += chunkDuration;
              currentSlot += stepsRequired;
            });
          });

          parsed.push({ 
            id: `line-${lineIdCounter++}`,
            barIndex: actualBarIndex,
            text: lineObj.text.replace(/\|/g, ''), 
            originalText: lineObj.text,
            startTime: lineStartTime, 
            lineDuration: secondsPerBar, 
            isHeader: false, 
            timestamp: `(${Math.floor(lineStartTime / 60)}:${Math.floor(lineStartTime % 60).toString().padStart(2, '0')})`,
            words: mappedWords 
          });
        });
      }
      runningBlockStartBar = blockStartBar + bars;
    });
    
    setLyricLines(parsed);
  }, [generatedLyrics, audioData, blueprint, secondsPerBar, gwStyle, gwPocket, gwStrikeZone, gwHookType, gwFlowEvolution]);

  useEffect(() => {
    if (trimmingStem && trimWaveformRef.current) {
      trimWavesurferRef.current = WaveSurfer.create({
        container: trimWaveformRef.current, waveColor: '#555', progressColor: '#E60000', cursorColor: '#fff', barWidth: 2, barGap: 1, height: 100, normalize: true,
      });
      trimWavesurferRef.current.on('error', (err) => console.warn("Trim WaveSurfer Soft-fail:", err));
      
      const safeUrl = trimmingStem.blob ? URL.createObjectURL(trimmingStem.blob) : trimmingStem.url;
      trimWavesurferRef.current.load(safeUrl).catch(e => console.warn("Trim Load Aborted:", e.message));
      
      trimWavesurferRef.current.on('ready', () => {
        const dur = trimWavesurferRef.current?.getDuration() || 0;
        setTrimDuration(dur); setTrimStart(0); setTrimEnd(dur);
      });
    }
    return () => { trimWavesurferRef.current?.destroy(); trimWavesurferRef.current = null; };
  }, [trimmingStem]);

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
    <div className="flex h-full bg-[#050505] border border-[#222] rounded-lg overflow-hidden animate-in fade-in duration-500 relative flex-col">
      
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR: HUD TOGGLE (PROMPTER VS QUANTIZER) */}
        <div className="w-1/2 lg:w-5/12 border-r border-[#222] bg-[#020202] flex flex-col relative shadow-[inset_-10px_0_30px_rgba(0,0,0,0.5)]">
          <div className="p-8 pb-4 border-b border-[#111] flex justify-between items-center relative flex-wrap gap-4">
             <div className="flex items-center gap-4">
               <h2 className="font-oswald text-xl uppercase tracking-widest font-bold text-[#555] flex items-center gap-2">
                  <Mic size={20} /> BOOTH
               </h2>
               
               <div className="flex border border-[#333] rounded overflow-hidden">
                 <button 
                   onClick={() => setIsReviewMode(false)}
                   className={`px-3 py-1.5 text-[9px] uppercase font-mono font-bold transition-all flex items-center gap-1.5 ${!isReviewMode ? 'bg-[#E60000]/20 text-[#E60000]' : 'bg-black text-[#555] hover:text-white'}`}
                 >
                   <ListVideo size={12} /> Prompter
                 </button>
                 <button 
                   onClick={() => setIsReviewMode(true)}
                   className={`px-3 py-1.5 text-[9px] uppercase font-mono font-bold transition-all flex items-center gap-1.5 border-l border-[#333] ${isReviewMode ? 'bg-yellow-500/10 text-yellow-500' : 'bg-black text-[#555] hover:text-white'}`}
                 >
                   <Crosshair size={12} /> Quantize Grid
                 </button>
               </div>
             </div>
             
             {!isReviewMode && (
               <button 
                 onClick={handleGenerateGuide}
                 disabled={isGeneratingGuide || !generatedLyrics}
                 className="bg-[#111] border border-[#333] text-[#E60000] hover:bg-white hover:text-black hover:border-white px-2.5 py-1 text-[9px] uppercase font-mono font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
               >
                 {isGeneratingGuide ? <><Loader2 size={10} className="animate-spin" /> {guideProgress}%</> : <><Mic size={10} /> Sync Guide Audio</>}
               </button>
             )}
          </div>
          
          {/* CONTENT TOGGLE */}
          {isReviewMode ? (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#020202]">
                <div className="mb-6 flex justify-between items-end border-b border-[#222] pb-4">
                  <div>
                    <h3 className="font-oswald text-sm uppercase tracking-widest text-white">MIDI Flow Engine</h3>
                    <p className="font-mono text-[9px] text-[#888] mt-1">Snaking Drag enabled. Shifts subsequent text.</p>
                  </div>
                  <div className="flex gap-2 text-[8px] font-mono text-[#555] uppercase font-bold">
                    <span>Kick (1)</span> | <span>Snare (2,4)</span>
                  </div>
                </div>

                <div className="space-y-4 pb-20">
                  {lyricLines.filter(l => !l.isHeader).map((line) => (
                    <div key={line.id} className="bg-black border border-[#222] rounded overflow-hidden">
                      <div className="text-[8px] font-mono text-[#555] p-1 bg-[#0a0a0a] border-b border-[#111] truncate">{line.text}</div>
                      <div className="flex h-10 relative bg-[#0a0a0a]">
                        {Array.from({ length: 16 }).map((_, slotIndex) => {
                          const mappedSyl = line.words?.find(s => s.slot === slotIndex);
                          const isDownbeat = slotIndex % 4 === 0;
                          const isSnare = slotIndex === 4 || slotIndex === 12;

                          return (
                            <div 
                              key={slotIndex}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => handleDrop(e, line.id, slotIndex)}
                              className={`flex-1 border-r border-[#111] relative flex items-center justify-center
                                ${isDownbeat ? 'bg-[#151515]' : ''} 
                                ${isSnare ? 'bg-[#2a0505]' : ''}
                              `}
                            >
                              {mappedSyl && (
                                <div 
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, line.id, mappedSyl.id, mappedSyl.slot)}
                                  className="absolute z-10 w-[90%] py-1 bg-[#E60000] text-white text-[9px] font-mono font-bold text-center rounded cursor-grab active:cursor-grabbing shadow-[0_0_10px_rgba(230,0,0,0.4)] hover:bg-red-500 overflow-hidden text-ellipsis whitespace-nowrap"
                                  title={mappedSyl.word}
                                >
                                  {mappedSyl.word}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
            </div>
          ) : (
            <div 
              ref={teleprompterRef} 
              onWheel={() => setAutoScroll(false)} 
              onTouchMove={() => setAutoScroll(false)} 
              className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-12 text-gray-300 font-mono text-sm leading-loose relative"
            >
              {lyricLines.map((line, i) => {
                if (line.isHeader) {
                    return <p key={i} className="lyric-line-container text-[#E60000] font-bold mt-8 mb-2 tracking-widest text-xs">{line.text}</p>;
                }
                
                const isActiveLine = teleprompterEnabled && !line.isHeader && i === lastActiveLineRef.current;
                
                return (
                  <div key={i} className={`lyric-line-container mb-2 py-2 px-3 border-l-2 ${isActiveLine ? 'bg-[#E60000]/10 border-[#E60000]' : 'border-transparent'} flex items-start gap-3 transition-colors duration-200`}>
                    {line.timestamp && <span className="text-[9px] mt-1.5 shrink-0 text-[#555]">{line.timestamp}</span>}
                    
                    <span className="flex-1 leading-loose flex flex-wrap gap-y-2">
                      {(() => {
                        const wordGroups: WordMapping[][] = [];
                        let currentGroup: WordMapping[] = [];
                        
                        line.words?.forEach(wObj => {
                          currentGroup.push(wObj);
                          if (wObj.isWordEnd) { 
                            wordGroups.push(currentGroup); 
                            currentGroup = []; 
                          }
                        });
                        if (currentGroup.length > 0) wordGroups.push(currentGroup);

                        return wordGroups.map((group, gIdx) => (
                          <span key={gIdx} className="inline-flex whitespace-nowrap mr-2">
                            {group.map((wObj, wIdx) => {
                              return (
                                <span key={wIdx} className="syllable-chunk relative inline-block text-[#444] transition-colors duration-100">
                                  <span className="bouncing-ball opacity-0 absolute bottom-full mb-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#E60000] rounded-full shadow-[0_0_8px_#E60000] z-50 pointer-events-none transition-opacity duration-150"></span>
                                  {wObj.word}
                                </span>
                              );
                            })}
                          </span>
                        ));
                      })()}
                    </span>
                  </div>
                );
              })}
              
              {teleprompterEnabled && !autoScroll && (
                <div className="sticky bottom-4 w-full flex justify-center mt-8">
                  <button 
                    onClick={() => {
                      setAutoScroll(true);
                      if (lastActiveLineRef.current !== -1 && teleprompterRef.current) {
                        const activeEl = teleprompterRef.current.children[lastActiveLineRef.current] as HTMLElement;
                        if (activeEl) teleprompterRef.current.scrollTo({ top: activeEl.offsetTop - 150, behavior: 'smooth' });
                      }
                    }} 
                    className="bg-[#E60000] text-white text-[9px] px-4 py-2 font-mono uppercase tracking-widest shadow-[0_0_15px_rgba(230,0,0,0.5)] rounded-full flex items-center gap-2 transition-all hover:bg-red-700 hover:scale-105"
                  >
                    <Activity size={12} className="animate-pulse" /> Resume Sync
                  </button>
                </div>
              )}
            </div>
          )}
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
            <div ref={timeDisplayRef} className="font-mono text-3xl font-bold tracking-widest text-[#E60000]">
              00:00
            </div>
          </div>

          <div className="p-6 border-b border-[#222] bg-[#050505]">
            <div ref={waveformRef} className="w-full h-20 bg-black border border-[#111] rounded-lg"></div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
            <div className="flex border-b border-[#111] mb-6">
              {(["Lead", "Adlib", "Double", "Guide"] as TrackType[]).map(t => (
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
                        <option value="Lead">Lead</option><option value="Adlib">Adlib</option><option value="Double">Double</option><option value="Guide">Guide</option>
                      </select>
                      <span className="font-mono text-[10px] text-[#444]">{s.id.substring(5, 12)}</span>
                      <span className={`font-mono text-[8px] px-1 border ${s.type === 'Guide' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'}`}>
                        {s.type === 'Guide' ? 'NEURAL-AUDIO' : 'RAW-AUDIO'}
                      </span>
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