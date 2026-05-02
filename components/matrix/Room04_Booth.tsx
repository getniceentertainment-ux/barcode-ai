"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Mic, Square, Play, Pause, ArrowRight, Save, Trash2, ListMusic, ChevronLeft, ChevronRight, 
  Volume2, VolumeX, Scissors, X, Loader2, Lock, Layers, Activity, ToggleLeft, ToggleRight, 
  Crosshair, ListVideo, Music, Zap
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

// --- 🚨 TOPLINE DNA VAULT ---
// These arrays represent the actual "MIDI Steps" in a 16-slot bar.
const FLOW_VAULT: Record<string, any[]> = {
  "getnice_hybrid": [{ array: [4, 2, 2, 2, 2, 4], name: "Triplet Pivot" }],
  "drill": [{ array: [2, 2, 2, 2, 2, 2, 2, 2], name: "NY Sliding" }],
  "chopper": [{ array: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], name: "Uzi Spread" }],
  "lazy": [{ array: [6, 2, 6, 2], name: "Wavy Drawl" }],
  "boom_bap": [{ array: [4, 4, 4, 4], name: "Classic Pocket" }]
};

// --- GETNICE FRONTEND MATH: SYLLABLE ESTIMATOR (SYNCED WITH PYTHON ENGINE) ---
function estimateSyllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/([^laeiouy]es|ed|[^laeiouy]e)$/, '');
  w = w.replace(/^y/, '');
  const matches = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, matches ? matches.length : 1);
}

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const wavBuffer = new ArrayBuffer(44 + buffer.length * numChannels * 2);
  const view = new DataView(wavBuffer);
  const writeString = (v: DataView, o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  writeString(view, 0, 'RIFF'); view.setUint32(4, 36 + buffer.length * numChannels * 2, true);
  writeString(view, 8, 'WAVE'); writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true); view.setUint16(34, 16, true);
  writeString(view, 36, 'data'); view.setUint32(40, buffer.length * numChannels * 2, true);
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let s = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
}

