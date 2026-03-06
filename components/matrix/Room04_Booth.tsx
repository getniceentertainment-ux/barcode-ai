"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Pause, RotateCcw, ArrowRight, Activity, Save } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";

export default function Room04_Booth() {
  const { generatedLyrics, audioData, addVocalStem, setActiveRoom } = useMatrixStore();

  // Hardware & Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [takeCount, setTakeCount] = useState(0);
  
  // Refs for audio elements and recording
  const beatRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Sync beat timer to UI
  const handleTimeUpdate = () => {
    if (beatRef.current) {
      setCurrentTime(beatRef.current.currentTime);
    }
  };

  const togglePlayback = () => {
    if (!beatRef.current) return;
    if (isPlaying) {
      beatRef.current.pause();
    } else {
      beatRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const stopEverything = () => {
    if (beatRef.current) {
      beatRef.current.pause();
      beatRef.current.currentTime = 0;
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const stemUrl = URL.createObjectURL(audioBlob);
        
        // Save the recorded stem to the Global Matrix Store
        addVocalStem({
          id: `TAKE_${Date.now()}`,
          type: takeCount === 0 ? "Lead" : "Adlib", // First take is Lead, subsequent are Adlibs/Doubles
          url: stemUrl,
          blob: audioBlob,
          volume: 0 // Default at 0dB
        });
        
        setTakeCount(prev => prev + 1);
        
        // Stop all tracks to free up the microphone
        stream.getTracks().forEach(track => track.stop());
      };

      // Start recording and playback simultaneously
      mediaRecorder.start();
      if (beatRef.current) {
        beatRef.current.currentTime = 0;
        beatRef.current.play();
      }
      
      setIsRecording(true);
      setIsPlaying(true);
      
    } catch (err) {
      console.error("Microphone Access Denied or Failed:", err);
      alert("Microphone access is required to use The Booth.");
    }
  };

  const handleProceed = () => {
    stopEverything();
    setActiveRoom("05");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="flex h-full bg-[#050505] border border-[#222] rounded-lg overflow-hidden animate-in fade-in duration-500">
      
      {/* LEFT COL: TELEPROMPTER */}
      <div className="w-1/2 lg:w-5/12 border-r border-[#222] bg-[#020202] p-8 flex flex-col relative shadow-[inset_-10px_0_30px_rgba(0,0,0,0.5)]">
        <h2 className="font-oswald text-xl uppercase tracking-widest mb-6 font-bold text-[#555] border-b border-[#111] pb-4">
          Active Matrix // Teleprompter
        </h2>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 text-gray-300 font-mono text-sm leading-loose">
          {generatedLyrics ? (
            generatedLyrics.split('\n').map((line, i) => (
              <p key={i} className={`${line.startsWith('[') ? 'text-[#E60000] font-bold mt-8 mb-2 tracking-widest text-xs' : 'mb-2'}`}>
                {line}
              </p>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-20">
              <p className="uppercase tracking-[0.3em] text-center">NO LYRICS DETECTED<br/>RETURN TO GHOSTWRITER</p>
            </div>
          )}
        </div>
        
        {/* Overlay gradient for fade-out effect at bottom */}
        <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-[#020202] to-transparent pointer-events-none"></div>
      </div>

      {/* RIGHT COL: HARDWARE & CONTROLS */}
      <div className="flex-1 flex flex-col relative">
        
        {/* Hidden Audio Element for Beat Playback */}
        <audio 
          ref={beatRef} 
          src={audioData?.url} 
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => { setIsPlaying(false); setIsRecording(false); if (mediaRecorderRef.current) mediaRecorderRef.current.stop(); }}
          className="hidden" 
        />

        {/* Top Control Bar */}
        <div className="h-24 bg-black border-b border-[#222] flex items-center justify-between px-10">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <button 
                onClick={togglePlayback}
                disabled={isRecording || !audioData?.url}
                className="w-14 h-14 rounded-full border border-[#333] flex items-center justify-center bg-[#111] text-white hover:bg-white hover:text-black transition-all disabled:opacity-30"
              >
                {isPlaying && !isRecording ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
              </button>
              
              <button 
                onClick={stopEverything}
                disabled={(!isPlaying && !isRecording)}
                className="w-14 h-14 rounded-full border border-[#333] flex items-center justify-center bg-[#111] text-white hover:bg-[#E60000] hover:border-[#E60000] transition-all disabled:opacity-30"
              >
                <Square size={20} />
              </button>
            </div>

            <div className="w-px h-10 bg-[#222]"></div>

            <button 
              onClick={isRecording ? stopEverything : startRecording}
              disabled={!audioData?.url}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isRecording 
                  ? 'bg-red-950 text-[#E60000] border-2 border-[#E60000] animate-pulse shadow-[0_0_20px_rgba(230,0,0,0.4)]' 
                  : 'bg-[#111] border border-[#333] text-white hover:text-[#E60000] hover:border-[#E60000]'
              } disabled:opacity-30`}
            >
              <Mic size={24} />
            </button>
          </div>

          {/* Timer Display */}
          <div className="font-mono text-3xl font-bold tracking-widest text-[#E60000]">
            {Math.floor(currentTime / 60).toString().padStart(2, '0')}:
            {Math.floor(currentTime % 60).toString().padStart(2, '0')}
            <span className="text-sm text-[#555]">.{(currentTime % 1).toFixed(2).substring(2)}</span>
          </div>
        </div>

        {/* Visualizer & Status Area */}
        <div className="flex-1 bg-black p-10 flex flex-col items-center justify-center relative overflow-hidden">
          {/* Background Grid Pattern */}
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

        {/* Bottom Status Bar */}
        <div className="h-20 bg-[#050505] border-t border-[#222] flex items-center justify-between px-10">
          <div className="flex items-center gap-6">
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#555]">
              Takes Recorded: <span className="text-white font-bold">{takeCount}</span>
            </div>
            {takeCount > 0 && (
              <div className="flex items-center gap-2 text-[10px] font-mono text-green-500 uppercase tracking-widest">
                <Save size={14} /> Saved to Matrix
              </div>
            )}
          </div>
          
          <button 
            onClick={handleProceed}
            disabled={takeCount === 0}
            className="flex items-center gap-3 bg-white text-black px-8 py-3 font-oswald font-bold uppercase tracking-widest text-xs hover:bg-[#E60000] hover:text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed"
          >
            Engineering Suite <ArrowRight size={16} />
          </button>
        </div>

      </div>
    </div>
  );
}