"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { 
  UploadCloud, Cpu, PenTool, Mic2, Layers, Sliders, 
  Send, Wallet, Radio, Users, ShieldAlert, LogOut,
  Play, Pause, SkipBack, SkipForward, Volume2, Lock, User, Zap, Loader2,
  ShieldCheck
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
    radioTrack, setRadioTrack, addToast
  } = useMatrixStore();

  const [isBoosting, setIsBoosting] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);

  // --- MONETIZATION LOGIC: TIER GATING ---
  const isRoomLockedForTier = (roomId: string) => {
    const tier = userSession?.tier || "Free Loader";
    
    // Free Loaders: Only Creation (R01-R04) + Radio/Social
    const freeAllowed = ["01", "02", "03", "04", "09", "10"];
    // Artists: Everything except Enterprise Social Tools (R10)
    const artistAllowed = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"];

    if (tier === "Free Loader" && !freeAllowed.includes(roomId)) return true;
    if (tier === "The Artist" && !artistAllowed.includes(roomId) && roomId === "10") return true;
    return false;
  };

  const handleRoomTransition = (roomId: string) => {
    if (isRoomLockedForTier(roomId)) {
      if (addToast) addToast(`Upgrade to 'The Artist' to unlock Room ${roomId}`, "error");
      return;
    }
    setActiveRoom(roomId);
  };

  // --- REAL-TIME CREDIT SYNC ---
  useEffect(() => {
    if (!userSession?.id) return;

    const channel = supabase
      .channel('profile_sync')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles',
        filter: `id=eq.${userSession.id}` 
      }, (payload) => {
        const newCredits = payload.new.credits;
        useMatrixStore.setState((state) => ({
          userSession: state.userSession ? { ...state.userSession, creditsRemaining: newCredits } : null
        }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userSession?.id]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    const url = playbackMode === 'radio' ? radioTrack?.url : audioData?.url;
    if (!url) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - bounds.left) / bounds.width;
    audioRef.current.currentTime = percent * duration;
  };

  const handleBoostPack = async () => {
    if (!userSession) return;
    setIsBoosting(true);
    try {
      const res = await fetch('/api/stripe/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userSession.id })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      if(addToast) addToast("Stripe Connection Failed.", "error");
    } finally {
      setIsBoosting(false);
    }
  };

  const handleDisconnect = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('barcode-matrix-storage'); 
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
              This track has been permanently locked. Structural rooms are no longer editable.
            </p>
            <div className="flex gap-4 w-full">
              <button onClick={() => setActiveRoom("08")} className="flex-1 bg-black border border-[#333] text-white py-4 font-bold uppercase tracking-widest text-[10px] hover:border-white transition-colors">
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
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden pb-24 font-mono">
      
      <aside className="w-72 bg-black border-r border-[#111] flex flex-col shrink-0 hidden md:flex z-20 shadow-2xl">
        <div className="p-8 border-b border-[#111]">
          <h1 className="font-oswald text-2xl uppercase tracking-[0.2em] font-bold text-[#E60000]">Bar-Code.ai</h1>
          
          {userSession && (
            <div className="mt-4 p-3 bg-[#050505] border border-[#222]">
              <p className="font-mono text-[9px] text-[#555] uppercase mb-1">Active Operator:</p>
              <p className="font-mono text-[10px] text-white truncate font-bold tracking-widest">
                NODE_{userSession.id.substring(0, 8).toUpperCase()}
              </p>
              
              <div className="flex justify-between items-end mt-3 pt-2 border-t border-[#111]">
                <p className="font-mono text-[9px] text-green-500 uppercase font-bold tracking-widest">{userSession.tier}</p>
                <button onClick={handleDisconnect} className="text-[#555] hover:text-[#E60000] transition-colors flex items-center gap-1 text-[9px] font-mono uppercase">
                  <LogOut size={10} /> Logout
                </button>
              </div>
            </div>
          )}
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 px-3">
          <div className="space-y-1 mb-8">
            {rooms.map((room) => {
              const isLockedByProject = isProjectFinalized && ["01", "02", "03", "04", "05", "06"].includes(room.id);
              const isLockedByTier = isRoomLockedForTier(room.id);

              return (
                <button
                  key={room.id} 
                  onClick={() => handleRoomTransition(room.id)}
                  className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-all rounded-lg group relative ${activeRoom === room.id ? "bg-[#E60000] text-white shadow-[0_4px_15px_rgba(230,0,0,0.2)]" : "text-[#444] hover:bg-[#0a0a0a] hover:text-white"}`}
                >
                  <span className={`${activeRoom === room.id ? 'text-white' : 'text-[#888]'} ${(isLockedByProject || isLockedByTier) ? 'opacity-30' : ''}`}>
                    {room.icon}
                  </span>
                  <span className={`font-oswald text-sm uppercase tracking-widest font-bold ${(isLockedByProject || isLockedByTier) ? 'opacity-30' : ''}`}>
                    R{room.id} - {room.name}
                  </span>
                  {/* FIXED: Removed invalid title prop from icons */}
                  {isLockedByTier && <ShieldCheck size={12} className="absolute right-4 text-yellow-600" />}
                  {isLockedByProject && !isLockedByTier && <Lock size={10} className="absolute right-4 text-[#E60000]" />}
                </button>
              );
            })}
          </div>
          
          <div className="pt-4 border-t border-[#111]">
            <Link href="/dev-portal" className="w-full flex items-center gap-3 px-5 py-4 text-left text-yellow-600 hover:text-yellow-500 hover:bg-[#111] transition-all rounded-lg font-oswald text-sm uppercase tracking-widest font-bold">
              <ShieldAlert size={16} /> API Portal
            </Link>
          </div>
        </nav>
      </aside>

      <main className="flex-1 relative flex flex-col bg-black overflow-hidden">
        <div className="h-14 border-b border-[#111] bg-black/80 backdrop-blur-md flex items-center justify-between px-10 z-10 shrink-0">
           <span className="font-mono text-[9px] text-[#444] uppercase tracking-[0.4em]">
             Matrix // {rooms.find(r => r.id === activeRoom)?.name.toUpperCase()}
           </span>
           
           <div className="flex items-center gap-6 ml-auto">
             {userSession && (
               <div className="flex items-center gap-2 bg-[#110000] border border-[#330000] pl-3 pr-1 py-1 rounded-full shadow-[inset_0_0_10px_rgba(230,0,0,0.1)]">
                 <Zap size={12} className={userSession.creditsRemaining === 0 ? "text-[#555]" : "text-yellow-500"} />
                 <span className="font-mono text-[10px] text-white uppercase tracking-widest font-bold">
                   {userSession.creditsRemaining} CRD
                 </span>
                 
                 {userSession.tier !== "The Mogul" && (
                   <button 
                     onClick={handleBoostPack} disabled={isBoosting}
                     className="ml-2 bg-[#E60000] text-white px-3 py-1 text-[9px] font-bold uppercase tracking-widest hover:bg-red-700 transition-colors rounded-full"
                   >
                     {isBoosting ? <Loader2 size={10} className="animate-spin" /> : "Top Up"}
                   </button>
                 )}
               </div>
             )}
           </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-10 relative">
          <div className="absolute inset-0 pointer-events-none opacity-5" style={{ backgroundImage: 'linear-gradient(#222 1px, transparent 1px), linear-gradient(90deg, #222 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          {renderActiveRoom()}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 h-24 bg-[#0a0a0a] border-t border-[#222] z-50 flex items-center px-10 justify-between">
        <audio ref={audioRef} src={playbackMode === 'radio' && radioTrack ? radioTrack.url : audioData?.url || ""} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} onEnded={() => setIsPlaying(false)} className="hidden" />

        <div className="w-1/3 flex items-center gap-4">
          <div className="overflow-hidden">
            <p className="font-oswald text-sm uppercase tracking-widest font-bold text-white truncate">
              {playbackMode === 'radio' && radioTrack ? radioTrack.title : (audioData?.fileName || "IDLE")}
            </p>
            <p className="font-mono text-[9px] uppercase tracking-widest mt-1 text-[#E60000]">
              {playbackMode === 'radio' ? `FM BROADCAST` : `STUDIO SESSION`}
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center max-w-xl px-10">
          <button onClick={togglePlay} className="mb-2 text-white hover:text-[#E60000] transition-colors">
            {isPlaying ? <Pause size={28} /> : <Play size={28} />}
          </button>
          <div className="w-full flex items-center gap-3">
            <span className="text-[9px] font-mono text-[#444]">{Math.floor(currentTime)}s</span>
            <div className="flex-1 h-1 bg-[#222] rounded-full overflow-hidden cursor-pointer" onClick={handleSeek}>
              <div className="h-full bg-[#E60000]" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}></div>
            </div>
            <span className="text-[9px] font-mono text-[#444]">{Math.floor(duration)}s</span>
          </div>
        </div>

        <div className="w-1/3 flex justify-end items-center gap-3">
          <Volume2 size={14} className="text-[#444]" />
          <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => { setVolume(parseFloat(e.target.value)); if(audioRef.current) audioRef.current.volume = parseFloat(e.target.value); }} className="w-24 h-1 accent-[#E60000] bg-[#222] rounded-full appearance-none cursor-pointer" />
        </div>
      </div>
    </div>
  );
}