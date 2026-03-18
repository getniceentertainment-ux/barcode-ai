"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Pause, ArrowRight, Activity, Save, Trash2, ListMusic, ChevronLeft, ChevronRight } from "lucide-react";
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

  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Float32Array[]>([]);

  const secondsPerBar = audioData?.bpm ? (60 / audioData.bpm) * 4 : 2.5;

  useEffect(() => {
    if (waveformRef.current && audioData?.url && !wavesurferRef.current) {
      wavesurferRef.current = WaveSurfer.create({
        container: waveformRef.current, waveColor: '#333333', progressColor: '#E60000',
        cursorColor: '#ffffff', barWidth: 2, barGap: 1, barRadius: 2, height: 80, normalize: true,
      });
      wavesurferRef.current.load(audioData.url);
      wavesurferRef.current.on('audioprocess', (time) => setCurrentTime(time));
      wavesurferRef.current.on('seek' as any, (progress: any) => {
        const time = progress * (wavesurferRef.current?.getDuration() || 0);
        setCurrentTime(time);
        vocalStems.forEach(s => {
            const el = document.getElementById(`booth-stem-${s.id}`) as HTMLAudioElement;
            if(el) el.currentTime = Math.max(0, time - (s.offsetBars * secondsPerBar));
        });
      });
    }
  }, [audioData]);

  useEffect(() => {
    if (!generatedLyrics) return;
    const lines = generatedLyrics.split('\n');
    let currentBlockIndex = -1;
    let barOffsetWithinBlock = 0; 
    const parsed = lines.filter(l => l.trim()).map((text) => {
      if (text.startsWith('[')) {
         currentBlockIndex++; barOffsetWithinBlock = 0;
         return { text, startTime: 0, isHeader: true, timestamp: "" };
      }
      let blockStartBar = 0;
      if (currentBlockIndex >= 0 && currentBlockIndex < blueprint.length) {
         const block = blueprint[currentBlockIndex];
         blockStartBar = (block as any).startBar ?? 0;
      }
      const absoluteBar = blockStartBar + barOffsetWithinBlock;
      const startTimeSec = absoluteBar * secondsPerBar;
      barOffsetWithinBlock++;
      return { text, startTime: startTimeSec, isHeader: false, timestamp: `(${Math.floor(startTimeSec / 60)}:${Math.floor(startTimeSec % 60).toString().padStart(2, '0')})` };
    });
    setLyricLines(parsed);
  }, [generatedLyrics, audioData, blueprint]);

  const togglePlayback = () => {
    if (!wavesurferRef.current) return;
    const willPlay = !isPlaying;
    setIsPlaying(willPlay);
    const time = wavesurferRef.current.getCurrentTime();
    if (willPlay) {
      wavesurferRef.current.play();
      vocalStems.forEach(s => {
        const el = document.getElementById(`booth-stem-${s.id}`) as HTMLAudioElement;
        if (el) {
          el.currentTime = Math.max(0, time - (s.offsetBars * secondsPerBar));
          if (time >= (s.offsetBars * secondsPerBar)) el.play().catch(() => {});
        }
      });
    } else {
      wavesurferRef.current.pause();
      vocalStems.forEach(s => (document.getElementById(`booth-stem-${s.id}`) as HTMLAudioElement)?.pause());
    }
  };

  const stopEverything = () => {
    wavesurferRef.current?.pause(); wavesurferRef.current?.seekTo(0);
    vocalStems.forEach(s => { const el = document.getElementById(`booth-stem-${s.id}`) as HTMLAudioElement; if(el) { el.pause(); el.currentTime = 0; }});
    if (isRecording && workletNodeRef.current) {
      const totalLength = recordedChunksRef.current.reduce((acc, val) => acc + val.length, 0);
      const merged = new Float32Array(totalLength);
      let offset = 0;
      for (let chunk of recordedChunksRef.current) { merged.set(chunk, offset); offset += chunk.length; }
      const wavBlob = encodeWAV(merged, 44100);
      addVocalStem({ id: `TAKE_${Date.now()}`, type: vocalStems.length === 0 ? "Lead" : "Adlib", url: URL.createObjectURL(wavBlob), blob: wavBlob, volume: 0, offsetBars: 0 });
      audioCtxRef.current?.close();
    }
    setIsPlaying(false); setIsRecording(false); setCurrentTime(0);
  };

  const startHardwareRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const audioCtx = new AudioContext({ sampleRate: 44100 });
      audioCtxRef.current = audioCtx;
      const workletCode = `class RecorderWorklet extends AudioWorkletProcessor { process(inputs) { if (inputs[0][0]) this.port.postMessage(inputs[0][0]); return true; } } registerProcessor('recorder-worklet', RecorderWorklet);`;
      await audioCtx.audioWorklet.addModule(URL.createObjectURL(new Blob([workletCode], { type: 'application/javascript' })));
      const workletNode = new AudioWorkletNode(audioCtx, 'recorder-worklet');
      workletNode.port.onmessage = (e) => recordedChunksRef.current.push(new Float32Array(e.data));
      audioCtx.createMediaStreamSource(stream).connect(workletNode);
      workletNode.connect(audioCtx.destination);
      wavesurferRef.current?.play();
      setIsRecording(true); setIsPlaying(true);
    } catch (err) { alert("Hardware mic access required."); }
  };

  return (
    <div className="flex h-full bg-[#050505] border border-[#222] rounded-lg overflow-hidden animate-in fade-in duration-500">
      {vocalStems.map(s => <audio key={s.id} id={`booth-stem-${s.id}`} src={s.url} muted={mutedStems.has(s.id)} className="hidden" />)}
      
      <div className="w-1/2 lg:w-5/12 border-r border-[#222] bg-[#020202] flex flex-col relative">
        <div className="p-8 pb-4 border-b border-[#111] flex justify-between items-center">
           <h2 className="font-oswald text-xl uppercase tracking-widest font-bold text-[#555]">Teleprompter</h2>
           {audioData?.bpm && <span className="text-[10px] text-[#E60000] font-mono">{Math.round(audioData.bpm)} BPM</span>}
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-12 text-gray-300 font-mono text-sm leading-loose">
          {lyricLines.map((line, i) => {
            const isActive = !line.isHeader && isPlaying && currentTime >= line.startTime && currentTime < (line.startTime + secondsPerBar);
            return (
              <div key={i} className={`${line.isHeader ? 'text-[#E60000] font-bold mt-8 mb-2 tracking-widest text-xs' : 'mb-2 flex items-start gap-3 transition-all duration-300'} ${isActive ? 'text-white text-lg font-bold bg-[#E60000]/20 py-1 px-3 border-l-2 border-[#E60000] translate-x-2' : ''}`}>
                {!line.isHeader && <span className="text-[9px] mt-1.5 shrink-0 text-[#555]">{line.timestamp}</span>}
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
            {vocalStems.map(s => (
              <div key={s.id} className="bg-[#0a0a0a] border border-[#222] p-4 rounded group">
                <div className="flex justify-between items-center mb-3">
                  <span className={`text-[9px] uppercase font-bold tracking-widest px-2 py-1 ${s.type === 'Lead' ? 'bg-[#E60000] text-white' : 'bg-[#222] text-[#888]'}`}>{s.type}</span>
                  <button onClick={() => removeVocalStem(s.id)} className="text-[#333] group-hover:text-red-600 transition-colors"><Trash2 size={14}/></button>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[9px] font-mono text-[#555] uppercase w-16">Start Bar</span>
                  <div className="flex-1 flex items-center gap-3">
                    <button onClick={() => updateStemOffset(s.id, Math.max(0, s.offsetBars - 1))} className="text-[#444] hover:text-white"><ChevronLeft size={16}/></button>
                    <div className="flex-1 h-1 bg-[#111] rounded-full relative">
                       <div className="absolute h-full bg-[#E60000]" style={{ width: `${(s.offsetBars / 64) * 100}%` }}></div>
                    </div>
                    <button onClick={() => updateStemOffset(s.id, s.offsetBars + 1)} className="text-[#444] hover:text-white"><ChevronRight size={16}/></button>
                  </div>
                  <span className="text-xs font-mono text-[#E60000] w-8 text-right font-bold">{s.offsetBars}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-16 bg-black border-t border-[#222] flex items-center justify-end px-10">
          <button onClick={() => setActiveRoom("05")} disabled={vocalStems.length === 0} className="flex items-center gap-3 bg-white text-black px-8 py-2 font-oswald font-bold uppercase tracking-widest text-xs hover:bg-[#E60000] hover:text-white transition-all">
            Engineering Suite <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}