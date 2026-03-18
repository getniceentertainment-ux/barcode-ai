"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { 
  UploadCloud, Cpu, PenTool, Mic2, Layers, Sliders, 
  Send, Wallet, Radio, Users, ShieldAlert, LogOut,
  Play, Pause, SkipBack, SkipForward, Volume2, Lock, User
} from "lucide-react";
import { useMatrixStore } from "../store/useMatrixStore";
import { supabase } from "../lib/supabase";

// The Gateway
import EntryGateway from "../components/matrix/EntryGateway";

// The 10 Matrix Rooms
import Room01_Lab from "../components/matrix/Room01_Lab";
import Room02_BrainTrain from "../components/matrix/Room02_BrainTrain";
import Room03_Ghostwriter from "../components/matrix/Room03_Ghostwriter";
import Room04_Booth from "../components/matrix/Room04_Booth";
import Room05_VocalSuite from "../components/matrix/Room05_VocalSuite";
import Room06_Mastering from "../components/matrix/Room06_Mastering";
import Room07_Distribution from "../components/matrix/Room07_Distribution";
import Room08_Bank from "../components/matrix/Room08_Bank";
import Room09_Radio from "../components/matrix/Room09_Radio";
import Room10_Social from "../components/matrix/Room10_Social";

export default function MatrixController() {
  const { 
    hasAccess, activeRoom, setActiveRoom, userSession, clearMatrix, 
    audioData, isProjectFinalized, playbackMode, setPlaybackMode, 
    radioTrack, setRadioTrack 
  } = useMatrixStore();

  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);

  const togglePlay = () => {
    if (!audioRef.current) return;
    const url = playbackMode === 'radio' ? radioTrack?.url : audioData?.url;
    if (!url) return;

    if (isPlaying) {
      audioRef.current.pause();
      window.dispatchEvent(new Event('matrix-global-sys-pause'));
    } else {
      audioRef.current.play();
      window.dispatchEvent(new Event('matrix-global-sys-play'));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      window.dispatchEvent(new CustomEvent('matrix-global-timeupdate', { detail: time }));
    }
  };

  const toggleRadioMode = () => {
    setIsPlaying(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setPlaybackMode(playbackMode === 'radio' ? 'session' : 'radio');
  };

  const handleDisconnect = async () => {
    await supabase.auth.signOut();
    clearMatrix();
    window.location.reload();
  };

  if (!hasAccess) return <EntryGateway />;

  const rooms = [
    { id: "01", name: "The Lab", icon: <UploadCloud size={16} /> },
    { id: "02", name: "Brain Train", icon: <Cpu size={16} /> },
    { id: "03", name: "Ghostwriter", icon: <PenTool size={16} /> },
    { id: "04", name: "The Booth", icon: <Mic2 size={16} /> },
    { id: "05", name: "Engineering", icon: <Layers size={16} /> },
    { id: "06", name: "Mastering", icon: <Sliders size={16} /> },
    { id: "07", name: "Distribution", icon: <Send size={16} /> },
    { id: "08", name: "The Bank & Vault", icon: <Wallet size={16} /> },
    { id: "09", name: "The Radio", icon: <Radio size={16} /> },
    { id: "10", name: "Social Syndicate", icon: <Users size={16} /> },
  ];

  const renderActiveRoom = () => {
    const lockedRooms = ["01", "02", "03", "04", "05", "06"];
    if (isProjectFinalized && lockedRooms.includes(activeRoom)) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center animate-in zoom-in duration-500">
          <div className="bg-[#110000] border border-[#E60000]/30 p-12 rounded-lg flex flex-col items-center max-w-xl">
            <Lock size={64} className="text-[#E60000] mb-6 shadow-[0_0_30px_rgba(230,0,0,0.5)] rounded-full" />
            <h2 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white mb-4">ARTIFACT LOCKED</h2>
            <p className="font-mono text-xs text-[#888] uppercase tracking-widest mb-8 leading-relaxed">
              This track has been submitted to the A&R ledger and permanently locked. Prior structural rooms can no longer be edited.
            </p>
            <div className="flex gap-4 w-full">
              <button onClick={() => setActiveRoom("08")} className="flex-1 bg-black border border-[#333] text-white py-4 font-bold uppercase tracking-widest text-[10px] hover:bg-[#111] hover:border-white transition-colors">
                View in Vault
              </button>
              <button onClick={() => { clearMatrix(); setActiveRoom("01"); }} className="flex-1 bg-[#E60000] text-white py-4 font-bold uppercase tracking-widest text-[10px] hover:bg-red-700 transition-colors shadow-[0_0_15px_rgba(230,0,0,0.3)]">
                Initialize New Track
              </button>
            </div>
          </div>
        </div>
      );
    }

    switch (activeRoom) {
      case "01": return <Room01_Lab />; case "02": return <Room02_BrainTrain />;
      case "03": return <Room03_Ghostwriter />; case "04": return <Room04_Booth />;
      case "05": return <Room05_VocalSuite />; case "06": return <Room06_Mastering />;
      case "07": return <Room07_Distribution />; case "08": return <Room08_Bank />;
      case "09": return <Room09_Radio />; case "10": return <Room10_Social />;
      default: return <div />;
    }
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden pb-24">
      <aside className="w-72 bg-black border-r border-[#111] flex flex-col shrink-0 hidden md:flex">
        <div className="p-8 border-b border-[#111]">
          <h1 className="font-oswald text-2xl uppercase tracking-widest font-bold text-[#E60000]">Bar-Code.ai</h1>
        </div>
        <nav className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar">
          <div className="space-y-1 mb-8">
            {rooms.map((room) => (
              <button
                key={room.id} onClick={() => setActiveRoom(room.id)}
                className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-all rounded-lg group ${activeRoom === room.id ? "bg-[#E60000] text-white" : "text-[#444] hover:text-white"}`}
              >
                {room.icon} <span className="font-oswald text-sm uppercase tracking-widest font-bold">R{room.id} - {room.name}</span>
              </button>
            ))}
          </div>
        </nav>
      </aside>

      <main className="flex-1 relative flex flex-col bg-black overflow-hidden">
        <div className="h-14 border-b border-[#111] bg-black/80 backdrop-blur-md flex items-center justify-between px-10 z-10 shrink-0">
           <span className="font-mono text-[9px] text-[#444] uppercase tracking-[0.4em]">Facility // Room {activeRoom}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar">{renderActiveRoom()}</div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 h-24 bg-[#0a0a0a] border-t border-[#222] z-50 flex items-center px-4 md:px-10 justify-between">
        <audio 
          ref={audioRef} 
          src={playbackMode === 'radio' && radioTrack ? radioTrack.url : audioData?.url || ""} 
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onEnded={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          className="hidden" 
        />

        <div className="w-1/3 flex items-center gap-4">
          <button 
            onClick={toggleRadioMode}
            className={`w-12 h-12 flex items-center justify-center border transition-all ${playbackMode === 'radio' ? 'bg-[#E60000] border-[#E60000] shadow-[0_0_15px_rgba(230,0,0,0.4)]' : 'bg-black border-[#333]'}`}
          >
            <Radio size={18} className={playbackMode === 'radio' ? "text-white animate-pulse" : "text-[#555]"} />
          </button>
          <div className="overflow-hidden hidden sm:block">
            <p className="font-oswald text-sm uppercase font-bold text-white truncate">{playbackMode === 'radio' && radioTrack ? radioTrack.title : (audioData?.fileName || "NO TRACK LOADED")}</p>
            <p className="font-mono text-[9px] text-[#E60000] uppercase">{playbackMode === 'radio' ? `FM BROADCAST` : `STUDIO SESSION`}</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center">
          <div className="flex items-center gap-6 mb-2">
            <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-[#E60000] hover:text-white transition-all">
              {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-1" />}
            </button>
          </div>
          <div className="w-full max-w-md flex items-center gap-3">
            <span className="text-[9px] font-mono text-[#888]">{formatTime(currentTime)}</span>
            <div className="flex-1 h-1.5 bg-[#222] rounded-full overflow-hidden relative cursor-pointer" onClick={(e) => {
               if (!audioRef.current) return;
               const bounds = e.currentTarget.getBoundingClientRect();
               const percent = (e.clientX - bounds.left) / bounds.width;
               const newTime = percent * duration;
               audioRef.current.currentTime = newTime;
               window.dispatchEvent(new CustomEvent('matrix-global-sys-seek', { detail: newTime }));
            }}>
              <div className="absolute top-0 left-0 h-full bg-[#E60000]" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}></div>
            </div>
            <span className="text-[9px] font-mono text-[#888]">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="w-1/3 flex justify-end items-center gap-3">
          <Volume2 size={14} className="text-[#888]" />
          <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => { setVolume(parseFloat(e.target.value)); if(audioRef.current) audioRef.current.volume = parseFloat(e.target.value); }} className="w-24 h-1.5 accent-[#E60000] bg-[#222] rounded-full appearance-none" />
        </div>
      </div>
    </div>
  );

  function formatTime(t: number) {
    if (isNaN(t)) return "00:00";
    const m = Math.floor(t / 60).toString().padStart(2, '0');
    const s = Math.floor(t % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}