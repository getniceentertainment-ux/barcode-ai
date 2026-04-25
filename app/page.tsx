"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { 
  UploadCloud, Cpu, PenTool, Mic2, Layers, Sliders, 
  Send, Wallet, Radio, Users, ShieldAlert, LogOut,
  Play, Pause, Volume2, Lock, Zap, Loader2,
  ShieldCheck, Terminal, FileAudio, Trash2, Menu, X, HelpCircle
} from "lucide-react";
import { useMatrixStore } from "../store/useMatrixStore";
import { supabase } from "../lib/supabase";

// The Gateway & Global UI
import EntryGateway from "../components/matrix/EntryGateway";
import GlobalSyncIndicator from "../components/matrix/GlobalSyncIndicator";
import HelpOverlay from "../components/matrix/HelpOverlay";
import RoomDirectives from "../components/matrix/RoomDirectives"; 
import MatrixAutoSave from "../components/matrix/MatrixAutoSave"; 

// The 11 Matrix Rooms
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
import Room11_Exec from "../components/matrix/Room11_Exec";

import SecurityShield from "../components/matrix/SecurityShield";

const CREATOR_ID = process.env.NEXT_PUBLIC_CREATOR_ID; 
const DISCORD_INVITE_LINK = "https://discord.gg/GE7gqXD223";

