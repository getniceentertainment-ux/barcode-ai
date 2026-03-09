"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Pause, ArrowRight, Activity, Save, Trash2, ListMusic } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";

export default function Room04_Booth() {
  const { generatedLyrics, audioData, vocalStems, addVocalStem, removeVocalStem, setActiveRoom } = useMatrixStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  const [lyricLines, setLyricLines] = useState<{text: string, startTime: number, isHeader: boolean}[]>([]);
  
  // PRO-DAW MUTE & SOLO STATE
  const [mutedStems, setMutedStems] = useState<Set<string>>(new Set());
  const [soloStems, setSoloStems] = useState<Set<string>>(new Set());

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Teleprompter Logic
  useEffect(() => {
    if (!generatedLyrics) return;
    const secondsPerBar = audioData?.bpm ? (60 / audioData.bpm) * 4 : 2.5; 
    const parsed = [];
    const lines = generatedLyrics.split('\n');
    let barCounter = 0; 
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i].trim();
      if (text === "") continue;
      if (text.startsWith('[')) parsed.push({ text, startTime: 0, isHeader: true });
      else {
         parsed.push({ text, startTime: barCounter * secondsPerBar, isHeader: false });
         barCounter++; 
      }
    }
    setLyricLines(parsed);
  }, [generatedLyrics, audioData]);

  // --- PRO-DAW STEM SYNCHRONIZATION ---
  useEffect(() => {
    const handleSysPlay = () => {
      setIsPlaying(true);
      vocalStems.forEach(stem => document.getElementById(`stem-player-${stem.id}`)?.play());
    };
    
    const handleSysPause = () => {
      setIsPlaying(false);
      vocalStems.forEach(stem => (document.getElementById(`stem-player-${stem.id}`) as HTMLAudioElement)?.pause());
    };
    
    const handleSysSeek = (e: any) => {
      vocalStems.forEach(stem => {
        const el = document.getElementById(`stem-player-${stem.id}`) as HTMLAudioElement;
        if (el) el.currentTime = e.detail;
      });
    };

    const handleTimeUpdate = (e: any) => {
      const globalTime = e.detail;
      setCurrentTime(globalTime);
      // Aggressive Drift Correction (150ms tolerance)
      vocalStems.forEach(stem => {
        const el = document.getElementById(`stem-player-${stem.id}`) as HTMLAudioElement;
        if (el && Math.abs(el.currentTime - globalTime) > 0.15) el.currentTime = globalTime;
      });
    };

    window.addEventListener('matrix-global-sys-play', handleSysPlay);
    window.addEventListener('matrix-global-sys-pause', handleSysPause);
    window.addEventListener('matrix-global-sys-seek', handleSysSeek);
    window.addEventListener('matrix-global-timeupdate', handleTimeUpdate);

    return () => {
      window.removeEventListener('matrix-global-sys-play', handleSysPlay);
      window.removeEventListener('matrix-global-sys-pause', handleSysPause);
      window.removeEventListener('matrix-global-sys-seek', handleSysSeek);
      window.removeEventListener('matrix-global-timeupdate', handleTimeUpdate);
    };
  }, [vocalStems]);

  // --- MUTE & SOLO LOGIC APPLICATION ---
  useEffect(() => {
    vocalStems.forEach(stem => {
      const el = document.getElementById(`stem-player-${stem.id}`) as HTMLAudioElement;
      if (el) {
        const isMuted = mutedStems.has(stem.id) || (soloStems.size > 0 && !soloStems.has(stem.id));
        el.muted = isMuted;
      }
    });
  }, [mutedStems, soloStems, vocalStems]);

  const toggleMute = (id: string) => {
    setMutedStems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSolo = (id: string) => {
    setSoloStems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const togglePlayback = () => {
    if (isPlaying) window.dispatchEvent(new Event('matrix-global-pause'));
    else window.dispatchEvent(new Event('matrix-global-play'));
  };

  const stopEverything = () => {
    window.dispatchEvent(new Event('matrix-global-pause'));
    window.dispatchEvent(new CustomEvent('matrix-global-seek', { detail: 0 }));
    if (mediaRecorderRef.current && isRecording) mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false }});
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const stemUrl = URL.createObjectURL(audioBlob);
        
        addVocalStem({
          id: `TAKE_${Date.now()}`,
          type: vocalStems.length === 0 ? "Lead" : "Adlib", 
          url: stemUrl,
          blob: audioBlob,
          volume: 0 
        });
        stream.getTracks().forEach(track => track.stop());
      };

      // Restart global beat from 0 and play - Guarantees structural alignment!
      window.dispatchEvent(new CustomEvent('matrix-global-seek', { detail: 0 }));
      window.dispatchEvent(new Event('matrix-global-play'));
      
      mediaRecorder.start();
      setIsRecording(true);
      
    } catch (err) {
      console.error("Microphone Access Denied", err);
      alert("Microphone access is required to use The Booth.");
    }
  };

  return (
    <div className="flex h-full bg-[#050505] border border-[#222] rounded-lg overflow-hidden animate-in fade-in duration-500">
      
      {/* HIDDEN STEM PLAYERS */}
      {vocalStems.map(stem => (
        <audio key={stem.id} id={`stem-player-${stem.id}`} src={stem.url} className="hidden" />
      ))}

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
            <div className="h-full flex flex-col items-center justify-center opacity-20 text-center uppercase tracking-[0.3em]">NO LYRICS DETECTED</div>
          )}
        </div>
        <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-[#020202] to-transparent pointer-events-none"></div>
      </div>

      {/* RIGHT COL: HARDWARE & CONTROLS */}
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
            <button onClick={isRecording ? stopEverything : startRecording} disabled={!audioData?.url} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-950 text-[#E60000] border-2 border-[#E60000] animate-pulse shadow-[0_0_20px_rgba(230,0,0,0.4)]' : 'bg-[#111] border border-[#333] text-white hover:text-[#E60000] hover:border-[#E60000]'} disabled:opacity-30`}>
              <Mic size={24} />
            </button>
          </div>
          <div className="font-mono text-3xl font-bold tracking-widest text-[#E60000]">
            {Math.floor(currentTime / 60).toString().padStart(2, '0')}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
            <span className="text-sm text-[#555]">.{(currentTime % 1).toFixed(2).substring(2)}</span>
          </div>
        </div>

        <div className="flex-1 bg-black p-10 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#E60000 1px, transparent 1px), linear-gradient(90deg, #E60000 1px, transparent 1px)', backgroundSize: '100px 100px', transform: 'perspective(500px) rotateX(60deg) translateY(-100px) translateZ(-200px)' }}></div>
          {isRecording ? (
            <div className="text-center z-10">
              <Activity size={100} className="text-[#E60000] animate-bounce mx-auto mb-8" />
              <h3 className="font-oswald text-5xl uppercase tracking-widest font-bold text-white mb-2">Recording</h3>
              <p className="font-mono text-xs text-[#E60000] uppercase tracking-[0.4em] animate-pulse">Capturing Vocal Sequence...</p>
            </div>
          ) : (
            <div className="text-center z-10 opacity-30">
              <Mic size={100} className="mx-auto mb-8" />
              <h3 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white mb-2">Mic Standby</h3>
              <p className="font-mono text-[10px] text-white uppercase tracking-[0.3em]">Hit record to initiate capture sequence</p>
            </div>
          )}
        </div>

        {/* PRO-DAW TAKES TRAY */}
        <div className="h-56 bg-[#050505] border-t border-[#222] p-6 overflow-y-auto custom-scrollbar flex flex-col relative z-20">
          <h4 className="text-[10px] uppercase font-bold text-[#888] tracking-widest mb-4 flex items-center gap-2">
            <ListMusic size={14} /> Matrix Takes ({vocalStems.length})
          </h4>
          
          {vocalStems.length === 0 ? (
            <div className="flex-1 flex items-center justify-center opacity-50">
               <p className="text-[10px] font-mono uppercase tracking-widest text-[#444]">No takes recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {vocalStems.map(stem => {
                const isMuted = mutedStems.has(stem.id);
                const isSolo = soloStems.has(stem.id);
                return (
                  <div key={stem.id} className="flex justify-between items-center bg-[#0a0a0a] p-3 border border-[#222] hover:border-[#E60000]/50 transition-colors group">
                    <div className="flex items-center gap-4">
                       <span className={`text-[9px] uppercase font-bold tracking-widest px-2 py-1 ${stem.type === 'Lead' ? 'bg-[#E60000] text-white' : 'bg-[#222] text-[#888]'}`}>
                         {stem.type}
                       </span>
                       <span className="font-mono text-[10px] text-white uppercase tracking-widest">{stem.id.substring(5, 18)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <button onClick={() => toggleMute(stem.id)} className={`w-8 h-8 flex items-center justify-center rounded-sm text-[10px] font-bold transition-all ${isMuted ? 'bg-red-950 text-red-500 border border-red-500' : 'bg-[#111] text-[#555] hover:text-white border border-[#333]'}`}>M</button>
                       <button onClick={() => toggleSolo(stem.id)} className={`w-8 h-8 flex items-center justify-center rounded-sm text-[10px] font-bold transition-all ${isSolo ? 'bg-yellow-950 text-yellow-500 border border-yellow-500' : 'bg-[#111] text-[#555] hover:text-white border border-[#333]'}`}>S</button>
                       <div className="w-px h-6 bg-[#333] mx-2"></div>
                       <button onClick={() => removeVocalStem(stem.id)} className="text-[#555] hover:text-[#E60000] transition-colors"><Trash2 size={16}/></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="h-16 bg-black border-t border-[#222] flex items-center justify-between px-10">
          <div className="flex items-center gap-2 text-[10px] font-mono text-green-500 uppercase tracking-widest opacity-80">
            {vocalStems.length > 0 && <><Save size={14} /> Matrix Synced</>}
          </div>
          <button onClick={() => { stopEverything(); setActiveRoom("05"); }} disabled={vocalStems.length === 0} className="flex items-center gap-3 bg-white text-black px-8 py-2 font-oswald font-bold uppercase tracking-widest text-xs hover:bg-[#E60000] hover:text-white transition-all disabled:opacity-20">
            Engineering Suite <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}