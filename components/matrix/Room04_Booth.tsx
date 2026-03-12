"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Pause, ArrowRight, Activity, Save, Trash2, ListMusic } from "lucide-react";
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
  const { generatedLyrics, audioData, vocalStems, addVocalStem, removeVocalStem, setActiveRoom } = useMatrixStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [lyricLines, setLyricLines] = useState<{text: string, startTime: number, isHeader: boolean}[]>([]);
  const [mutedStems, setMutedStems] = useState<Set<string>>(new Set());

  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Float32Array[]>([]);

  useEffect(() => {
    if (waveformRef.current && audioData?.url && !wavesurferRef.current) {
      wavesurferRef.current = WaveSurfer.create({
        container: waveformRef.current, waveColor: '#333333', progressColor: '#E60000',
        cursorColor: '#ffffff', barWidth: 2, barGap: 1, barRadius: 2, height: 80, normalize: true,
        interact: true // THE FIX: explicitly allow clicking to seek
      });
      wavesurferRef.current.load(audioData.url);
      
      wavesurferRef.current.on('audioprocess', (time) => setCurrentTime(time));

      // THE FIX: Sync all stems instantly when the user clicks the timeline to Punch-In
      wavesurferRef.current.on('interaction', (newTime) => {
         setCurrentTime(newTime);
         vocalStems.forEach(stem => {
            const el = document.getElementById(`booth-stem-${stem.id}`) as HTMLAudioElement;
            if (el) el.currentTime = newTime;
         });
      });

      wavesurferRef.current.on('finish', () => stopEverything());
    }
    return () => {
      if (wavesurferRef.current) { wavesurferRef.current.destroy(); wavesurferRef.current = null; }
    };
  }, [audioData, vocalStems]);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') audioCtxRef.current.close();
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!generatedLyrics) return;
    const secondsPerBar = audioData?.bpm ? (60 / audioData.bpm) * 4 : 2.5; 
    const parsed = [];
    const lines = generatedLyrics.split('\n');
    let barCounter = 0; 
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i].trim();
      if (!text) continue;
      if (text.startsWith('[')) parsed.push({ text, startTime: 0, isHeader: true });
      else { parsed.push({ text, startTime: barCounter * secondsPerBar, isHeader: false }); barCounter++; }
    }
    setLyricLines(parsed);
  }, [generatedLyrics, audioData]);

  const togglePlayback = () => {
    if (!wavesurferRef.current) return;
    const willPlay = !isPlaying;
    setIsPlaying(willPlay);
    const currentWS_Time = wavesurferRef.current.getCurrentTime();

    if (willPlay) {
      wavesurferRef.current.play();
      vocalStems.forEach(stem => {
        const el = document.getElementById(`booth-stem-${stem.id}`) as HTMLAudioElement;
        if (el) { el.currentTime = currentWS_Time; el.play().catch(e => console.error(e)); }
      });
    } else {
      wavesurferRef.current.pause();
      vocalStems.forEach(stem => {
        const el = document.getElementById(`booth-stem-${stem.id}`) as HTMLAudioElement;
        if (el) el.pause();
      });
    }
  };

  const stopEverything = () => {
    if (wavesurferRef.current) { wavesurferRef.current.pause(); wavesurferRef.current.seekTo(0); }
    vocalStems.forEach(stem => {
      const el = document.getElementById(`booth-stem-${stem.id}`) as HTMLAudioElement;
      if (el) { el.pause(); el.currentTime = 0; }
    });

    if (isRecording && workletNodeRef.current && audioCtxRef.current) {
      workletNodeRef.current.disconnect();
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      const totalLength = recordedChunksRef.current.reduce((acc, val) => acc + val.length, 0);
      const merged = new Float32Array(totalLength);
      let offset = 0;
      for (let chunk of recordedChunksRef.current) { merged.set(chunk, offset); offset += chunk.length; }
      
      const wavBlob = encodeWAV(merged, audioCtxRef.current.sampleRate);
      addVocalStem({ id: `TAKE_${Date.now()}`, type: vocalStems.length === 0 ? "Lead" : "Adlib", url: URL.createObjectURL(wavBlob), blob: wavBlob, volume: 0 });
      audioCtxRef.current.close(); audioCtxRef.current = null; workletNodeRef.current = null; mediaStreamRef.current = null;
    }
    setIsPlaying(false); setIsRecording(false); setCurrentTime(0);
  };

  const startHardwareRecording = async () => {
    try {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') await audioCtxRef.current.close();
      const sampleRate = 44100;
      const currentWS_Time = wavesurferRef.current?.getCurrentTime() || 0;

      let padTime = currentWS_Time - 0.15;
      if (padTime < 0) padTime = 0;
      recordedChunksRef.current = [new Float32Array(Math.floor(padTime * sampleRate))]; 

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      mediaStreamRef.current = stream;
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
      audioCtxRef.current = audioCtx;

      const workletCode = `class RecorderWorklet extends AudioWorkletProcessor { process(inputs) { if (inputs[0] && inputs[0].length > 0) { this.port.postMessage(inputs[0][0]); } return true; } } registerProcessor('recorder-worklet', RecorderWorklet);`;
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      await audioCtx.audioWorklet.addModule(URL.createObjectURL(blob));

      const source = audioCtx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioCtx, 'recorder-worklet');
      workletNodeRef.current = workletNode;
      workletNode.port.onmessage = (e) => recordedChunksRef.current.push(new Float32Array(e.data));

      source.connect(workletNode); workletNode.connect(audioCtx.destination); 
      if (wavesurferRef.current) wavesurferRef.current.play();
      
      vocalStems.forEach(stem => {
        const el = document.getElementById(`booth-stem-${stem.id}`) as HTMLAudioElement;
        if (el) { el.currentTime = currentWS_Time; el.play().catch(e => console.error(e)); }
      });
      setIsRecording(true); setIsPlaying(true);
    } catch (err) {
      alert("Hardware microphone access is required for zero-latency tracking.");
    }
  };

  const toggleMute = (id: string) => setMutedStems(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return (
    <div className="flex h-full bg-[#050505] border border-[#222] rounded-lg overflow-hidden animate-in fade-in duration-500">
      {vocalStems.map(stem => (<audio key={`audio-${stem.id}`} id={`booth-stem-${stem.id}`} src={stem.url} muted={mutedStems.has(stem.id)} className="hidden" />))}

      <div className="w-1/2 lg:w-5/12 border-r border-[#222] bg-[#020202] flex flex-col relative shadow-[inset_-10px_0_30px_rgba(0,0,0,0.5)]">
        <div className="p-8 pb-4">
           <h2 className="font-oswald text-xl uppercase tracking-widest mb-2 font-bold text-[#555] border-b border-[#111] pb-4 flex items-center justify-between">
             Active Matrix // Teleprompter {audioData?.bpm && <span className="text-[10px] text-[#E60000]">{Math.round(audioData.bpm)} BPM</span>}
           </h2>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-12 text-gray-300 font-mono text-sm leading-loose scroll-smooth">
          {lyricLines.length > 0 ? lyricLines.map((line, i) => {
              let isActive = false;
              if (!line.isHeader && (isPlaying || isRecording)) {
                 const nextLine = lyricLines.slice(i + 1).find(l => !l.isHeader);
                 const endTime = nextLine ? nextLine.startTime : line.startTime + (audioData?.bpm ? (60 / audioData.bpm) * 4 : 2.5);
                 isActive = currentTime >= line.startTime && currentTime < endTime;
              }
              return (
                <p key={i} className={`${line.isHeader ? 'text-[#E60000] font-bold mt-8 mb-2 tracking-widest text-xs' : 'mb-2 transition-all duration-300'} ${isActive ? 'text-white text-lg font-bold bg-[#E60000]/20 py-1 px-3 border-l-2 border-[#E60000] transform translate-x-2' : ''}`}>{line.text}</p>
              )
            }) : <div className="h-full flex flex-col items-center justify-center opacity-20"><p className="uppercase tracking-[0.3em] text-center">NO LYRICS DETECTED</p></div>}
        </div>
      </div>

      <div className="flex-1 flex flex-col relative">
        <div className="h-24 bg-black border-b border-[#222] flex items-center justify-between px-10">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <button onClick={togglePlayback} disabled={isRecording || !audioData?.url} className="w-14 h-14 rounded-full border border-[#333] flex items-center justify-center bg-[#111] text-white hover:bg-white hover:text-black transition-all disabled:opacity-30">
                {isPlaying && !isRecording ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
              </button>
              <button onClick={stopEverything} disabled={(!isPlaying && !isRecording)} className="w-14 h-14 rounded-full border border-[#333] flex items-center justify-center bg-[#111] text-white hover:bg-[#E60000] hover:border-[#E60000] transition-all disabled:opacity-30">
                <Square size={20} />
              </button>
            </div>
            <div className="w-px h-10 bg-[#222]"></div>
            <button onClick={isRecording ? stopEverything : startHardwareRecording} disabled={!audioData?.url} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-950 text-[#E60000] border-2 border-[#E60000] animate-pulse shadow-[0_0_20px_rgba(230,0,0,0.4)]' : 'bg-[#111] border border-[#333] text-white hover:text-[#E60000] hover:border-[#E60000]'} disabled:opacity-30`}>
              <Mic size={24} />
            </button>
          </div>
          <div className="font-mono text-3xl font-bold tracking-widest text-[#E60000]">
            {Math.floor(currentTime / 60).toString().padStart(2, '0')}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
            <span className="text-sm text-[#555]">.{(currentTime % 1).toFixed(2).substring(2)}</span>
          </div>
        </div>

        <div className="bg-[#050505] p-6 border-b border-[#222]">
           <div className="flex justify-between items-center mb-4">
             <p className="text-[10px] text-[#555] font-mono uppercase tracking-widest">Click Waveform to Punch In</p>
           </div>
           <div ref={waveformRef} className="w-full bg-black border border-[#111] rounded-lg overflow-hidden cursor-pointer hover:border-[#E60000] transition-colors"></div>
        </div>

        <div className="flex-1 bg-black flex flex-col items-center justify-center relative overflow-hidden">
          {isRecording && (
            <div className="text-center z-10 animate-in zoom-in">
              <Activity size={80} className="text-[#E60000] animate-bounce mx-auto mb-4" />
              <h3 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white mb-2">Punch-In Active</h3>
            </div>
          )}
        </div>

        <div className="h-48 bg-[#050505] border-t border-[#222] p-6 overflow-y-auto custom-scrollbar flex flex-col relative z-20">
          <h4 className="text-[10px] uppercase font-bold text-[#888] tracking-widest mb-4 flex items-center gap-2"><ListMusic size={14} /> Recorded Vocal Stems</h4>
          <div className="space-y-2">
            {vocalStems.map(stem => (
              <div key={stem.id} className={`flex justify-between items-center bg-[#111] p-3 border ${mutedStems.has(stem.id) ? 'border-[#330000] opacity-60' : 'border-[#333]'}`}>
                <div className="flex items-center gap-3">
                   <span className={`text-[9px] uppercase font-bold tracking-widest px-2 py-1 ${stem.type === 'Lead' ? 'bg-[#E60000] text-white' : 'bg-[#222] text-[#888]'}`}>{stem.type}</span>
                   <span className="font-mono text-[10px] text-white uppercase">{stem.id.substring(5, 15)}</span>
                </div>
                <div className="flex items-center gap-4">
                   <button onClick={() => toggleMute(stem.id)} className={`w-8 h-8 rounded-sm text-[10px] font-bold ${mutedStems.has(stem.id) ? 'bg-red-950 text-red-500 border border-red-500' : 'bg-[#111] text-[#555] hover:text-white border border-[#333]'}`}>M</button>
                   <button onClick={() => removeVocalStem(stem.id)} className="text-[#555] hover:text-[#E60000] transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-16 bg-black border-t border-[#222] flex items-center justify-between px-10 shrink-0">
          <button onClick={() => { stopEverything(); setActiveRoom("05"); }} disabled={vocalStems.length === 0} className="ml-auto flex items-center gap-3 bg-white text-black px-8 py-2 font-oswald font-bold uppercase tracking-widest text-xs hover:bg-[#E60000] hover:text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed">
            Engineering Suite <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}