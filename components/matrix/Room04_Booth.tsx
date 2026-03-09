"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Pause, ArrowRight, Activity, Save, Trash2, ListMusic } from "lucide-react";
import WaveSurfer from 'wavesurfer.js';
import { useMatrixStore } from "../../store/useMatrixStore";

export default function Room04_Booth() {
  const { generatedLyrics, audioData, vocalStems, addVocalStem, removeVocalStem, setActiveRoom } = useMatrixStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [lyricLines, setLyricLines] = useState<{text: string, startTime: number, isHeader: boolean}[]>([]);
  
  // Audio & Hardware Refs
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 1. Initialize WaveSurfer
  useEffect(() => {
    if (waveformRef.current && audioData?.url && !wavesurferRef.current) {
      wavesurferRef.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#333333',
        progressColor: '#E60000',
        cursorColor: '#ffffff',
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 80,
        normalize: true,
      });

      wavesurferRef.current.load(audioData.url);

      wavesurferRef.current.on('audioprocess', (time) => {
        setCurrentTime(time);
      });

      wavesurferRef.current.on('finish', () => {
        setIsPlaying(false);
        setIsRecording(false);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      });
    }

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [audioData]);

  // 2. Teleprompter Math
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

  // 3. Playback Controls
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
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsPlaying(false);
    setIsRecording(false);
    setCurrentTime(0);
  };

  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

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

      mediaRecorder.start();
      if (wavesurferRef.current) {
        wavesurferRef.current.seekTo(0);
        wavesurferRef.current.play();
      }
      
      setIsRecording(true);
      setIsPlaying(true);
      
    } catch (err) {
      console.error("Microphone Access Denied:", err);
      alert("Microphone access is required to use The Booth.");
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
            <button onClick={isRecording ? stopEverything : startRecording} disabled={!audioData?.url} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-950 text-[#E60000] border-2 border-[#E60000] animate-pulse shadow-[0_0_20px_rgba(230,0,0,0.4)]' : 'bg-[#111] border border-[#333] text-white hover:text-[#E60000] hover:border-[#E60000]'} disabled:opacity-30`}>
              <Mic size={24} />
            </button>
          </div>
          <div className="font-mono text-3xl font-bold tracking-widest text-[#E60000]">
            {Math.floor(currentTime / 60).toString().padStart(2, '0')}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
            <span className="text-sm text-[#555]">.{(currentTime % 1).toFixed(2).substring(2)}</span>
          </div>
        </div>

        {/* WAVESURFER VISUALIZER AREA */}
        <div className="bg-[#050505] p-6 border-b border-[#222]">
           <p className="text-[10px] text-[#555] font-mono uppercase tracking-widest mb-4">Instrumental Waveform</p>
           <div ref={waveformRef} className="w-full bg-black border border-[#111] rounded-lg overflow-hidden"></div>
        </div>

        <div className="flex-1 bg-black flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#E60000 1px, transparent 1px), linear-gradient(90deg, #E60000 1px, transparent 1px)', backgroundSize: '100px 100px', transform: 'perspective(500px) rotateX(60deg) translateY(-100px) translateZ(-200px)' }}></div>
          {isRecording && (
            <div className="text-center z-10">
              <Activity size={80} className="text-[#E60000] animate-bounce mx-auto mb-4" />
              <h3 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white mb-2">Recording</h3>
            </div>
          )}
        </div>

        {/* TAKES TRAY */}
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