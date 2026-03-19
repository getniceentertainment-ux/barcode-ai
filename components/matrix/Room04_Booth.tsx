"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Pause, ArrowRight, Activity, Save, Trash2, ListMusic, ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import WaveSurfer from 'wavesurfer.js';
import { useMatrixStore } from "../../store/useMatrixStore";

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
  const { generatedLyrics, audioData, vocalStems, addVocalStem, removeVocalStem, updateStemOffset, setActiveRoom, blueprint } = useMatrixStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [lyricLines, setLyricLines] = useState<{text: string, startTime: number, isHeader: boolean, timestamp?: string}[]>([]);
  const [mutedStems, setMutedStems] = useState<Set<string>>(new Set());

  // Web Audio API & Wasm Architecture Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const stemBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Float32Array[]>([]);

  const secondsPerBar = audioData?.bpm ? (60 / audioData.bpm) * 4 : 2.5;

  // INITIALIZE AUDIO CONTEXT ONCE
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtxRef.current = new AudioContextClass();
    return () => {
      audioCtxRef.current?.close();
    };
  }, []);

  // PRE-LOAD STEMS INTO AUDIO BUFFERS (Zero Latency Preparation)
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
          } catch (e) {
            console.error("Failed to decode stem buffer", e);
          }
        }
      }
    };
    loadBuffers();
  }, [vocalStems]);

  // WAVESURFER INITIALIZATION (Visuals & Instrumental Playback)
  useEffect(() => {
    if (waveformRef.current && audioData?.url && !wavesurferRef.current) {
      wavesurferRef.current = WaveSurfer.create({
        container: waveformRef.current, waveColor: '#333333', progressColor: '#E60000',
        cursorColor: '#ffffff', barWidth: 2, barGap: 1, barRadius: 2, height: 80, normalize: true,
      });
      wavesurferRef.current.load(audioData.url);
      
      // Throttled UI Updates to prevent main-thread locking
      let lastRender = 0;
      wavesurferRef.current.on('audioprocess', (time) => {
        if (time - lastRender > 0.1) {
          setCurrentTime(time);
          lastRender = time;
        }
      });
      
      wavesurferRef.current.on('finish', () => stopEverything());
    }
    return () => { wavesurferRef.current?.destroy(); wavesurferRef.current = null; };
  }, [audioData]);

  // PARSE LYRICS FOR TELEPROMPTER
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

  // SAMPLE ACCURATE PLAYBACK ENGINE
  const togglePlayback = () => {
    if (!wavesurferRef.current || !audioCtxRef.current) return;
    
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    const willPlay = !isPlaying;
    setIsPlaying(willPlay);
    const playheadTime = wavesurferRef.current.getCurrentTime();

    if (willPlay) {
      // Schedule precise playback start slightly in the future
      const scheduleTime = audioCtxRef.current.currentTime + 0.05; 
      
      wavesurferRef.current.play();

      // Clear old sources
      activeSourcesRef.current.forEach(src => src.disconnect());
      activeSourcesRef.current = [];

      // Create new BufferSources for all active stems
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
            // Stem starts in the future
            source.start(scheduleTime + (offsetSecs - playheadTime));
          } else {
            // Stem is already playing, calculate where we are inside the buffer
            const bufferOffset = playheadTime - offsetSecs;
            if (bufferOffset < buffer.duration) {
              source.start(scheduleTime, bufferOffset);
            }
          }
          activeSourcesRef.current.push(source);
        }
      });
    } else {
      wavesurferRef.current.pause();
      activeSourcesRef.current.forEach(src => {
        try { src.stop(); src.disconnect(); } catch (e) {}
      });
      activeSourcesRef.current = [];
    }
  };

  const stopEverything = () => {
    wavesurferRef.current?.pause(); 
    wavesurferRef.current?.seekTo(0);
    
    activeSourcesRef.current.forEach(src => {
      try { src.stop(); src.disconnect(); } catch (e) {}
    });
    activeSourcesRef.current = [];

    if (isRecording && workletNodeRef.current && audioCtxRef.current) {
      workletNodeRef.current.disconnect();
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      
      const totalLength = recordedChunksRef.current.reduce((acc, val) => acc + val.length, 0);
      const merged = new Float32Array(totalLength);
      let offset = 0;
      for (let chunk of recordedChunksRef.current) { merged.set(chunk, offset); offset += chunk.length; }
      const wavBlob = encodeWAV(merged, audioCtxRef.current.sampleRate);
      
      addVocalStem({ id: `TAKE_${Date.now()}`, type: vocalStems.length === 0 ? "Lead" : "Adlib", url: URL.createObjectURL(wavBlob), blob: wavBlob, volume: 1, offsetBars: 0 });
    }
    
    setIsPlaying(false); 
    setIsRecording(false); 
    setCurrentTime(0);
  };

  const startHardwareRecording = async () => {
    if (!audioCtxRef.current) return;
    
    try {
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      mediaStreamRef.current = stream;
      
      // Calculate padding needed to align recorded audio with the playhead
      const currentWS_Time = wavesurferRef.current?.getCurrentTime() || 0;
      const LATENCY_OFFSET = 0.05; // Tightened expected latency
      let padTime = Math.max(0, currentWS_Time - LATENCY_OFFSET);
      recordedChunksRef.current = [new Float32Array(Math.floor(padTime * audioCtxRef.current.sampleRate))];
      
      // Define and load the AudioWorklet
      const workletCode = `class RecorderWorklet extends AudioWorkletProcessor { process(inputs) { if (inputs[0][0]) this.port.postMessage(inputs[0][0]); return true; } } registerProcessor('recorder-worklet', RecorderWorklet);`;
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      await audioCtxRef.current.audioWorklet.addModule(URL.createObjectURL(blob));
      
      const workletNode = new AudioWorkletNode(audioCtxRef.current, 'recorder-worklet');
      workletNodeRef.current = workletNode;
      workletNode.port.onmessage = (e) => recordedChunksRef.current.push(new Float32Array(e.data));
      
      const source = audioCtxRef.current.createMediaStreamSource(stream);
      source.connect(workletNode);
      workletNode.connect(audioCtxRef.current.destination);
      
      setIsRecording(true); 
      
      // Trigger synchronized playback
      if (!isPlaying) {
        togglePlayback();
      }
    } catch (err) { 
      alert("Hardware microphone access required for Worklet processing."); 
    }
  };

  const toggleMute = (id: string) => {
    setMutedStems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-full bg-[#050505] border border-[#222] rounded-lg overflow-hidden animate-in fade-in duration-500">
      
      <div className="w-1/2 lg:w-5/12 border-r border-[#222] bg-[#020202] flex flex-col relative shadow-[inset_-10px_0_30px_rgba(0,0,0,0.5)]">
        <div className="p-8 pb-4 border-b border-[#111] flex justify-between items-center">
           <h2 className="font-oswald text-xl uppercase tracking-widest font-bold text-[#555]">Teleprompter</h2>
           {audioData?.bpm && <span className="text-[10px] text-[#E60000] font-mono">{Math.round(audioData.bpm)} BPM</span>}
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-12 text-gray-300 font-mono text-sm leading-loose">
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

      <div className="flex-1 flex flex-col relative bg-black">
        <div className="h-24 bg-black border-b border-[#222] flex items-center justify-between px-10">
          <div className="flex items-center gap-4">
            <button onClick={togglePlayback} className="w-14 h-14 rounded-full border border-[#333] flex items-center justify-center bg-[#111] hover:bg-white hover:text-black transition-all">
              {isPlaying && !isRecording ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
            </button>
            <button onClick={stopEverything} className="w-14 h-14 rounded-full border border-[#333] flex items-center justify-center bg-[#111] hover:bg-white hover:text-black transition-all text-[#888]">
              <Square size={20} />
            </button>
            <button onClick={isRecording ? stopEverything : startHardwareRecording} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-950 text-[#E60000] border-2 border-[#E60000] animate-pulse' : 'bg-[#111] border border-[#333] text-white hover:text-[#E60000]'}`}>
              <Mic size={24} />
            </button>
          </div>
          <div className="font-mono text-3xl font-bold tracking-widest text-[#E60000]">
            {Math.floor(currentTime / 60).toString().padStart(2, '0')}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
          </div>
        </div>

        <div className="p-6 border-b border-[#222] bg-[#050505]">
           <div ref={waveformRef} className="w-full h-20 bg-black border border-[#111] rounded-lg"></div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          <h4 className="text-[10px] uppercase font-bold text-[#888] tracking-widest mb-4 flex items-center gap-2"><ListMusic size={14} /> Timeline Layers</h4>
          <div className="space-y-3">
            {vocalStems.map(s => {
              const isMuted = mutedStems.has(s.id);
              return (
              <div key={s.id} className="bg-[#0a0a0a] border border-[#222] p-4 rounded group transition-all">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-4">
                    <select 
                      defaultValue={s.type} 
                      className="bg-black border border-[#333] text-[9px] uppercase font-bold tracking-widest text-[#888] px-2 py-1 outline-none hover:text-white"
                    >
                      <option value="Lead">Lead</option>
                      <option value="Adlib">Adlib</option>
                      <option value="Dub">Dub</option>
                      <option value="Harm">Harmony</option>
                    </select>
                    <span className="font-mono text-[10px] text-[#444]">{s.id.substring(5, 12)}</span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 mr-4">
                      <button onClick={() => toggleMute(s.id)} className={`transition-colors ${isMuted ? 'text-[#E60000]' : 'text-[#888] hover:text-white'}`}>
                        {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                      </button>
                    </div>
                    <button onClick={() => removeVocalStem(s.id)} className="text-[#333] group-hover:text-red-600 transition-colors"><Trash2 size={14}/></button>
                  </div>
                </div>

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
              </div>
            )})}
          </div>
        </div>

        <div className="h-16 bg-black border-t border-[#222] flex items-center justify-between px-10">
          <div className="flex items-center gap-2 text-[10px] font-mono text-green-500 uppercase tracking-widest opacity-80">
            {vocalStems.length > 0 && <><Save size={14} /> Wasm Synchronized</>}
          </div>
          <button onClick={() => { stopEverything(); setActiveRoom("05"); }} disabled={vocalStems.length === 0} className="flex items-center gap-3 bg-white text-black px-8 py-2 font-oswald font-bold uppercase tracking-widest text-xs hover:bg-[#E60000] hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed">
            Engineering Suite <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}