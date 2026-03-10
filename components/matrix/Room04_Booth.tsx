"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Pause, ArrowRight, Activity, Save, Trash2, ListMusic } from "lucide-react";
import WaveSurfer from 'wavesurfer.js';
import { useMatrixStore } from "../../store/useMatrixStore";

// Helper to convert raw Float32 Worklet PCM to a standard WAV Blob
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
  const { 
    generatedLyrics, audioData, setAudioData, vocalStems, addVocalStem, removeVocalStem, setActiveRoom, 
    mdxJobId, mdxStatus, setMdxStatus, addToast 
  } = useMatrixStore();

  const [isPlaying, setIsPlaying] = useState(false);
  // ... existing states ...

  // --- BACKGROUND MDX POLLER ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (mdxJobId && mdxStatus === "processing") {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/demucs?jobId=${mdxJobId}`);
          const data = await res.json();
          
          if (data.status === "COMPLETED") {
            // 1. Swap the global beat to the clean instrumental
            if (audioData) {
              setAudioData({ ...audioData, url: data.output.stems.instrumental });
            }
            
            // 2. Inject the extracted original vocals as a muted stem layer!
            if (data.output.stems.vocals) {
              addVocalStem({
                id: `MDX_ACAPELLA_${Date.now()}`,
                type: "Lead",
                url: data.output.stems.vocals,
                volume: 0
              });
            }
            
            setMdxStatus("success");
            if(addToast) addToast("Background MDX Finished! Clean Instrumental Ready.", "success");
            clearInterval(interval);
          } else if (data.status === "FAILED") {
            setMdxStatus("failed");
            if(addToast) addToast("Background MDX Separation Failed.", "error");
            clearInterval(interval);
          }
        } catch (e) {
          console.error("MDX Polling Error:", e);
        }
      }, 5000); // Check every 5 seconds while they are in the booth
    }
    return () => clearInterval(interval);
  }, [mdxJobId, mdxStatus, audioData]);

  // 1. Initialize WaveSurfer
    }
    setLyricLines(parsed);
  }, [generatedLyrics, audioData]);

  const togglePlayback = () => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.playPause();
    setIsPlaying(wavesurferRef.current.isPlaying());
  };

  const stopEverything = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.pause();
      wavesurferRef.current.seekTo(0);
    }
    
    // Stop Zero-Latency Hardware Recording & Perform Memory Sweep
    if (isRecording && workletNodeRef.current && audioCtxRef.current) {
      workletNodeRef.current.disconnect();
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      
      // Merge PCM Chunks
      const totalLength = recordedChunksRef.current.reduce((acc, val) => acc + val.length, 0);
      const merged = new Float32Array(totalLength);
      let offset = 0;
      for (let chunk of recordedChunksRef.current) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      
      const wavBlob = encodeWAV(merged, audioCtxRef.current.sampleRate);
      addVocalStem({
        id: `TAKE_${Date.now()}`,
        type: vocalStems.length === 0 ? "Lead" : "Adlib", 
        url: URL.createObjectURL(wavBlob),
        blob: wavBlob,
        volume: 0 
      });

      // THE FIX: Explicitly murder the AudioContext so it doesn't corrupt Take 2
      audioCtxRef.current.close();
      audioCtxRef.current = null;
      workletNodeRef.current = null;
      mediaStreamRef.current = null;
    }

    setIsPlaying(false);
    setIsRecording(false);
    setCurrentTime(0);
  };

  const startHardwareRecording = async () => {
    try {
      // Guarantee previous contexts are dead before initiating a new one
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        await audioCtxRef.current.close();
      }

      recordedChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } 
      });
      mediaStreamRef.current = stream;

      // THE FIX: Explicitly lock the sample rate to 44.1kHz to prevent pitch shifting
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
      audioCtxRef.current = audioCtx;

      // Inline AudioWorklet (Bypasses Main Thread for Zero Latency)
      const workletCode = `
        class RecorderWorklet extends AudioWorkletProcessor {
          process(inputs, outputs, parameters) {
            if (inputs[0] && inputs[0].length > 0) {
              const channelData = inputs[0][0]; // Float32Array
              this.port.postMessage(channelData);
            }
            return true;
          }
        }
        registerProcessor('recorder-worklet', RecorderWorklet);
      `;
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      await audioCtx.audioWorklet.addModule(URL.createObjectURL(blob));

      const source = audioCtx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioCtx, 'recorder-worklet');
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (e) => {
        recordedChunksRef.current.push(new Float32Array(e.data));
      };

      source.connect(workletNode);
      workletNode.connect(audioCtx.destination); // Required to keep worklet alive

      if (wavesurferRef.current) {
        wavesurferRef.current.seekTo(0);
        wavesurferRef.current.play();
      }
      
      setIsRecording(true);
      setIsPlaying(true);
      
    } catch (err) {
      console.error("Hardware Mic Access Denied:", err);
      alert("Hardware microphone access is required for zero-latency tracking.");
    }
  };

  return (
    <div className="flex h-full bg-[#050505] border border-[#222] rounded-lg overflow-hidden animate-in fade-in duration-500">
      
      {/* LEFT COL: TELEPROMPTER */}
      <div className="w-1/2 lg:w-5/12 border-r border-[#222] bg-[#020202] flex flex-col relative shadow-[inset_-10px_0_30px_rgba(0,0,0,0.5)]">
        <div className="p-8 pb-4">
           <h2 className="font-oswald text-xl uppercase tracking-widest mb-2 font-bold text-[#555] border-b border-[#111] pb-4 flex items-center justify-between">
             Active Matrix // Teleprompter
             {audioData?.bpm && <span className="text-[10px] text-[#E60000]">{Math.round(audioData.bpm)} BPM</span>}
           </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-12 text-gray-300 font-mono text-sm leading-loose scroll-smooth">
          {lyricLines.length > 0 ? (
            lyricLines.map((line, i) => {
              let isActive = false;
              if (!line.isHeader && (isPlaying || isRecording)) {
                 const nextLine = lyricLines.slice(i + 1).find(l => !l.isHeader);
                 const secondsPerBar = audioData?.bpm ? (60 / audioData.bpm) * 4 : 2.5; 
                 const endTime = nextLine ? nextLine.startTime : line.startTime + secondsPerBar;
                 isActive = currentTime >= line.startTime && currentTime < endTime;
              }
              return (
                <p key={i} className={`
                    ${line.isHeader ? 'text-[#E60000] font-bold mt-8 mb-2 tracking-widest text-xs' : 'mb-2 transition-all duration-300'}
                    ${isActive ? 'text-white text-lg font-bold bg-[#E60000]/20 py-1 px-3 border-l-2 border-[#E60000] transform translate-x-2' : ''}
                  `}>{line.text}</p>
              )
            })
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-20"><p className="uppercase tracking-[0.3em] text-center">NO LYRICS DETECTED<br/>RETURN TO GHOSTWRITER</p></div>
          )}
        </div>
        <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-[#020202] to-transparent pointer-events-none"></div>
      </div>

      {/* RIGHT COL: HARDWARE DAW */}
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
        {/* WAVESURFER VISUALIZER AREA */}
        <div className="bg-[#050505] p-6 border-b border-[#222]">
           <div className="flex justify-between items-center mb-4">
             <p className="text-[10px] text-[#555] font-mono uppercase tracking-widest">Instrumental Waveform</p>
             {mdxStatus === "processing" && (
               <div className="text-[10px] text-yellow-500 font-mono uppercase tracking-widest animate-pulse border border-yellow-500/30 px-2 py-0.5 bg-yellow-500/10">
                 Neural Separation Running in Background...
               </div>
             )}
             {mdxStatus === "success" && (
               <div className="text-[10px] text-green-500 font-mono uppercase tracking-widest border border-green-500/30 px-2 py-0.5 bg-green-500/10">
                 Clean Instrumental Loaded
               </div>
             )}
           </div>
           <div ref={waveformRef} className="w-full bg-black border border-[#111] rounded-lg overflow-hidden"></div>
        </div>

        <div className="flex-1 bg-black flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#E60000 1px, transparent 1px), linear-gradient(90deg, #E60000 1px, transparent 1px)', backgroundSize: '100px 100px', transform: 'perspective(500px) rotateX(60deg) translateY(-100px) translateZ(-200px)' }}></div>
          {isRecording && (
            <div className="text-center z-10">
              <Activity size={80} className="text-[#E60000] animate-bounce mx-auto mb-4" />
              <h3 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white mb-2">Recording (Zero Latency)</h3>
            </div>
          )}
        </div>

        <div className="h-48 bg-[#050505] border-t border-[#222] p-6 overflow-y-auto custom-scrollbar flex flex-col relative z-20">
          <h4 className="text-[10px] uppercase font-bold text-[#888] tracking-widest mb-4 flex items-center gap-2">
            <ListMusic size={14} /> Recorded Vocal Stems ({vocalStems.length})
          </h4>
          <div className="space-y-2">
            {vocalStems.map(stem => (
              <div key={stem.id} className="flex justify-between items-center bg-[#111] p-3 border border-[#333] group hover:border-[#E60000]/50 transition-colors">
                <div className="flex items-center gap-3">
                   <span className={`text-[9px] uppercase font-bold tracking-widest px-2 py-1 ${stem.type === 'Lead' ? 'bg-[#E60000] text-white' : 'bg-[#222] text-[#888]'}`}>{stem.type}</span>
                   <span className="font-mono text-[10px] text-white uppercase">{stem.id.substring(5, 15)}</span>
                </div>
                <div className="flex items-center gap-4">
                   <audio src={stem.url} controls className="h-6 w-48 opacity-70 group-hover:opacity-100 transition-opacity" />
                   <button onClick={() => removeVocalStem(stem.id)} className="text-[#555] hover:text-[#E60000] transition-colors"><Trash2 size={16}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-16 bg-black border-t border-[#222] flex items-center justify-between px-10 shrink-0">
          <div className="flex items-center gap-2 text-[10px] font-mono text-green-500 uppercase tracking-widest opacity-80">
            {vocalStems.length > 0 && <><Save size={14} /> Matrix Synced</>}
          </div>
          <button onClick={() => { stopEverything(); setActiveRoom("05"); }} disabled={vocalStems.length === 0} className="flex items-center gap-3 bg-white text-black px-8 py-2 font-oswald font-bold uppercase tracking-widest text-xs hover:bg-[#E60000] hover:text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed">
            Engineering Suite <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}