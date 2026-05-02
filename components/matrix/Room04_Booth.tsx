"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Mic, Square, Play, Pause, ArrowRight, Save, Trash2, ListMusic, ChevronLeft, ChevronRight, 
  Volume2, VolumeX, Scissors, X, Loader2, Lock, Layers, Activity, ToggleLeft, ToggleRight, 
  Crosshair, ListVideo, Music
} from "lucide-react";
import WaveSurfer from 'wavesurfer.js';
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase"; 

type TrackType = "Lead" | "Adlib" | "Double" | "Guide";

type WordMapping = { 
  id: string; 
  word: string; 
  startTime: number; 
  duration: number; 
  slot: number; 
  isWordEnd?: boolean 
};

type LyricLine = { 
  id: string; 
  text: string; 
  originalText: string; 
  startTime: number; 
  lineDuration?: number; 
  isHeader: boolean; 
  timestamp?: string; 
  words?: WordMapping[]; 
  barIndex: number 
};

// --- 🚨 PROPRIETARY MATH: SYLLABLE ESTIMATOR (SYNCED WITH PYTHON HEURISTICS) ---
function estimateSyllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  
  // Mirror the Python regex for silent endings (e, ed, es)
  w = w.replace(/([^laeiouy]es|ed|[^laeiouy]e)$/, '');
  w = w.replace(/^y/, '');
  
  // Count vowel clusters (max 2 length to mirror Python's {1,2} logic)
  const matches = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, matches ? matches.length : 1);
}

