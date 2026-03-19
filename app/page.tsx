"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { 
  UploadCloud, Cpu, PenTool, Mic2, Layers, Sliders, 
  Send, Wallet, Radio, Users, ShieldAlert, LogOut,
  Play, Pause, SkipBack, SkipForward, Volume2, Lock, User, Zap, Loader2, Terminal
} from "lucide-react";
import { useMatrixStore } from "../store/useMatrixStore";
import { supabase } from "../lib/supabase";

// The Gateway
import EntryGateway from "../components/matrix/EntryGateway";

// The Matrix Rooms
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

// --- 🛡️ PORTAL GATED INSIDE THE MATRIX 🛡️ ---
import B2BDeveloperPortal from "./dev-portal/page"; 

export default function MatrixController() {
  const { 
    hasAccess, activeRoom, setActiveRoom, userSession, clearMatrix, 
    audioData, isProjectFinalized, playbackMode, setPlaybackMode, 
    radioTrack, setRadioTrack, addToast,
    vocalStems, generatedLyrics, blueprint, isUpgrading, setIsUpgrading
  } = useMatrixStore();

  const [isBoosting, setIsBoosting] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);

  // --- 🚨 THE SANITIZED SYNC GUARDIAN (FINAL FIX) 🚨 ---
  useEffect(() => {
    if (!hasAccess) return;

    const autoSaveInterval = setInterval(async () => {
      const state = useMatrixStore.getState();
      const currentUserId = state.userSession?.id;

      if (!currentUserId || currentUserId === 'undefined') return;

      try {
        // We only send 'matrix_state' - nothing else. 
        // This prevents "Column Not Found" errors.
        const { error } = await supabase
          .from('profiles')
          .update({
            matrix_state: {
              audioData: state.audioData || null,
              vocalStems: (state.vocalStems || []).map(s => ({ 
                id: s.id, type: s.type, offsetBars: s.offsetBars || 0, volume: s.volume ?? 1 
              })),
              generatedLyrics: state.generatedLyrics || "",
              blueprint: state.blueprint || {}
            }
          })
          .eq('id', currentUserId);
        
        if (error) {
          console.error("❌ Profile Sync Error:", error.message);
        } else {
          console.log("📡 Ledger Synced.");
        }
      } catch (err) {
        console.error("❌ Sync Hardware Failure:", err);
      }
    }, 30000); 

    return () => clearInterval(autoSaveInterval);
  }, [hasAccess]);

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

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - bounds.left) / bounds.width;
    const newTime = percent * duration;
    audioRef.current.currentTime = newTime;
    window.dispatchEvent(new CustomEvent('matrix-global-sys-seek', { detail: newTime }));
  };

  const toggleRadioMode = () => {
    setIsPlaying(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    
    if (playbackMode === 'radio') {
      setPlaybackMode('session');
    } else {
      if (!radioTrack) {
        setRadioTrack({ 
          url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", 
          title: "GETNICE FM LIVE", 
          artist: "SYNDICATE", 
          score: 99 
        });
      }
      setPlaybackMode('radio');
    }
  };

  const handleBoostPack = async () => {
    if (!userSession) return;
    setIsBoosting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await fetch('/api/stripe/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userSession.id, email: user?.email })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      if(addToast) addToast("Failed to route to Stripe.", "error");
      setIsBoosting(false);
    }
  };

  const handleDisconnect = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('barcode-matrix-storage'); 
    clearMatrix();
    window.location.reload();
  };

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
    { id: "11", name: "B2B Terminal", icon: <Terminal size={16} /> }, 
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
              This track has been submitted to the A&R ledger and permanently locked.
            </p>
            <div className="flex gap-4 w-full">
              <button onClick={() => setActiveRoom("08")} className="flex-1 bg-black border border-[#333] text-white py-4 font-bold uppercase tracking-widest text-[10px] hover:bg-[#111] hover:border-white transition-colors">
                View in Vault
              </button>
              <button onClick={() => { clearMatrix(); setActiveRoom("01"); }} className="flex-1 bg-[#E60000] text-white py-4 font-bold uppercase tracking-widest text-[10px] hover:bg-red-700 transition-colors">
                Initialize New Track
              </button>
            </div>
          </div>
        </div>
      );
    }

    switch (activeRoom) {
      case "01": return <Room01_Lab />;
      case "02": return <Room02_BrainTrain />;
      case "03": return <Room03_Ghostwriter />;
      case "04": return <Room04_Booth />;
      case "05": return <Room05_VocalSuite />;
      case "06": return <Room06_Mastering />;
      case "07": return <Room07_Distribution />;
      case "08": return <Room08_Bank />;
      case "09": return <Room09_Radio />;
      case "10": return <Room10_Social />;
      case "11": return <B2BDeveloperPortal />; 
      default: return <div />;
    }
  };

  function formatTime(t: number) {
    if (isNaN(t)) return "00:00";
    const m = Math.floor(t / 60).toString().padStart(2, '0');
    const s = Math.floor(t % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // --- 🛡️ THE GATEWAY INTERCEPTOR ---
  if (!hasAccess || isUpgrading) {
    return <EntryGateway />;
  }

  // --- 💻 MAIN MATRIX UI ---
  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden pb-24 font-oswald">
      
      {/* SIDEBAR */}
      <aside className="w-72 bg-black border-r border-[#111] flex flex-col shrink-0 hidden md:flex z-20 shadow-2xl">
        <div className="p-8 border-b border-[#111]">
          <h1 className="font-oswald text-2xl uppercase tracking-[0.2em] font-bold text-[#E60000]">Bar-Code.ai</h1>
          
          {userSession && (
            <div className="mt-4 p-3 bg-[#050505] border border-[#222]">
              <p className="font-mono text-[9px] text-[#555] uppercase mb-1">Active Operator:</p>
              <p className="font-mono text-[10px] text-white truncate font-bold tracking-widest">
                 NODE_{userSession?.id?.substring(0, 8).toUpperCase() || "UNKNOWN"}
               </p>
               
               <Link href={`/${encodeURIComponent(userSession?.stageName || "Artist")}`} className="mt-3 flex items-center justify-center gap-2 w-full bg-[#111] border border-[#333] hover:border-[#E60000] hover:text-[#E60000] text-[#888] py-1.5 text-[9px] font-mono uppercase tracking-widest transition-colors">
                <User size={10} /> View Public Profile
              </Link>
              
              <div className="flex justify-between items-end mt-3 pt-2 border-t border-[#111]">
                <p className="font-mono text-[9px] text-green-500 uppercase font-bold tracking-widest">{userSession?.tier || "Unassigned"}</p>
                <button onClick={handleDisconnect} className="text-[#555] hover:text-[#E60000] transition-colors flex items-center gap-1 text-[9px] font-mono uppercase">
                  <LogOut size={10} /> Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar">
          <div className="space-y-1 mb-8">
            {rooms.map((room) => {
              // 🔒 TIER ENFORCEMENT: Identify Mogul-only rooms
              const isMogulRoom = ["06", "07", "09", "10", "11"].includes(room.id);
              // Notice we leave "08" out of the lock, so everyone can visit the Bank to buy credits!
              const isLocked = isMogulRoom && userSession?.tier !== "The Mogul";

              return (
                <button
                  key={room.id} 
                  onClick={() => {
                    if (isLocked) {
                      setIsUpgrading(true); // Pop the upgrade modal
                    } else {
                      setActiveRoom(room.id); // Allow entry
                    }
                  }}
                  className={`w-full flex items-center justify-between px-5 py-4 text-left transition-all rounded-lg group ${activeRoom === room.id ? "bg-[#E60000] text-white shadow-[0_4px_15px_rgba(230,0,0,0.2)]" : "text-[#444] hover:bg-[#0a0a0a] hover:text-white"}`}
                >
                  <div className="flex items-center gap-3">
                    <span>{room.icon}</span>
                    <span className="font-oswald text-sm uppercase tracking-widest font-bold">R{room.id} - {room.name}</span>
                  </div>
                  {/* Visual indicator that the room is locked */}
                  {isLocked && <Lock size={14} className="text-[#E60000] opacity-50 group-hover:opacity-100" />}
                </button>
              );
            })}
          </div>
        </nav>
      </aside>

      <main className="flex-1 relative flex flex-col bg-black overflow-hidden">
        <div className="h-14 border-b border-[#111] bg-black/80 backdrop-blur-md flex items-center justify-between px-6 md:px-10 z-10 shrink-0">
           <span className="font-mono text-[9px] text-[#444] uppercase tracking-[0.4em] hidden sm:block">
             Facility // Room {activeRoom} // {rooms.find(r => r.id === activeRoom)?.name.toUpperCase()}
           </span>
           <div className="flex items-center gap-4 sm:gap-6 ml-auto">
             {userSession && (
               <div className="flex items-center gap-2 bg-[#110000] border border-[#330000] pl-3 pr-1 py-1 rounded-full shadow-[inset_0_0_10px_rgba(230,0,0,0.1)]">
                 <Zap size={12} className="text-yellow-500" />
                 <span className="font-mono text-[10px] text-white font-bold">{userSession.creditsRemaining} CRD</span>
               </div>
             )}
           </div>
        </div>
        
        <div className="flex-1 overflow-hidden relative z-10 p-4 md:p-6 lg:p-10 overflow-y-auto custom-scrollbar">
          {renderActiveRoom()}
        </div>
      </main>

      {/* PERSISTENT AUDIO PLAYER */}
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
          <button onClick={toggleRadioMode} className={`w-12 h-12 flex items-center justify-center border transition-all ${playbackMode === 'radio' ? 'bg-[#E60000] border-[#E60000]' : 'bg-black border-[#333]'}`}>
            <Radio size={18} />
          </button>
          <div className="overflow-hidden hidden sm:block">
            <p className="font-oswald text-sm uppercase tracking-widest font-bold text-white truncate">
              {playbackMode === 'radio' && radioTrack ? radioTrack.title : (audioData?.fileName || "IDLE")}
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center">
          <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center">
            {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-1" />}
          </button>
        </div>

        <div className="w-1/3 flex justify-end items-center gap-3">
          <Volume2 size={14} className="text-[#888]" />
          <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => { setVolume(parseFloat(e.target.value)); if(audioRef.current) audioRef.current.volume = parseFloat(e.target.value); }} className="w-24 accent-[#E60000]" />
        </div>
      </div>
    </div>
  );
}