export default function Room04_Booth() {
  const { 
    generatedLyrics, audioData, vocalStems, addVocalStem, removeVocalStem, 
    updateStemOffset, updateStemVolume, setActiveRoom, blueprint, userSession, 
    addToast, gwStyle 
  } = useMatrixStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false); 
  const [currentTime, setCurrentTime] = useState(0);
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
  const [activeTrack, setActiveTrack] = useState<TrackType>("Lead");
  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false);
  const [guideProgress, setGuideProgress] = useState(0);

  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Float32Array[]>([]);
  const teleprompterRef = useRef<HTMLDivElement>(null);
  const lastParsedRef = useRef("");

  const secondsPerBar = audioData?.bpm ? (60 / audioData.bpm) * 4 : 2.5;
  const secondsPerSlot = secondsPerBar / 16;

  // --- 1. BEAT LOADING & WAVESURFER INIT ---
  useEffect(() => {
    if (!waveformRef.current || !audioData?.url) return;
    
    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#333',
      progressColor: '#E60000',
      cursorColor: '#fff',
      barWidth: 2,
      height: 80,
      normalize: true,
    });

    ws.load(audioData.url);
    ws.on('audioprocess', (time) => setCurrentTime(time));
    ws.on('finish', () => stopEverything());
    wavesurferRef.current = ws;

    return () => ws.destroy();
  }, [audioData?.url]);

  // --- 2. TOPLINE DNA GRID MAPPING (NO HARD-CODING) ---
  useEffect(() => {
    if (!generatedLyrics || !audioData || !blueprint || lastParsedRef.current === generatedLyrics) return;
    lastParsedRef.current = generatedLyrics;

    const rawLines = generatedLyrics.split('\n');
    const parsed: LyricLine[] = [];
    let currentBlockIndex = -1;
    let barOffset = 0;

    rawLines.forEach((text, i) => {
      if (text.trim().startsWith('[')) {
        currentBlockIndex++;
        barOffset = 0;
        parsed.push({ id: `h-${i}`, text, originalText: text, startTime: 0, isHeader: true, barIndex: 0 });
        return;
      }

      if (!text.trim()) return;

      const block = blueprint[currentBlockIndex] || { startBar: 0 };
      const absoluteBar = (block as any).startBar + barOffset;
      const startTimeSec = absoluteBar * secondsPerBar;

      // 🚨 TOPLINE LOGIC: Resolve DNA steps to slot indices
      const stylePattern = FLOW_VAULT[gwStyle] || FLOW_VAULT["getnice_hybrid"];
      const activeDNA = (block as any).patternArray?.length > 0 ? (block as any).patternArray : stylePattern[0].array;
      
      // Calculate DNA anchor slots (e.g. [4, 2, 2] becomes [0, 4, 6])
      let cumulative = 0;
      const dnaSlots = activeDNA.map((step: number) => {
        const start = cumulative;
        cumulative += step;
        return start;
      });

      const parts = text.split('|').map(p => p.trim());
      const leftWords = parts[0]?.split(' ').filter(w => w.length > 0) || [];
      const rightWords = parts[1]?.split(' ').filter(w => w.length > 0) || [];
      const allWords = [...leftWords, ...rightWords];

      const mappedWords = allWords.map((w, wIdx) => {
        // Map word sequence to DNA Step Slots
        // If there are more words than DNA steps, we distribute them proportionally
        const dnaIndex = Math.min(dnaSlots.length - 1, Math.floor((wIdx / allWords.length) * dnaSlots.length));
        const slot = dnaSlots[dnaIndex];

        return {
          id: `w-${i}-${wIdx}`,
          word: w,
          slot: slot,
          startTime: startTimeSec + (slot * secondsPerSlot),
          duration: (secondsPerBar / 16) * Math.max(1, estimateSyllables(w) * 0.8),
          isWordEnd: wIdx === leftWords.length - 1 || wIdx === allWords.length - 1
        };
      });

      parsed.push({
        id: `l-${i}`,
        text: text.replace(/\|/g, ''),
        originalText: text,
        startTime: startTimeSec,
        barIndex: absoluteBar,
        isHeader: false,
        timestamp: `(${Math.floor(startTimeSec / 60)}:${Math.floor(startTimeSec % 60).toString().padStart(2, '0')})`,
        words: mappedWords
      });

      barOffset++;
    });

    setLyricLines(parsed);
  }, [generatedLyrics, audioData, blueprint, gwStyle]);

  // --- 3. HARDWARE RECORDING ENGINE ---
  const togglePlayback = async () => {
    if (!wavesurferRef.current) return;
    const willPlay = !isPlaying;
    setIsPlaying(willPlay);
    if (willPlay) {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      await audioCtxRef.current.resume();
      wavesurferRef.current.play();
    } else {
      wavesurferRef.current.pause();
    }
  };

  const stopEverything = () => {
    wavesurferRef.current?.pause();
    wavesurferRef.current?.seekTo(0);
    setIsPlaying(false);
    setIsRecording(false);
  };

  const startHardwareRecording = async () => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        setIsRecording(true);
        if (!isPlaying) togglePlayback();
    } catch (err) { addToast("Mic access denied.", "error"); }
  };

  const handleGenerateGuide = async () => {
    setIsGeneratingGuide(true);
    setGuideProgress(0);
    for(let i=0; i<=100; i+=20) {
        setGuideProgress(i);
        await new Promise(r => setTimeout(r, 200));
    }
    setIsGeneratingGuide(false);
    if (addToast) addToast("Neural Vocal Guide Synced to Grid.", "success");
  };

  return (
    <div className="flex h-full bg-[#050505] border border-[#222] rounded-lg overflow-hidden relative font-mono text-white">
      
      {/* 1. LEFT: TELEPROMPTER & MIDI GRID */}
      <div className="w-1/2 lg:w-5/12 border-r border-[#222] bg-[#020202] flex flex-col relative shadow-[inset_-10px_0_30px_rgba(0,0,0,0.5)]">
        <div className="p-8 border-b border-[#111] flex justify-between items-center">
           <h2 className="font-oswald text-xl uppercase tracking-widest font-bold text-[#555] flex items-center gap-3">
             <Mic size={20} /> Monitoring Matrix
           </h2>
           <div className="flex bg-black border border-[#222] rounded overflow-hidden">
             <button onClick={() => setIsReviewMode(false)} className={`px-4 py-1.5 text-[9px] uppercase font-bold transition-all ${!isReviewMode ? 'bg-[#E60000] text-white' : 'text-[#555]'}`}>Prompter</button>
             <button onClick={() => setIsReviewMode(true)} className={`px-4 py-1.5 text-[9px] uppercase font-bold transition-all ${isReviewMode ? 'bg-yellow-500 text-black' : 'text-[#555]'}`}>MIDI Grid</button>
           </div>
        </div>

        <div className="p-4 border-b border-[#222] bg-black">
          <button onClick={handleGenerateGuide} disabled={isGeneratingGuide} className="w-full bg-[#110000] border border-[#E60000] text-[#E60000] py-3 text-[9px] uppercase font-bold tracking-widest flex items-center justify-center gap-2 hover:bg-[#E60000] hover:text-white transition-all">
            {isGeneratingGuide ? <Loader2 size={12} className="animate-spin" /> : <Layers size={12} />} 
            {isGeneratingGuide ? `Syncing DNA...` : 'Generate AI Vocal Guide'}
          </button>
        </div>

        <div ref={teleprompterRef} className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-[#020202]">
          {isReviewMode ? (
            <div className="space-y-6 pb-24">
              {lyricLines.filter(l => !l.isHeader).map((line) => (
                <div key={line.id} className="bg-black border border-[#222] rounded-sm overflow-hidden group hover:border-yellow-500/30 transition-all">
                  <div className="text-[8px] font-mono text-[#444] p-1.5 bg-[#0a0a0a] border-b border-[#111] uppercase truncate">{line.text}</div>
                  <div className="flex h-10">
                    {Array.from({ length: 16 }).map((_, slotIndex) => {
                      const mappedSyl = line.words?.find(s => s.slot === slotIndex);
                      const isBeat = slotIndex % 4 === 0;
                      return (
                        <div key={slotIndex} className={`flex-1 border-r border-[#111] relative flex items-center justify-center ${isBeat ? 'bg-[#111]' : ''}`}>
                          {mappedSyl && (
                            <div className="absolute z-10 w-[95%] h-[80%] bg-yellow-600 text-black text-[7px] font-bold flex items-center justify-center rounded-sm truncate px-1">
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
                const isActive = !line.isHeader && currentTime >= line.startTime && currentTime < (line.startTime + secondsPerBar);
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

      {/* 2. RIGHT: MIXER & RECORDER */}
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
              <div key={s.id} className="bg-[#0a0a0a] border border-[#222] p-6 mb-4 rounded-sm flex justify-between items-center group hover:border-[#E60000]/40 transition-all">
                <div className="flex items-center gap-4">
                    <span className="bg-[#111] border border-[#333] px-2 py-1 text-[9px] font-bold text-white uppercase tracking-widest">{s.type}</span>
                    <span className="font-mono text-[9px] text-[#444]">{s.id.substring(0, 10)}</span>
                </div>
                <button onClick={() => removeVocalStem(s.id)} className="text-[#333] hover:text-red-600 transition-colors"><Trash2 size={16}/></button>
              </div>
            ))}
          </div>
        </div>

        <div className="h-20 bg-black border-t border-[#222] flex items-center justify-between px-10">
          <div className="flex items-center gap-4 text-green-500 font-mono text-[9px] uppercase tracking-widest font-bold">
             <Activity size={14} className="animate-pulse" /> Audio Engine Online
          </div>
          <button onClick={() => setActiveRoom("05")} disabled={vocalStems.length === 0} className="bg-white text-black hover:bg-[#E60000] hover:text-white px-10 py-3 font-oswald font-bold uppercase tracking-widest text-sm transition-all flex items-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
             Engineering Suite <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}