// --- AUDIO BUFFER TO WAV BLOB (STUDIO QUALITY) ---
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
  const { 
    generatedLyrics, audioData, vocalStems, addVocalStem, removeVocalStem, 
    updateStemOffset, updateStemVolume, setActiveRoom, blueprint, userSession, 
    addToast, gwStyle, gwGender 
  } = useMatrixStore();

  // Interface State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false); 
  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false);
  const [guideProgress, setGuideProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
  const [activeTrack, setActiveTrack] = useState<TrackType>("Lead");
  const [mutedStems, setMutedStems] = useState<Set<string>>(new Set());

  // Refs
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
  const lastParsedLyricsRef = useRef<string | null>(null);

  // Timing Consts
  const trackDuration = audioData?.duration || 0;
  const secondsPerBar = audioData?.bpm ? (60 / audioData.bpm) * 4 : 2.5;
  const secondsPerSlot = secondsPerBar / 16;
  const isFreeLoader = (userSession?.tier as string)?.includes("Free Loader");
  const hasEngToken = (userSession as any)?.has_engineering_token === true;

  // --- 1. RHYTHMIC SNAP ENGINE (SYLLABLE WEIGHTED) ---
  useEffect(() => {
    if (!generatedLyrics || !audioData || !blueprint) return;
    if (lastParsedLyricsRef.current === generatedLyrics) return; 
    lastParsedLyricsRef.current = generatedLyrics;

    const strikeZone = useMatrixStore.getState().strikeZone || "snare";
    const rawLines = generatedLyrics.split('\n');
    
    // Pool sorting for section mapping
    const llmPools: Record<string, string[]> = { HOOK: [], VERSE: [], INTRO: [], OUTRO: [] };
    let activePoolHeader = "";

    rawLines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('[') && trimmed.includes(']')) {
        activePoolHeader = trimmed.split(' ')[0].replace(/[^A-Z]/g, '');
        if (!llmPools[activePoolHeader]) llmPools[activePoolHeader] = [];
      } else if (activePoolHeader && trimmed.length > 0) {
        let cleanLine = trimmed.replace(/\(?[0-9]{1,2}:[0-9]{2}\)?/g, '').trim();
        cleanLine = cleanLine.replace(/^(?:[A-Z][,:\)]|\s*\[[A-Z]\]\s*|(?:Verse|Hook|Chorus)[^:]*:)\s*/i, '');
        if (cleanLine && cleanLine !== "[Instrumental Break]") {
          llmPools[activePoolHeader].push(cleanLine);
        }
      }
    });

    const parsed: LyricLine[] = [];
    let lineIdCounter = 0;
    const poolPointers: Record<string, number> = { HOOK: 0, VERSE: 0, INTRO: 0, OUTRO: 0 };

    blueprint.forEach((bp, index) => {
      const blockStartBar = (bp as any).startBar !== undefined ? (bp as any).startBar : (index * 8);
      const bars = bp.bars || 8;
      const blockStartTime = blockStartBar * secondsPerBar;

      parsed.push({ 
        id: `hdr-${lineIdCounter++}`, barIndex: blockStartBar, text: `[${bp.type}]`, 
        originalText: `[${bp.type}]`, startTime: blockStartTime, isHeader: true, words: [] 
      });

      let linesForThisBlock: string[] = [];
      if (bp.type === "INSTRUMENTAL") {
        linesForThisBlock = Array(bars).fill("Mmm. Mmm.");
      } else {
        const currentPool = llmPools[bp.type] || [];
        const pointer = poolPointers[bp.type] || 0;
        linesForThisBlock = currentPool.slice(pointer, pointer + bp.bars);
        poolPointers[bp.type] = pointer + linesForThisBlock.length;
      }

      const lineDuration = secondsPerBar; 
      let currentFlowTime = blockStartTime;

      linesForThisBlock.forEach((textLine) => {
        const parts = textLine.split('|').map(p => p.trim());
        const leftWords = parts[0]?.split(/\s+/).filter(w => w.length > 0) || [];
        const rightWords = parts[1]?.split(/\s+/).filter(w => w.length > 0) || [];
        const allWords = [...leftWords, ...rightWords];
        
        const leftSylsList = leftWords.map(w => estimateSyllables(w));
        const totalLeftSyls = leftSylsList.reduce((a, b) => a + b, 0) || 1;
        const rightSylsList = rightWords.map(w => estimateSyllables(w));
        const totalRightSyls = rightSylsList.slice(0, -1).reduce((a, b) => a + b, 0) || 1;

        let currentLeftSylSum = 0;
        let currentRightSylSum = 0;
        const mappedWords: WordMapping[] = [];

        allWords.forEach((w, wIndex) => {
          let slot = 0;
          const totalWords = allWords.length;
          
          if (wIndex < leftWords.length) {
            // BEAT 1 & 2: Weighted spread across Slots 0-4
            slot = Math.floor((currentLeftSylSum / totalLeftSyls) * 4);
            currentLeftSylSum += leftSylsList[wIndex];
          } else if (wIndex === totalWords - 1) {
            // BEAT 4 TARGET: Hard anchor rhyme to Slot 12
            slot = strikeZone === "downbeat" ? 0 : 12; 
          } else {
            // BEAT 2 to 4: Weighted spread across Slots 4-12
            const rightIndex = wIndex - leftWords.length;
            slot = 4 + Math.floor((currentRightSylSum / totalRightSyls) * 8);
            currentRightSylSum += rightSylsList[rightIndex];
          }

          const wordStartTime = currentFlowTime + (slot * (lineDuration / 16));
          const sylCount = estimateSyllables(w);

          mappedWords.push({
            id: `syl-${lineIdCounter}-${Math.random().toString(36).substr(2, 5)}`,
            word: w.replace(/\|/g, ''),
            slot: slot,
            startTime: wordStartTime,
            duration: (lineDuration / 16) * Math.max(1, sylCount * 0.9),
            isWordEnd: (wIndex === leftWords.length - 1 || wIndex === totalWords - 1)
          });
        });

        parsed.push({ 
          id: `line-${lineIdCounter++}`,
          barIndex: Math.floor(currentFlowTime / secondsPerBar),
          text: textLine.replace(/\|/g, ''), 
          originalText: textLine,
          startTime: currentFlowTime, 
          lineDuration: lineDuration, 
          isHeader: false, 
          timestamp: `(${Math.floor(currentFlowTime / 60)}:${Math.floor(currentFlowTime % 60).toString().padStart(2, '0')})`,
          words: mappedWords 
        });
        currentFlowTime += lineDuration;
      });
    });
    setLyricLines(parsed);
  }, [generatedLyrics, audioData, blueprint, secondsPerBar, gwStyle]);

  // --- 2. THE MANUAL QUANTIZE OVERRIDE ---
  const handleWordSlotUpdate = (lineId: string, wordId: string, newSlot: number) => {
    setLyricLines(prev => prev.map(line => {
      if (line.id === lineId && line.words) {
        const newWords = line.words.map(w => {
          if (w.id === wordId) {
             return {
               ...w,
               slot: newSlot,
               startTime: (line.barIndex * secondsPerBar) + (newSlot * secondsPerSlot)
             };
          }
          return w;
        });
        return { ...line, words: newWords };
      }
      return line;
    }));
  };

  // --- 3. HARDWARE RECORDING ENGINE ---
  const startHardwareRecording = async () => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    try {
      if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();
      if (!mediaStreamRef.current) {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } 
        });
        mediaSourceRef.current = audioCtxRef.current.createMediaStreamSource(mediaStreamRef.current);
      }
      
      const currentWS_Time = wavesurferRef.current?.getCurrentTime() || 0;
      recordedChunksRef.current = [new Float32Array(Math.floor(currentWS_Time * audioCtxRef.current.sampleRate))];
      
      if (!workletLoadedRef.current) {
        const workletCode = `class RecorderWorklet extends AudioWorkletProcessor { process(inputs) { if (inputs[0] && inputs[0][0]) { this.port.postMessage(new Float32Array(inputs[0][0])); } return true; } } registerProcessor('recorder-worklet', RecorderWorklet);`;
        await audioCtxRef.current.audioWorklet.addModule(URL.createObjectURL(new Blob([workletCode], { type: 'application/javascript' })));
        workletLoadedRef.current = true;
      }
      
      const workletNode = new AudioWorkletNode(audioCtxRef.current, 'recorder-worklet');
      workletNodeRef.current = workletNode;
      workletNode.port.onmessage = (e) => recordedChunksRef.current.push(new Float32Array(e.data));
      mediaSourceRef.current.connect(workletNode);
      
      const silenceNode = audioCtxRef.current.createGain();
      silenceNode.gain.value = 0; 
      workletNode.connect(silenceNode);
      silenceNode.connect(audioCtxRef.current.destination);
      
      setIsRecording(true); 
      if (!isPlaying) await togglePlayback();
    } catch (err) { alert("Microphone access required."); }
  };

  const stopEverything = async () => {
    wavesurferRef.current?.pause();
    activeSourcesRef.current.forEach(src => { try { src.stop(); src.disconnect(); } catch (e) {} });
    activeSourcesRef.current = [];

    if (isRecording && workletNodeRef.current && audioCtxRef.current) {
      workletNodeRef.current.disconnect();
      const totalLength = recordedChunksRef.current.reduce((acc, val) => acc + val.length, 0);
      const merged = new Float32Array(totalLength);
      let offset = 0;
      for (let chunk of recordedChunksRef.current) { merged.set(chunk, offset); offset += chunk.length; }
      const wavBlob = encodeWAV(merged, audioCtxRef.current.sampleRate);
      
      setIsRecording(false); setIsUploading(true);
      const takeId = `TAKE_${Date.now()}`;
      addVocalStem({ id: takeId, type: activeTrack, url: URL.createObjectURL(wavBlob), blob: wavBlob, volume: 1, offsetBars: 0 });
      setIsUploading(false);
    }
    setIsPlaying(false); setIsRecording(false);
  };

  const togglePlayback = async () => {
    if (!wavesurferRef.current) return;
    const willPlay = !isPlaying;
    setIsPlaying(willPlay);
    if (willPlay) wavesurferRef.current.play();
    else wavesurferRef.current.pause();
  };

  const handleGenerateGuide = async () => {
    setIsGeneratingGuide(true);
    setGuideProgress(0);
    try {
      const parsedLines = lyricLines.filter(l => !l.isHeader && l.text.trim().length > 0);
      for (let i = 0; i < parsedLines.length; i++) {
        setGuideProgress(Math.round(((i + 1) / parsedLines.length) * 100));
        // Mocking TTS Generation for this architecture shell
        await new Promise(r => setTimeout(r, 100));
      }
      if(addToast) addToast("Neural Vocal Guide Synced.", "success");
    } finally { setIsGeneratingGuide(false); }
  };

  const handleProceedToEngineering = () => {
    if (vocalStems.length === 0) {
      if(addToast) addToast("Record a take to continue.", "error");
      return;
    }
    stopEverything();
    setActiveRoom("05");
  };

  // --- RENDER ---
  return (
    <div className="flex h-full bg-[#050505] border border-[#222] rounded-lg overflow-hidden relative font-mono">
      
      {/* 1. LEFT: TELEPROMPTER & QUANTIZER */}
      <div className="w-1/2 lg:w-5/12 border-r border-[#222] bg-[#020202] flex flex-col relative shadow-[inset_-10px_0_30px_rgba(0,0,0,0.5)]">
        <div className="p-8 pb-4 border-b border-[#111] flex justify-between items-center">
           <h2 className="font-oswald text-xl uppercase tracking-widest font-bold text-[#555] flex items-center gap-3">
             <Mic size={20} /> Monitoring Matrix
           </h2>
           <div className="flex bg-black border border-[#222] rounded overflow-hidden">
             <button onClick={() => setIsReviewMode(false)} className={`px-4 py-1.5 text-[9px] uppercase font-bold transition-all ${!isReviewMode ? 'bg-[#E60000] text-white' : 'text-[#555]'}`}>Prompter</button>
             <button onClick={() => setIsReviewMode(true)} className={`px-4 py-1.5 text-[9px] uppercase font-bold transition-all ${isReviewMode ? 'bg-yellow-500 text-black' : 'text-[#555]'}`}>Quantizer</button>
           </div>
        </div>

        <div className="p-4 border-b border-[#222] bg-black flex gap-3">
          <button onClick={handleGenerateGuide} disabled={isGeneratingGuide} className="flex-1 bg-[#110000] border border-[#E60000] text-[#E60000] py-3 text-[9px] uppercase font-bold tracking-widest flex items-center justify-center gap-2 hover:bg-[#E60000] hover:text-white transition-all">
            {isGeneratingGuide ? <Loader2 size={12} className="animate-spin" /> : <Layers size={12} />} 
            {isGeneratingGuide ? `Syncing Guide...` : 'Generate AI Guide'}
          </button>
        </div>

        <div ref={teleprompterRef} className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-[#020202]">
          {isReviewMode ? (
            <div className="space-y-6 pb-24">
              {lyricLines.filter(l => !l.isHeader).map((line) => (
                <div key={line.id} className="bg-black border border-[#222] rounded-sm overflow-hidden group hover:border-yellow-500/30 transition-all">
                  <div className="text-[8px] font-mono text-[#444] p-1.5 bg-[#0a0a0a] border-b border-[#111] uppercase truncate">{line.text}</div>
                  <div className="flex h-10 bg-[#050505]">
                    {Array.from({ length: 16 }).map((_, slotIndex) => {
                      const mappedSyl = line.words?.find(s => s.slot === slotIndex);
                      const isBeat = slotIndex % 4 === 0;
                      return (
                        <div key={slotIndex} className={`flex-1 border-r border-[#111] relative flex items-center justify-center ${isBeat ? 'bg-[#111]' : ''}`}>
                          {mappedSyl && (
                            <div className="absolute z-10 w-[95%] h-[80%] bg-yellow-600 text-black text-[8px] font-bold flex items-center justify-center rounded-sm cursor-move shadow-[0_0_10px_rgba(202,138,4,0.4)] truncate px-1">
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
          ) : (
            <div className="space-y-4 pb-24 leading-loose">
              {lyricLines.map((line, i) => {
                const isActive = !line.isHeader && isPlaying && currentTime >= line.startTime && currentTime < (line.startTime + secondsPerBar);
                return (
                  <div key={i} className={`${line.isHeader ? 'text-[#E60000] font-bold mt-10 mb-4 tracking-[0.2em] text-[10px]' : 'flex items-start gap-4 transition-all duration-500'} ${isActive ? 'text-white text-lg font-bold bg-[#E60000]/10 py-2 px-4 border-l-4 border-[#E60000] translate-x-2' : 'text-[#444]'}`}>
                    {!line.isHeader && <span className="text-[9px] mt-1.5 opacity-30">{line.timestamp}</span>}
                    <span className="flex-1">{line.text}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. RIGHT: TRACKING & WAVEFORMS */}
      <div className="flex-1 flex flex-col bg-black relative">
        <div className="h-24 bg-black border-b border-[#222] flex items-center justify-between px-10 relative">
          <div className="flex items-center gap-4">
            <button onClick={togglePlayback} className="w-14 h-14 rounded-full border border-[#333] flex items-center justify-center bg-[#111] hover:bg-white hover:text-black transition-all">
              {isPlaying && !isRecording ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
            </button>
            <button onClick={stopEverything} className="w-14 h-14 rounded-full border border-[#333] flex items-center justify-center bg-[#111] hover:bg-white hover:text-black transition-all text-[#888]">
              <Square size={20} />
            </button>
            <button onClick={isRecording ? stopEverything : startHardwareRecording} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-950 text-[#E60000] border-2 border-[#E60000] animate-pulse' : 'bg-[#111] border border-[#333] text-white hover:text-[#E60000]'}`}>
              {isUploading ? <Loader2 size={24} className="animate-spin" /> : <Mic size={24} />}
            </button>
          </div>
          <div className="font-mono text-3xl font-bold tracking-tighter text-[#E60000]">
            {Math.floor(currentTime / 60).toString().padStart(2, '0')}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
          </div>
        </div>

        <div className="p-6 border-b border-[#222] bg-[#050505]"><div ref={waveformRef} className="w-full h-20 bg-black border border-[#111] rounded-sm"></div></div>

        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          <div className="flex border-b border-[#111] mb-8">
            {(["Lead", "Adlib", "Double", "Guide"] as TrackType[]).map(t => (
              <button key={t} onClick={() => setActiveTrack(t)} className={`flex-1 py-4 font-oswald text-[10px] uppercase tracking-[0.3em] font-bold transition-all ${activeTrack === t ? 'bg-[#E60000] text-white' : 'text-[#444] hover:text-white hover:bg-[#0a0a0a]'}`}>{t} TAKE</button>
            ))}
          </div>

          <div className="space-y-4 pb-20">
            {vocalStems.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center border border-dashed border-[#222] opacity-20">
                <Music size={32} className="mb-2" />
                <p className="text-[10px] uppercase font-bold tracking-widest text-center">Capture Audio Nodes to Begin Mix Synthesis</p>
              </div>
            ) : vocalStems.map(s => (
              <div key={s.id} className="bg-[#0a0a0a] border border-[#222] p-6 rounded-sm group hover:border-[#E60000]/40 transition-all">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-4">
                    <span className="bg-[#111] border border-[#333] px-2 py-1 text-[9px] font-bold text-white uppercase tracking-widest">{s.type}</span>
                    <span className="font-mono text-[9px] text-[#444] uppercase tracking-tighter">{s.id}</span>
                  </div>
                  <button onClick={() => removeVocalStem(s.id)} className="text-[#333] hover:text-red-600 transition-colors"><Trash2 size={16}/></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-[#111]">
                   <div className="space-y-2">
                     <p className="text-[8px] uppercase text-[#555] font-bold tracking-widest">Temporal Shift (Bars)</p>
                     <div className="flex items-center gap-4">
                        <button onClick={() => updateStemOffset(s.id, Math.max(0, (s.offsetBars||0) - 1))} className="p-2 hover:bg-[#111] text-white transition-colors"><ChevronLeft size={16}/></button>
                        <span className="font-oswald text-xl text-[#E60000] w-12 text-center">{s.offsetBars || 0}</span>
                        <button onClick={() => updateStemOffset(s.id, (s.offsetBars||0) + 1)} className="p-2 hover:bg-[#111] text-white transition-colors"><ChevronRight size={16}/></button>
                     </div>
                   </div>
                   <div className="space-y-2">
                     <p className="text-[8px] uppercase text-[#555] font-bold tracking-widest">Gain Control ({Math.round((s.volume ?? 1) * 100)}%)</p>
                     <input type="range" min="0" max="1.5" step="0.05" value={s.volume ?? 1} onChange={(e) => updateStemVolume(s.id, parseFloat(e.target.value))} className="w-full accent-[#E60000] h-1.5 bg-[#222] rounded-full appearance-none cursor-pointer" />
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-20 bg-black border-t border-[#222] flex items-center justify-between px-10">
          <div className="flex items-center gap-4 text-green-500 font-mono text-[9px] uppercase tracking-widest font-bold border border-green-500/20 px-3 py-1.5 rounded-full bg-green-500/5">
             <Activity size={14} className="animate-pulse" /> 16-Bit Logic Enabled
          </div>
          <button onClick={handleProceedToEngineering} disabled={vocalStems.length === 0} className="bg-white text-black hover:bg-[#E60000] hover:text-white px-10 py-3 font-oswald font-bold uppercase tracking-widest text-sm transition-all flex items-center gap-3">
             Engineering Suite <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}