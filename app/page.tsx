"use client";

import React, { useEffect, useState, useRef } from "react";
import { 
  UploadCloud, Cpu, PenTool, Mic2, Layers, Sliders, 
  Send, Wallet, Radio, Users, ShieldAlert, LogOut, Zap, Loader2, Lock, Play, Pause, SkipBack, SkipForward, Volume2, User
} from "lucide-react";
import { useMatrixStore } from "../store/useMatrixStore";
import { supabase } from "../lib/supabase";
import Link from "next/link";

// The Gateway
import EntryGateway from "../components/matrix/EntryGateway";

// Rooms
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
  const store = useMatrixStore();
  const [isBoosting, setIsBoosting] = useState(false);
  
  // Audio Player State
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);

  // GLOBAL AUDIO LISTENERS
  useEffect(() => {
    const handleGlobalPlay = () => audioRef.current?.play();
    const handleGlobalPause = () => audioRef.current?.pause();
    const handleGlobalSeek = (e: any) => {
      if (audioRef.current && e.detail !== undefined) audioRef.current.currentTime = e.detail;
    };

    window.addEventListener('matrix-global-play', handleGlobalPlay);
    window.addEventListener('matrix-global-pause', handleGlobalPause);
    window.addEventListener('matrix-global-seek', handleGlobalSeek);

    return () => {
      window.removeEventListener('matrix-global-play', handleGlobalPlay);
      window.removeEventListener('matrix-global-pause', handleGlobalPause);
      window.removeEventListener('matrix-global-seek', handleGlobalSeek);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current || !store.audioData?.url) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      window.dispatchEvent(new CustomEvent('matrix-global-timeupdate', { detail: audioRef.current.currentTime }));
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const m = Math.floor(time / 60).toString().padStart(2, '0');
    const s = Math.floor(time % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // SUPABASE AUTO-SAVE LOOP (30 Seconds)
  useEffect(() => {
    if (!store.hasAccess || !store.userSession?.id) return;
    
    const saveState = async () => {
      const payload = {
        audioData: store.audioData,
        flowDNA: store.flowDNA,
        blueprint: store.blueprint,
        generatedLyrics: store.generatedLyrics,
        gwTitle: store.gwTitle,
        gwPrompt: store.gwPrompt,
        gwStyle: store.gwStyle
      };
      
      await supabase.from('matrix_states').upsert({
        user_id: store.userSession!.id,
        state_json: payload,
        updated_at: new Date().toISOString()
      });
    };

    const interval = setInterval(saveState, 30000);
    return () => clearInterval(interval);
  }, [store]);

  const handleBoostPack = async () => {
    if (!store.userSession) return;
    setIsBoosting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await fetch('/api/stripe/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: store.userSession.id, email: user?.email })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error(err);
      if(store.addToast) store.addToast("Failed to route to Stripe.", "error");
      setIsBoosting(false);
    }
  };

  const handleDisconnect = async () => {
    await supabase.auth.signOut();
    store.clearMatrix();
    window.location.reload();
  };

  if (!store.hasAccess) return <EntryGateway />;

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
    if (store.isFinalized && lockedRooms.includes(store.activeRoom)) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center animate-in zoom-in duration-500">
          <div className="bg-[#110000] border border-[#E60000]/30 p-12 rounded-lg flex flex-col items-center max-w-xl">
            <Lock size={64} className="text-[#E60000] mb-6 shadow-[0_0_30px_rgba(230,0,0,0.5)] rounded-full" />
            <h2 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white mb-4">ARTIFACT LOCKED</h2>
            <p className="font-mono text-xs text-[#888] uppercase tracking-widest mb-8 leading-relaxed">
              This track has been submitted to the A&R ledger and permanently locked to prevent desyncing. Prior structural rooms can no longer be edited.
            </p>
            <div className="flex gap-4 w-full">
              <button onClick={() => store.setActiveRoom("08")} className="flex-1 bg-black border border-[#333] text-white py-4 font-bold uppercase tracking-widest text-[10px] hover:bg-[#111] hover:border-white transition-colors">
                View in Vault
              </button>
              <button onClick={() => { store.clearMatrix(); store.setActiveRoom("01"); }} className="flex-1 bg-[#E60000] text-white py-4 font-bold uppercase tracking-widest text-[10px] hover:bg-red-700 transition-colors shadow-[0_0_15px_rgba(230,0,0,0.3)]">
                Initialize New Track
              </button>
            </div>
          </div>
        </div>
      );
    }

    switch (store.activeRoom) {
      case "01": return <Room01_Lab />; case "02": return <Room02_BrainTrain />;
      case "03": return <Room03_Ghostwriter />; case "04": return <Room04_Booth />;
      case "05": return <Room05_VocalSuite />; case "06": return <Room06_Mastering />;
      case "07": return <Room07_Distribution />; case "08": return <Room08_Bank />;
      case "09": return <Room09_Radio />; case "10": return <Room10_Social />;
      default: return <div />;
    }
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden selection:bg-[#E60000] pb-24">
      
      <aside className="w-72 bg-black border-r border-[#111] flex flex-col z-20 shadow-2xl shrink-0 hidden md:flex">
        <div className="p-8 border-b border-[#111]">
          <h1 className="font-oswald text-2xl uppercase tracking-[0.2em] font-bold text-[#E60000]">Bar-Code.ai</h1>
          
          {store.userSession && (
            <div className="mt-4 p-3 bg-[#050505] border border-[#222]">
              <p className="font-mono text-[9px] text-[#555] uppercase mb-1">Active Operator:</p>
              <p className="font-mono text-[10px] text-white truncate font-bold tracking-widest">
                NODE_{store.userSession.id.substring(0, 8).toUpperCase()}
              </p>
              
              <Link href={`/${encodeURIComponent(store.userSession.stageName)}`} className="mt-3 flex items-center justify-center gap-2 w-full bg-[#111] border border-[#333] hover:border-[#E60000] hover:text-[#E60000] text-[#888] py-1.5 text-[9px] font-mono uppercase tracking-widest transition-colors">
                <User size={10} /> View Public Profile
              </Link>
              
              <div className="flex justify-between items-end mt-3 pt-2 border-t border-[#111]">
                <p className="font-mono text-[9px] text-green-500 uppercase font-bold tracking-widest">{store.userSession.tier}</p>
                <button onClick={handleDisconnect} className="text-[#555] hover:text-[#E60000] transition-colors flex items-center gap-1 text-[9px] font-mono uppercase" title="Secure Logout">
                  <LogOut size={10} /> Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar">
          <div className="space-y-1 mb-8">
            {rooms.map((room) => {
              const isLocked = store.isFinalized && ["01", "02", "03", "04", "05", "06"].includes(room.id);
              return (
                <button
                  key={room.id} onClick={() => store.setActiveRoom(room.id)}
                  className={`w-full flex flex-col px-5 py-4 text-left transition-all rounded-lg group relative ${store.activeRoom === room.id ? "bg-[#E60000] text-white shadow-[0_4px_15px_rgba(230,0,0,0.2)]" : "text-[#444] hover:bg-[#0a0a0a] hover:text-white"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`${store.activeRoom === room.id ? 'text-white' : 'text-[#888] group-hover:text-[#E60000]'} ${isLocked ? 'opacity-30' : ''}`}>{room.icon}</span>
                    <span className={`font-oswald text-sm uppercase tracking-widest font-bold ${isLocked ? 'opacity-30 line-through' : ''}`}>R{room.id} - {room.name}</span>
                    {isLocked && <Lock size={10} className="absolute right-4 text-[#E60000]" />}
                  </div>
                </button>
              );
            })}
          </div>
          
          <div className="pt-4 border-t border-[#111]">
            <Link href="/admin-node" className="w-full flex items-center gap-3 px-5 py-4 text-left text-yellow-600 hover:text-yellow-500 hover:bg-[#111] transition-all rounded-lg font-oswald text-sm uppercase tracking-widest font-bold">
              <ShieldAlert size={16} /> Admin Node
            </Link>
          </div>
        </nav>
      </aside>

      <main className="flex-1 relative flex flex-col bg-black overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-10" style={{ backgroundImage: 'linear-gradient(#111 1px, transparent 1px), linear-gradient(90deg, #111 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        
        {/* GLOBAL TOP NAVIGATION BAR (HUD) */}
        <div className="h-14 border-b border-[#111] bg-black/80 backdrop-blur-md flex items-center justify-between px-6 lg:px-10 z-10 shrink-0">
           <span className="font-mono text-[9px] text-[#444] uppercase tracking-[0.4em] hidden sm:block">
             Facility // Room {store.activeRoom} // {rooms.find(r => r.id === store.activeRoom)?.name.toUpperCase()}
           </span>
           
           <div className="flex items-center gap-4 sm:gap-6 ml-auto">
             
             {/* 🚨 THE GLOBAL CREDIT DISPLAY HUD 🚨 */}
             {store.userSession && (
               <div className="flex items-center gap-2 bg-[#110000] border border-[#330000] pl-3 pr-1 py-1 rounded-full shadow-[inset_0_0_10px_rgba(230,0,0,0.1)]">
                 <Zap size={12} className={store.userSession.creditsRemaining === 0 ? "text-[#555]" : "text-yellow-500"} />
                 <span className="font-mono text-[10px] text-white uppercase tracking-widest font-bold flex items-center gap-1">
                   {store.userSession.creditsRemaining} <span className="text-[#888] hidden sm:inline">CRD</span>
                 </span>
                 
                 {store.userSession.tier !== "The Mogul" && (
                   <button 
                     onClick={handleBoostPack} 
                     disabled={isBoosting}
                     className="ml-2 bg-[#E60000] text-white px-3 py-1 text-[9px] font-bold uppercase tracking-widest hover:bg-red-700 transition-colors rounded-full flex items-center gap-1"
                   >
                     {isBoosting ? <Loader2 size={10} className="animate-spin" /> : "Top Up"}
                   </button>
                 )}
               </div>
             )}

             {/* Matrix Status Indicator */}
             <div className="flex items-center gap-2 border-l border-[#222] pl-4 sm:pl-6">
               <div className={`w-1.5 h-1.5 rounded-full ${store.isFinalized ? 'bg-yellow-500' : 'bg-[#E60000] animate-pulse'}`} />
               <span className={`text-[8px] uppercase font-bold tracking-widest hidden sm:inline ${store.isFinalized ? 'text-yellow-500' : 'text-[#E60000]'}`}>
                 {store.isFinalized ? 'Matrix Locked' : 'Active Matrix'}
               </span>
             </div>

             {/* Mobile Profile & Disconnect Buttons (Visible only on small screens) */}
             {store.userSession && (
               <Link href={`/${encodeURIComponent(store.userSession.stageName)}`} className="md:hidden text-[#555] hover:text-white ml-4">
                 <User size={14} />
               </Link>
             )}
             <button onClick={handleDisconnect} className="md:hidden text-[#555] hover:text-[#E60000] ml-4">
               <LogOut size={14} />
             </button>

           </div>
        </div>
        
        <div className="flex-1 overflow-hidden relative z-10 p-4 sm:p-6 lg:p-10 custom-scrollbar overflow-y-auto">
          {renderActiveRoom()}
        </div>
      </main>

      {/* GLOBAL AUDIO PLAYER */}
      <div className="fixed bottom-0 left-0 right-0 h-24 bg-[#0a0a0a] border-t border-[#222] z-50 flex items-center px-4 lg:px-10 justify-between shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
        
        {store.audioData?.url && (
          <audio 
            ref={audioRef} 
            src={store.audioData.url} 
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onEnded={() => { setIsPlaying(false); window.dispatchEvent(new Event('matrix-global-sys-pause')); }}
            onPlay={() => { setIsPlaying(true); window.dispatchEvent(new Event('matrix-global-sys-play')); }}
            onPause={() => { setIsPlaying(false); window.dispatchEvent(new Event('matrix-global-sys-pause')); }}
            onSeeked={() => window.dispatchEvent(new CustomEvent('matrix-global-sys-seek', { detail: audioRef.current?.currentTime }))}
            className="hidden" 
          />
        )}

        <div className="w-1/3 lg:w-1/4 flex items-center gap-3 lg:gap-4">
          <div className={`w-10 h-10 lg:w-12 lg:h-12 shrink-0 bg-black border border-[#333] flex items-center justify-center ${isPlaying ? 'border-[#E60000] shadow-[0_0_15px_rgba(230,0,0,0.2)]' : ''}`}>
            <Radio size={20} className={isPlaying ? "text-[#E60000] animate-pulse" : "text-[#555]"} />
          </div>
          <div className="overflow-hidden hidden sm:block">
            <p className="font-oswald text-xs lg:text-sm uppercase tracking-widest font-bold text-white truncate">
              {store.audioData?.fileName || "NO TRACK LOADED"}
            </p>
            <p className="font-mono text-[8px] lg:text-[9px] text-[#555] uppercase tracking-widest mt-0.5">
              {store.audioData?.bpm ? `${Math.round(store.audioData.bpm)} BPM` : 'AWAITING DSP'}
            </p>
          </div>
        </div>

        <div className="flex-1 max-w-2xl flex flex-col items-center justify-center px-4 lg:px-8">
          <div className="flex items-center gap-4 lg:gap-6 mb-2">
            <button onClick={() => { if(audioRef.current) audioRef.current.currentTime = 0; }} className="text-[#888] hover:text-white transition-colors"><SkipBack size={16} /></button>
            <button 
              onClick={togglePlay} 
              disabled={!store.audioData?.url}
              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-[#E60000] hover:text-white transition-all disabled:opacity-20"
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-1" />}
            </button>
            <button className="text-[#888] hover:text-white transition-colors"><SkipForward size={16} /></button>
          </div>
          
          <div className="w-full flex items-center gap-3">
            <span className="text-[9px] lg:text-[10px] font-mono text-[#888]">{formatTime(currentTime)}</span>
            <div className="flex-1 h-1.5 bg-[#222] rounded-full overflow-hidden relative cursor-pointer"
                 onClick={(e) => {
                   if (!audioRef.current) return;
                   const bounds = e.currentTarget.getBoundingClientRect();
                   const percent = (e.clientX - bounds.left) / bounds.width;
                   audioRef.current.currentTime = percent * duration;
                 }}>
              <div className="absolute top-0 left-0 h-full bg-[#E60000]" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}></div>
            </div>
            <span className="text-[9px] lg:text-[10px] font-mono text-[#888]">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="w-1/3 lg:w-1/4 flex justify-end items-center gap-3">
          <Volume2 size={14} className="text-[#888] hidden sm:block" />
          <input 
            type="range" min="0" max="1" step="0.01" value={volume}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setVolume(val);
              if (audioRef.current) audioRef.current.volume = val;
            }}
            className="w-16 lg:w-24 h-1.5 bg-[#222] appearance-none cursor-pointer rounded-full accent-[#E60000] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#E60000] [&::-webkit-slider-thumb]:rounded-full hidden sm:block"
          />
        </div>
      </div>
    </div>
  );
}