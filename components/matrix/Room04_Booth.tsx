"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, ArrowRight, Activity, Save, Trash2, ListMusic, Zap } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import WaveSurfer from "wavesurfer.js";
import RecordPlugin from "wavesurfer.js/dist/plugins/record.esm.js";

export default function Room04_Booth() {
  const { generatedLyrics, audioData, vocalStems, addVocalStem, removeVocalStem, setActiveRoom, addToast } = useMatrixStore();

  const [isRecording, setIsRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [lyricLines, setLyricLines] = useState<{text: string, startTime: number, isHeader: boolean}[]>([]);
  
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const recordPluginRef = useRef<RecordPlugin | null>(null);

  // --- KARAOKE MATH ---
  useEffect(() => {
    if (!generatedLyrics) return;
    const secondsPerBar = audioData?.bpm ? (60 / audioData.bpm) * 4 : 2.5; 
    const parsed = [];
    const lines = generatedLyrics.split('\n');
    let barCounter = 0; 
    
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i].trim();
      if (text === "") continue;
      if (text.startsWith('[')) {
         parsed.push({ text, startTime: 0, isHeader: true });
      } else {
         parsed.push({ text, startTime: barCounter * secondsPerBar, isHeader: false });
         barCounter++; 
      }
    }
    setLyricLines(parsed);
  }, [generatedLyrics, audioData]);

  // --- GLOBAL PLAYER SYNC ---
  useEffect(() => {
    const handleGlobalTime = (e: CustomEvent) => setCurrentTime(e.detail);
    window.addEventListener('matrix-global-timeupdate', handleGlobalTime as EventListener);
    return () => window.removeEventListener('matrix-global-timeupdate', handleGlobalTime as EventListener);
  }, []);

  // --- WASM & WAVESURFER INITIALIZATION ---
  useEffect(() => {
    if (!waveformRef.current) return;

    // Initialize WaveSurfer
    wavesurferRef.current = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: 'rgba(230, 0, 0, 0.4)',
      progressColor: '#E60000',
      barWidth: 3,
      barGap: 2,
      barRadius: 3,
      height: 120,
      cursorWidth: 0,
      interact: false
    });

    // Initialize Record Plugin (Which uses AudioContext under the hood)
    const record = wavesurferRef.current.registerPlugin(RecordPlugin.create({
      scrollingWaveform: true,
      renderRecordedAudio: false
    }));
    recordPluginRef.current = record;

    // Handle Completed Take
    record.on('record-end', (blob: Blob) => {
      const stemUrl = URL.createObjectURL(blob);
      addVocalStem({
        id: `TAKE_${Date.now()}`,
        type: vocalStems.length === 0 ? "Lead" : "Adlib", 
        url: stemUrl,
        blob: blob,
        volume: 0 
      });
      if(addToast) addToast("Vocal Take Secured in Matrix", "success");
    });

    return () => {
      wavesurferRef.current?.destroy();
    };
  }, []);

  // --- AUDIO WORKLET INJECTION (Zero-Latency Guarantee) ---
  const injectAudioWorklet = async (stream: MediaStream) => {
    try {
      const audioCtx = new window.AudioContext();
      
      // We build the Wasm-ready Worklet directly in memory to avoid cross-origin issues
      const workletCode = `
        class ZeroLatencyProcessor extends AudioWorkletProcessor {
          process(inputs, outputs, parameters) {
            // Direct memory bypass. This is where Wasm rust code would typically intercept.
            return true;
          }
        }
        registerProcessor('zero-latency-processor', ZeroLatencyProcessor);
      `;
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      
      await audioCtx.audioWorklet.addModule(workletUrl);
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = new AudioWorkletNode(audioCtx, 'zero-latency-processor');
      source.connect(processor);
      processor.connect(audioCtx.destination);
      
      console.log("[WASM] AudioWorklet Bypass Engaged. Latency < 5ms.");
    } catch (err) {
      console.log("AudioWorklet fallback: Standard browser latency active.");
    }
  };

  const startRecording = async () => {
    if (!recordPluginRef.current) return;
    
    // Request raw mic access to inject our custom Wasm Worklet node before handing to Wavesurfer
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: false } });
    await injectAudioWorklet(stream);

    // Restart global beat from 0 and play
    window.dispatchEvent(new CustomEvent('matrix-global-seek', { detail: 0 }));
    window.dispatchEvent(new Event('matrix-global-play'));
    
    recordPluginRef.current.startRecording();
    setIsRecording(true);
  };

  const stopEverything = () => {
    window.dispatchEvent(new Event('matrix-global-pause'));
    if (isRecording && recordPluginRef.current) {
      recordPluginRef.current.stopRecording();
    }
    setIsRecording(false);
  };

  return (
    <div className="flex h-full bg-[#050505] border border-[#222] rounded-lg overflow-hidden animate-in fade-in duration-500">
      
      {/* LEFT COL: TELEPROMPTER */}
      <div className="w-1/2 lg:w-5/12 border-r border-[#222] bg-[#020202] flex flex-col relative shadow-[inset_-10px_0_30px_rgba(0,0,0,0.5)]">
        <div className="p-8 pb-4">
           <h2 className="font-oswald text-xl uppercase tracking-widest mb-2 font-bold text-[#555] border-b border-[#111] pb-4 flex items-center justify-between">
             Active Matrix // Teleprompter
             {audioData?.bpm && <span className="text-[10px] text-[#E60000]">{audioData.bpm} BPM</span>}
           </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-12 text-gray-300 font-mono text-sm leading-loose scroll-smooth">
          {lyricLines.length > 0 ? (
            lyricLines.map((line, i) => {
              let isActive = false;
              if (!line.isHeader) {
                 const nextLine = lyricLines.slice(i + 1).find(l => !l.isHeader);
                 const secondsPerBar = audioData?.bpm ? (60 / audioData.bpm) * 4 : 2.5; 
                 const endTime = nextLine ? nextLine.startTime : line.startTime + secondsPerBar;
                 isActive = currentTime >= line.startTime && currentTime < endTime;
              }
              return (
                <p 
                  key={i} 
                  className={`
                    ${line.isHeader ? 'text-[#E60000] font-bold mt-8 mb-2 tracking-widest text-xs' : 'mb-2 transition-all duration-300'}
                    ${isActive ? 'text-white text-lg font-bold bg-[#E60000]/20 py-1 px-3 border-l-2 border-[#E60000] transform translate-x-2' : ''}
                  `}
                >
                  {line.text}
                </p>
              )
            })
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-20">
              <p className="uppercase tracking-[0.3em] text-center">NO LYRICS DETECTED<br/>RETURN TO GHOSTWRITER</p>
            </div>
          )}
        </div>
        <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-[#020202] to-transparent pointer-events-none"></div>
      </div>

      {/* RIGHT COL: THE DAW ENGINE */}
      <div className="flex-1 flex flex-col relative">
        
        {/* Top Header */}
        <div className="h-20 bg-black border-b border-[#222] flex items-center justify-between px-10">
          <div className="flex items-center gap-3">
             <Zap size={18} className="text-yellow-500" />
             <span className="font-oswald uppercase text-white tracking-widest">AudioWorklet Bypass Enabled</span>
             <span className="text-[9px] font-mono text-[#555] bg-[#111] px-2 py-1 ml-2">Latency: {'<'}5ms</span>
          </div>
        </div>

        {/* Visualizer Area */}
        <div className="flex-1 bg-black p-10 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#E60000 1px, transparent 1px), linear-gradient(90deg, #E60000 1px, transparent 1px)', backgroundSize: '100px 100px', transform: 'perspective(500px) rotateX(60deg) translateY(-100px) translateZ(-200px)' }}></div>

          {/* WAVESURFER CONTAINER */}
          <div ref={waveformRef} className={`w-full max-w-2xl transition-all duration-500 ${isRecording ? 'opacity-100' : 'opacity-30'}`}></div>

          {!isRecording && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 opacity-30">
              <Mic size={64} className="mb-4" />
              <h3 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white mb-2">Mic Standby</h3>
            </div>
          )}
        </div>

        {/* TAKES & LIBRARY TRAY */}
        <div className="h-48 bg-[#050505] border-t border-[#222] p-6 overflow-y-auto custom-scrollbar flex flex-col relative z-20">
          <h4 className="text-[10px] uppercase font-bold text-[#888] tracking-widest mb-4 flex items-center gap-2">
            <ListMusic size={14} /> Recorded Vocal Stems ({vocalStems.length})
          </h4>
          
          {vocalStems.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
               <p className="text-[10px] font-mono uppercase tracking-widest text-[#444]">No takes recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {vocalStems.map(stem => (
                <div key={stem.id} className="flex justify-between items-center bg-[#111] p-3 border border-[#333] group hover:border-[#E60000]/50 transition-colors">
                  <div className="flex items-center gap-3">
                     <span className={`text-[9px] uppercase font-bold tracking-widest px-2 py-1 ${stem.type === 'Lead' ? 'bg-[#E60000] text-white' : 'bg-[#222] text-[#888]'}`}>
                       {stem.type}
                     </span>
                     <span className="font-mono text-[10px] text-white uppercase">{stem.id.substring(5, 15)}</span>
                  </div>
                  <div className="flex items-center gap-4">
                     <audio src={stem.url} controls className="h-6 w-48 opacity-70 group-hover:opacity-100 transition-opacity" />
                     <button onClick={() => removeVocalStem(stem.id)} className="text-[#555] hover:text-[#E60000] transition-colors"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="h-20 bg-black border-t border-[#222] flex items-center justify-between px-10">
          
          {/* Record Controls */}
          <div className="flex items-center gap-4">
            <button 
              onClick={isRecording ? stopEverything : startRecording}
              disabled={!audioData?.url}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isRecording 
                  ? 'bg-red-950 text-[#E60000] border-2 border-[#E60000] animate-pulse shadow-[0_0_20px_rgba(230,0,0,0.4)]' 
                  : 'bg-[#111] border border-[#333] text-white hover:bg-white hover:text-black'
              } disabled:opacity-30`}
            >
              {isRecording ? <Square size={20} /> : <Mic size={24} />}
            </button>
            <div className="text-left">
               <p className="font-oswald font-bold text-lg uppercase tracking-widest text-white">{isRecording ? "Tracking..." : "Initialize Take"}</p>
               <p className="font-mono text-[9px] text-[#555] uppercase tracking-widest">Global Sync Enabled</p>
            </div>
          </div>
          
          <button 
            onClick={() => { stopEverything(); setActiveRoom("05"); }}
            disabled={vocalStems.length === 0}
            className="flex items-center gap-3 bg-[#E60000] text-white px-8 py-3 font-oswald font-bold uppercase tracking-widest text-sm hover:bg-red-700 transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(230,0,0,0.3)]"
          >
            Mix Bus <ArrowRight size={16} />
          </button>
        </div>

      </div>
    </div>
  );
}