export default function MatrixController() {
  const { 
    hasAccess, activeRoom, setActiveRoom, userSession, clearMatrix, 
    audioData, isProjectFinalized, playbackMode, setPlaybackMode, 
    radioTrack, setRadioTrack, addToast, hydrateDiskAudio 
  } = useMatrixStore();

  const MASTER_ID = 'f7c05436-8294-4450-8c89-4dfbb70e44b6';
  const isMasterAdmin = userSession?.id === MASTER_ID || userSession?.id === CREATOR_ID;
  const [isHydrated, setIsHydrated] = useState(false);
  const [isBoosting, setIsBoosting] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  
  // UI STATE
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false); 
  const [showDiscordBanner, setShowDiscordBanner] = useState(true);

  // --- ANTI-BLEED GUARD 1: MULTI-TENANT SESSION MONITOR ---
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.id) {
        if (userSession?.id && userSession.id !== session.user.id) {
          console.warn("SECURITY PURGE: User context switch detected. Wiping local matrix cache to prevent bleed.");
          clearMatrix(); 
          localStorage.removeItem('barcode-matrix-storage'); 
          window.location.reload(); 
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [userSession?.id, clearMatrix]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setSidebarOpen(true);
    }
  }, []);

  useEffect(() => {
    hydrateDiskAudio().then(() => setIsHydrated(true));
  }, []);

  const isRoomLockedForTier = (roomId: string) => {
    if (userSession?.id && userSession.id === CREATOR_ID) return false;

    const tier = userSession?.tier || "The Free Loader";
    const isFreeLoader = tier.includes("Free Loader");

    if (isFreeLoader) {
      if (roomId === "05" && (userSession as any)?.has_engineering_token) return false;
      if (roomId === "06" && (userSession as any)?.has_mastering_token) return false;
    }

    const freeAllowed = ["01", "02", "03", "04", "09", "10", "11"];
    const artistAllowed = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11"];

    if (isFreeLoader && !freeAllowed.includes(roomId)) return true;
    if (tier === "The Artist" && !artistAllowed.includes(roomId)) return true;
    return false;
  };

  const handleRoomTransition = (roomId: string) => {
    if (isRoomLockedForTier(roomId)) {
      if (addToast) addToast(`Upgrade or purchase a Room Token to unlock R${roomId}`, "error");
      return;
    }
    setActiveRoom(roomId);
  };

  useEffect(() => {
    if (!userSession?.id) return;
    const channelName = `profile_sync_${userSession.id}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userSession.id}` }, (payload) => {
        const newCredits = payload.new.tier === 'The Mogul' ? 'UNLIMITED' : payload.new.credits;
        useMatrixStore.setState((state) => ({
          userSession: state.userSession ? { 
            ...state.userSession, creditsRemaining: newCredits, has_engineering_token: payload.new.has_engineering_token, has_mastering_token: payload.new.has_mastering_token
          } as any : null
        }));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userSession?.id]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    const url = playbackMode === 'radio' ? radioTrack?.url : audioData?.url;
    if (!url) return;
    if (isPlaying) { audioRef.current.pause(); window.dispatchEvent(new Event('matrix-global-sys-pause')); } 
    else { audioRef.current.play(); window.dispatchEvent(new Event('matrix-global-sys-play')); }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      window.dispatchEvent(new CustomEvent('matrix-global-timeupdate', { detail: audioRef.current.currentTime }));
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - bounds.left) / bounds.width;
    audioRef.current.currentTime = percent * duration;
  };

  const handleTrackEnd = async () => {
    setIsPlaying(false);
    if (playbackMode === 'radio') {
      try {
        const { data: subs } = await supabase.from('submissions').select('*').gte('hit_score', 85).not('audio_url', 'is', null).limit(50);
        if (subs && subs.length > 0) {
          const available = subs.filter(s => s.audio_url !== radioTrack?.url);
          const nextTrack = (available.length > 0 ? available : subs)[Math.floor(Math.random() * (available.length > 0 ? available.length : subs.length))];
          const { data: profile } = await supabase.from('profiles').select('stage_name').eq('id', nextTrack.user_id).single();
          setRadioTrack({ url: nextTrack.audio_url, title: nextTrack.title || "UNTITLED ARTIFACT", artist: profile?.stage_name || "UNKNOWN NODE", score: nextTrack.hit_score });
          setTimeout(() => { if (audioRef.current) { audioRef.current.play().catch(() => {}); setIsPlaying(true); } }, 500);
        }
      } catch(e) { console.error("Auto-play failed", e); }
    }
  };

  const toggleRadioMode = async () => {
    setIsPlaying(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    if (playbackMode === 'radio') setPlaybackMode('session');
    else {
      if (!radioTrack || radioTrack.title === "GETNICE FM LIVE") {
        try {
          const { data: subs } = await supabase.from('submissions').select('*').gte('hit_score', 85).not('audio_url', 'is', null).limit(20);
          if (subs && subs.length > 0) {
            const randomTrack = subs[Math.floor(Math.random() * subs.length)];
            const { data: profile } = await supabase.from('profiles').select('stage_name').eq('id', randomTrack.user_id).single();
            setRadioTrack({ url: randomTrack.audio_url, title: randomTrack.title || "UNTITLED ARTIFACT", artist: profile?.stage_name || "UNKNOWN NODE", score: randomTrack.hit_score });
          } else {
            if (addToast) addToast("No artifacts meet the 85+ score threshold yet.", "info");
            return;
          }
        } catch (err) { return; }
      }
      setPlaybackMode('radio');
      setTimeout(() => { if (audioRef.current) { audioRef.current.play().catch(() => {}); setIsPlaying(true); } }, 500);
    }
  };

  const handleBoostPack = async () => {
    if (!userSession) return;
    setIsBoosting(true);
    try {
      const res = await fetch('/api/stripe/topup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: userSession.id }) });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally { setIsBoosting(false); }
  };

  const handleDisconnect = async () => {
    await supabase.auth.signOut();
    clearMatrix(); 
    useMatrixStore.setState({ hasAccess: false, userSession: null });
    localStorage.clear();
    sessionStorage.clear();
    document.cookie.split(";").forEach((c) => document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"));
    setTimeout(() => window.location.replace('/'), 500);
  };

  const handleNewProject = async () => {
    if (userSession?.id) await supabase.from('matrix_sessions').delete().eq('user_id', userSession.id);
    clearMatrix();
    setActiveRoom("01");
    if (addToast) addToast("Matrix Formatted. Ready for new artifact.", "info");
  };

  if (!isHydrated) return null;
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
    { id: "11", name: "Active Contracts", icon: <FileAudio size={16} /> }, 
  ];

  const renderActiveRoom = () => {
    const lockedRooms = ["01", "02", "03", "04", "05"];
    if (isProjectFinalized && lockedRooms.includes(activeRoom) && userSession?.id !== CREATOR_ID) {
      const isFreeLoader = (userSession?.tier || "").includes("Free Loader");
      return (
        <div className="h-full flex flex-col items-center justify-center text-center animate-in zoom-in duration-500 px-4">
          <div className="bg-[#110000] border border-[#E60000]/30 p-8 md:p-12 rounded-lg flex flex-col items-center w-full max-w-xl">
            <Lock size={64} className="text-[#E60000] mb-6 shadow-[0_0_30px_rgba(230,0,0,0.5)] rounded-full" />
            <h2 className="font-oswald text-3xl md:text-4xl uppercase tracking-widest font-bold text-white mb-4">ARTIFACT LOCKED</h2>
            <p className="font-mono text-[10px] md:text-xs text-[#888] uppercase tracking-widest mb-8 leading-relaxed">
              Track permanently locked in ledger. Structural rooms are no longer editable.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full">
              {!isFreeLoader ? (
                <button onClick={() => setActiveRoom("08")} className="flex-1 bg-black border border-[#333] text-white py-4 font-bold uppercase tracking-widest text-[10px] hover:border-white transition-colors">Vault</button>
              ) : (
                <button onClick={() => setActiveRoom("06")} className="flex-1 bg-black border border-[#333] text-white py-4 font-bold uppercase tracking-widest text-[10px] hover:border-white transition-colors">Return to Master</button>
              )}
              <button onClick={handleNewProject} className="flex-1 bg-[#E60000] text-white py-4 font-bold uppercase tracking-widest text-[10px] hover:bg-red-700 transition-colors shadow-[0_0_15px_rgba(230,0,0,0.3)]">Initialize New</button>
            </div>
          </div>
        </div>
      );
    }
    switch (activeRoom) {
      case "01": return <Room01_Lab />; case "02": return <Room02_BrainTrain />; case "03": return <Room03_Ghostwriter />;
      case "04": return <Room04_Booth />; case "05": return <Room05_VocalSuite />; case "06": return <Room06_Mastering />;
      case "07": return <Room07_Distribution />; case "08": return <Room08_Bank />; case "09": return <Room09_Radio />;
      case "10": return <Room10_Social />; case "11": return <Room11_Exec />; default: return <div />;
    }
  };

  return (
    // Notice the updated `pb-20 md:pb-24` ensuring the new mobile footer doesn't overlap content
    <div className="flex h-[100dvh] bg-[#050505] text-white overflow-hidden pb-20 md:pb-24 font-mono w-full">
      <SecurityShield />      
      
      {/* MOBILE SIDEBAR BACKDROP */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* RESPONSIVE SIDEBAR */}
      <aside className={`
        fixed lg:relative z-50 h-full w-[80%] max-w-[288px] bg-black border-r border-[#111] flex flex-col shrink-0 shadow-2xl transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:flex'}
      `}>
        <div className="p-6 md:p-8 border-b border-[#111] flex justify-between items-start">
          <div>
            <h1 className="font-oswald text-xl md:text-2xl uppercase tracking-[0.2em] font-bold text-[#E60000]">Bar-Code.ai</h1>
            {userSession && (
              <div className="mt-4 p-3 bg-[#050505] border border-[#222]">
                <p className="font-mono text-[9px] text-[#555] uppercase mb-1">Active Operator:</p>
                <p className="font-mono text-[10px] text-white truncate font-bold tracking-widest">NODE_{userSession.id.substring(0, 8).toUpperCase()}</p>
                <div className="flex justify-between items-end mt-3 pt-2 border-t border-[#111]">
                  <p className="font-mono text-[9px] text-green-500 uppercase font-bold tracking-widest">{userSession.tier}</p>
                  <button onClick={handleDisconnect} className="text-[#9c5454] hover:text-[#E60000] transition-colors flex items-center gap-1 text-[9px] font-mono uppercase">
                    <LogOut size={10} /> Logout
                  </button>
                </div>
              </div>
            )}
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-[#555] hover:text-white mt-1">
             <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar pb-32 md:pb-6">
          <div className="space-y-1 mb-8">
            {rooms.map((room) => {
              const isLockedByProject = isProjectFinalized && ["01", "02", "03", "04", "05", "06"].includes(room.id);
              const isLockedByTier = isRoomLockedForTier(room.id);
              return (
                <button
                  key={room.id} 
                  onClick={() => { handleRoomTransition(room.id); if (window.innerWidth < 1024) setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 md:py-4 text-left transition-all rounded-lg group relative ${activeRoom === room.id ? "bg-[#E60000] text-white shadow-[0_4px_15px_rgba(230,0,0,0.2)]" : "text-[#444] hover:bg-[#0a0a0a] hover:text-white"}`}
                >
                  <span className={`${activeRoom === room.id ? 'text-white' : 'text-[#888]'} ${(isLockedByProject || isLockedByTier) ? 'opacity-30' : ''}`}>{room.icon}</span>
                  <span className={`font-oswald text-xs md:text-sm uppercase tracking-widest font-bold ${(isLockedByProject || isLockedByTier) ? 'opacity-30' : ''}`}>
                    R{room.id} - {room.name}
                  </span>
                  {isLockedByTier && <ShieldCheck size={12} className="absolute right-4 text-yellow-600" />}
                  {isLockedByProject && !isLockedByTier && <Lock size={10} className="absolute right-4 text-[#E60000]" />}
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-[#111] space-y-1">
            {isMasterAdmin && (
              <>
                <Link href="/dev-portal" className="w-full flex items-center gap-3 px-4 py-3 text-left text-[#555] hover:text-white hover:bg-[#0a0a0a] transition-all rounded-lg font-oswald text-xs uppercase tracking-widest font-bold">
                  <ShieldAlert size={14} /> API Portal
                </Link>
                <Link href="/admin-node" className="w-full flex items-center gap-3 px-4 py-3 text-left text-yellow-600 hover:text-yellow-400 hover:bg-[#111] transition-all rounded-lg font-oswald text-xs uppercase tracking-widest font-bold border border-yellow-600/20">
                  <Terminal size={14} /> Admin Node
                </Link>
              </>
            )}
            <button onClick={() => setShowHelp(true)} className="w-full flex items-center gap-3 px-4 py-3 text-left text-[#555] hover:text-white hover:bg-[#0a0a0a] transition-all rounded-lg font-oswald text-xs uppercase tracking-widest font-bold border-t border-[#111] mt-4">
              <HelpCircle size={14} /> Comm-Link
            </button>
          </div>
        </nav>
      </aside>

      <main className="flex-1 relative flex flex-col bg-black overflow-hidden w-full h-full">
        
        {/* MOBILE & PC RESPONSIVE HEADER */}
        <div className="h-14 border-b border-[#111] bg-black/80 backdrop-blur-md flex items-center justify-between px-4 md:px-10 z-10 shrink-0">
           <div className="flex items-center gap-3">
             <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-[#E60000] hover:text-white transition-colors">
               <Menu size={24} />
             </button>
             <span className="font-mono text-[9px] text-[#444] uppercase tracking-[0.2em] sm:tracking-[0.4em]">
               {rooms.find(r => r.id === activeRoom)?.name.toUpperCase()}
             </span>
           </div>
           
           <div className="flex items-center gap-2 md:gap-6 ml-auto">
             {userSession && (
               <div className="flex items-center gap-2 md:gap-4">
                 <button onClick={handleNewProject} className="hidden sm:flex items-center gap-2 text-[#555] hover:text-[#E60000] transition-colors font-mono text-[9px] uppercase tracking-widest px-3 py-1 border border-transparent hover:border-[#E60000]/30 rounded-full" title="Format Matrix">
                   <Trash2 size={12} /> Format
                 </button>
                 
                 <div className="flex items-center gap-2 bg-[#110000] border border-[#330000] pl-3 pr-1 py-1 rounded-full shadow-[inset_0_0_10px_rgba(230,0,0,0.1)]">
                   <Zap size={12} className={userSession.creditsRemaining === 0 ? "text-[#555]" : "text-yellow-500"} />
                   <span className="font-mono text-[10px] text-white uppercase tracking-widest font-bold">
                     {userSession.creditsRemaining} <span className="hidden sm:inline">CRD</span>
                   </span>
                   {userSession.tier !== "The Mogul" && (
                     <button onClick={handleBoostPack} disabled={isBoosting} className="ml-2 bg-[#E60000] text-white px-2 md:px-3 py-1 text-[9px] font-bold uppercase tracking-widest hover:bg-red-700 transition-colors rounded-full">
                       {isBoosting ? <Loader2 size={10} className="animate-spin" /> : "Top Up"}
                     </button>
                   )}
                 </div>
               </div>
             )}
           </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-10 relative">
          <div className="absolute inset-0 pointer-events-none opacity-5" style={{ backgroundImage: 'linear-gradient(#222 1px, transparent 1px), linear-gradient(90deg, #222 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          
          {showDiscordBanner && (
            <div className="relative z-10 max-w-5xl mx-auto w-full mb-6 animate-in fade-in slide-in-from-top-4">
              <div className="bg-[#110000] border border-[#E60000]/50 p-4 rounded-lg flex flex-col md:flex-row items-center justify-between shadow-[0_0_20px_rgba(230,0,0,0.15)] gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-black border border-[#E60000] text-[#E60000] flex items-center justify-center rounded-full shrink-0">
                    <Users size={20} />
                  </div>
                  <div>
                    <h3 className="font-oswald text-base md:text-lg uppercase tracking-widest font-bold text-white leading-tight">Join The Syndicate</h3>
                    <p className="font-mono text-[9px] md:text-[10px] text-[#888] uppercase tracking-wider mt-1">24/7 Support in Discord.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto shrink-0">
                  <a href={DISCORD_INVITE_LINK} target="_blank" rel="noreferrer" className="flex-1 md:flex-none bg-[#E60000] text-white px-6 py-2 md:py-3 font-oswald text-xs md:text-sm uppercase tracking-widest font-bold hover:bg-white hover:text-black transition-colors text-center rounded-sm">
                    Enter Discord
                  </a>
                  <button onClick={() => setShowDiscordBanner(false)} className="text-[#555] hover:text-white transition-colors p-2 md:p-3 bg-black border border-[#333] hover:border-[#E60000] rounded-sm shrink-0">
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="relative z-10 max-w-5xl mx-auto w-full">
            <RoomDirectives roomId={activeRoom} />
          </div>

        {/* UNIVERSAL ROOM WRAPPER */}
        <div className="w-full min-h-full pb-12 md:pb-4 overflow-x-hidden flex flex-col">
          {renderActiveRoom()}
        </div>

       </div>

        {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
      </main>

      <GlobalSyncIndicator />
      <MatrixAutoSave /> 

      {/* 🚀 THE NEW RESPONSIVE FOOTER PLAYER 
        - Flexes cleanly on mobile
        - Expands beautifully on PC
      */}
      <div className="flex fixed bottom-0 left-0 right-0 h-16 md:h-24 bg-[#0a0a0a]/95 backdrop-blur-md border-t border-[#222] z-50 items-center px-4 md:px-10 justify-between shadow-[0_-10px_30px_rgba(0,0,0,0.8)] pb-safe">
        
        <audio 
          ref={audioRef} 
          src={playbackMode === 'radio' && radioTrack ? radioTrack.url : audioData?.url || ""} 
          onTimeUpdate={handleTimeUpdate} 
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} 
          onEnded={handleTrackEnd} 
          onPlay={() => setIsPlaying(true)} 
          onPause={() => setIsPlaying(false)} 
          className="hidden" 
        />
        
        {/* Left Side: Toggle & Info */}
        <div className="w-1/2 md:w-1/3 flex items-center gap-3 md:gap-4">
          <button 
            onClick={toggleRadioMode} 
            className={`w-10 h-10 md:w-12 md:h-12 flex shrink-0 items-center justify-center rounded-sm transition-all ${playbackMode === 'radio' ? 'bg-[#E60000] shadow-[0_0_15px_rgba(230,0,0,0.4)]' : 'bg-[#111] border border-[#333] hover:border-white'}`}
          >
            <Radio size={16} className={playbackMode === 'radio' ? "text-white animate-pulse" : "text-[#555]"} />
          </button>
          
          <div className="overflow-hidden flex flex-col justify-center max-w-[120px] sm:max-w-full">
            <p className="font-oswald text-[10px] md:text-sm uppercase tracking-widest font-bold text-white truncate w-full">
              {playbackMode === 'radio' && radioTrack ? radioTrack.title : (audioData?.fileName || "IDLE")}
            </p>
            <p className="font-mono text-[7px] md:text-[9px] uppercase tracking-widest mt-0.5 text-[#E60000] truncate">
              {playbackMode === 'radio' ? `FM BROADCAST` : `STUDIO SESSION`}
            </p>
          </div>
        </div>
        
        {/* Center: Playback Controls (Optimized for touch) */}
        <div className="flex-1 flex flex-col items-center justify-center px-2 md:px-10">
          <button 
            onClick={togglePlay} 
            className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white text-black flex items-center justify-center hover:bg-[#E60000] hover:text-white transition-all shadow-lg active:scale-95"
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-1" />}
          </button>
          
          {/* Progress Bar - Hidden on extra small phones, visible on tablets/PC */}
          <div className="hidden sm:flex w-full items-center gap-2 mt-2">
            <span className="text-[8px] font-mono text-[#555]">{formatTime(currentTime)}</span>
            <div className="flex-1 h-1 md:h-1.5 bg-[#222] rounded-full overflow-hidden cursor-pointer" onClick={handleSeek}>
              <div className="h-full bg-[#E60000] transition-all duration-75" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}></div>
            </div>
            <span className="text-[8px] font-mono text-[#555]">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right Side: Volume (Hidden on Mobile) */}
        <div className="hidden md:flex w-1/3 justify-end items-center gap-3">
          <Volume2 size={14} className="text-[#444]" />
          <input 
            type="range" min="0" max="1" step="0.01" value={volume} 
            onChange={(e) => { 
              setVolume(parseFloat(e.target.value)); 
              if(audioRef.current) audioRef.current.volume = parseFloat(e.target.value); 
            }} 
            className="w-24 h-1 accent-[#E60000] bg-[#222] rounded-full appearance-none cursor-pointer" 
          />
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