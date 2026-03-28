"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { 
  UploadCloud, Cpu, PenTool, Mic2, Layers, Sliders, 
  Send, Wallet, Radio, Users, ShieldAlert, LogOut,
  Play, Pause, SkipBack, SkipForward, Volume2, Lock, User, Zap, Loader2,
  ShieldCheck, Terminal, FileAudio, Trash2, Menu, X, RotateCcw, Info, HelpCircle
} from "lucide-react";
import { useMatrixStore } from "../store/useMatrixStore";
import { supabase } from "../lib/supabase";

// The Gateway & Global UI
import EntryGateway from "../components/matrix/EntryGateway";
import GlobalSyncIndicator from "../components/matrix/GlobalSyncIndicator";
import HelpOverlay from "../components/matrix/HelpOverlay";
import RoomDirectives from "../components/matrix/RoomDirectives"; // FIXED IMPORT PATH

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
import Room11_Contracts from "../components/matrix/Room11_Contracts";

const CREATOR_ID = process.env.NEXT_PUBLIC_CREATOR_ID; 

export default function MatrixController() {
  const { 
    hasAccess, activeRoom, setActiveRoom, userSession, clearMatrix, 
    audioData, isProjectFinalized, playbackMode, setPlaybackMode, 
    radioTrack, setRadioTrack, addToast, hydrateDiskAudio 
  } = useMatrixStore();

  const [isHydrated, setIsHydrated] = useState(false);
  const [isBoosting, setIsBoosting] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  
  // --- UI STATE ---
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showLandscapeTip, setShowLandscapeTip] = useState(false);
  const [showHelp, setShowHelp] = useState(false); // NEW: Help Overlay State
  const formatTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- GOOGLE CHROME AUTO-SCALER (5-SECOND DELAY FIX) ---
  useEffect(() => {
    const handleViewport = () => {
      let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = "viewport";
        document.head.appendChild(meta);
      }
      
      const isLandscape = window.innerWidth > window.innerHeight;
      const isMobileHeight = window.innerHeight < 500;
      
      if (isLandscape && isMobileHeight) {
        if (!sessionStorage.getItem('landscape_tip_shown')) {
          setShowLandscapeTip(true);
          
          if (formatTimeoutRef.current) clearTimeout(formatTimeoutRef.current);
          
          formatTimeoutRef.current = setTimeout(() => {
            meta!.setAttribute('content', 'width=1000, initial-scale=0.1, maximum-scale=5.0, user-scalable=yes');
            setShowLandscapeTip(false);
            sessionStorage.setItem('landscape_tip_shown', 'true');
          }, 5000);
          
        } else {
          meta.setAttribute('content', 'width=1000, initial-scale=0.1, maximum-scale=5.0, user-scalable=yes');
        }
      } else {
        if (formatTimeoutRef.current) clearTimeout(formatTimeoutRef.current);
        setShowLandscapeTip(false);
        meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
      }
    };

    handleViewport();
    window.addEventListener('orientationchange', () => setTimeout(handleViewport, 150));
    
    return () => {
      window.removeEventListener('orientationchange', handleViewport);
      if (formatTimeoutRef.current) clearTimeout(formatTimeoutRef.current);
    };
  }, []);

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
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  useEffect(() => {
    hydrateDiskAudio().then(() => {
      setIsHydrated(true);
    });
  }, []);

  useEffect(() => {    
    setIsHydrated(true);
    useMatrixStore.setState((state) => ({
      vocalStems: [], 
      finalMaster: null, 
      audioData: state.audioData?.url?.startsWith('blob:') ? null : state.audioData
    }));
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
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles',
        filter: `id=eq.${userSession.id}` 
      }, (payload) => {
        const newCredits = payload.new.tier === 'The Mogul' ? 'UNLIMITED' : payload.new.credits;
        const hasEngToken = payload.new.has_engineering_token;
        const hasMastToken = payload.new.has_mastering_token;
        
        useMatrixStore.setState((state) => ({
          userSession: state.userSession ? { 
            ...state.userSession, 
            creditsRemaining: newCredits,
            has_engineering_token: hasEngToken,
            has_mastering_token: hasMastToken
          } as any : null
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

  // --- NEW: AUTO-DJ ENDLESS RADIO LOGIC ---
  const handleTrackEnd = async () => {
    setIsPlaying(false);
    if (playbackMode === 'radio') {
      try {
        const { data: subs } = await supabase
          .from('submissions')
          .select('*')
          .gte('hit_score', 85)
          .not('audio_url', 'is', null)
          .limit(50);
          
        if (subs && subs.length > 0) {
          // Prevent playing the exact same track twice in a row if possible
          const available = subs.filter(s => s.audio_url !== radioTrack?.url);
          const nextTracks = available.length > 0 ? available : subs;
          const nextTrack = nextTracks[Math.floor(Math.random() * nextTracks.length)];
          
          const { data: profile } = await supabase.from('profiles').select('stage_name').eq('id', nextTrack.user_id).single();
          
          setRadioTrack({ 
            url: nextTrack.audio_url, 
            title: nextTrack.title || "UNTITLED ARTIFACT", 
            artist: profile?.stage_name || "UNKNOWN NODE", 
            score: nextTrack.hit_score 
          });
          
          // Slight delay to allow Zustand state to hydrate before forcing play
          setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.play().catch(() => {});
              setIsPlaying(true);
            }
          }, 500);
        }
      } catch(e) {
        console.error("Auto-play failed", e);
      }
    }
  };

  const toggleRadioMode = async () => {
    setIsPlaying(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    
    if (playbackMode === 'radio') {
      setPlaybackMode('session');
    } else {
      // --- NEW: DYNAMIC FIRST-TRACK FETCHER ---
      if (!radioTrack || radioTrack.title === "GETNICE FM LIVE") {
        try {
          const { data: subs } = await supabase
            .from('submissions')
            .select('*')
            .gte('hit_score', 85)
            .not('audio_url', 'is', null)
            .limit(20);
            
          if (subs && subs.length > 0) {
            const randomTrack = subs[Math.floor(Math.random() * subs.length)];
            const { data: profile } = await supabase.from('profiles').select('stage_name').eq('id', randomTrack.user_id).single();
              
            setRadioTrack({ 
              url: randomTrack.audio_url, 
              title: randomTrack.title || "UNTITLED ARTIFACT", 
              artist: profile?.stage_name || "UNKNOWN NODE", 
              score: randomTrack.hit_score 
            });
          } else {
            if (addToast) addToast("No artifacts meet the 85+ score threshold yet.", "info");
            return;
          }
        } catch (err) {
          console.error("Radio sync failed", err);
          return;
        }
      }
      setPlaybackMode('radio');
      
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
      }, 500);
    }
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
      if(addToast) addToast("Failed to route to Stripe.", "error");
    } finally {
      setIsBoosting(false);
    }
  };

  const handleDisconnect = async () => {
    await supabase.auth.signOut();
    clearMatrix(); 
    
    useMatrixStore.setState({ hasAccess: false, userSession: null });
    
    localStorage.clear();
    sessionStorage.clear();
    document.cookie.split(";").forEach((c) => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn("Server wipe bypassed.");
    }
    setTimeout(() => {
      window.location.replace('/'); 
    }, 500);
  };

  const handleNewProject = async () => {
    if (userSession?.id) {
      await supabase.from('matrix_sessions').delete().eq('user_id', userSession.id);
    }
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
                <button onClick={() => setActiveRoom("08")} className="flex-1 bg-black border border-[#333] text-white py-4 font-bold uppercase tracking-widest text-[10px] hover:border-white transition-colors">
                  Vault
                </button>
              ) : (
                <button onClick={() => setActiveRoom("06")} className="flex-1 bg-black border border-[#333] text-white py-4 font-bold uppercase tracking-widest text-[10px] hover:border-white transition-colors">
                  Return to Master
                </button>
              )}
              
              <button onClick={handleNewProject} className="flex-1 bg-[#E60000] text-white py-4 font-bold uppercase tracking-widest text-[10px] hover:bg-red-700 transition-colors shadow-[0_0_15px_rgba(230,0,0,0.3)]">
                Initialize New
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
      case "11": return <Room11_Contracts />;
      default: return <div />;
    }
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden pb-0 md:pb-24 font-mono">
      
      {/* --- EDUCATIONAL UX NOTIFICATION (PRE-FORMAT DELAY OVERLAY) --- */}
      {showLandscapeTip && (
        <div className="fixed inset-0 z-[9999] bg-[#050505] flex flex-col items-center justify-center text-center px-8 animate-in fade-in duration-300">
          <Loader2 size={48} className="text-[#E60000] mb-6 mx-auto animate-spin" />
          <h2 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white mb-4">Optimizing Workspace</h2>
          <p className="font-mono text-[10px] text-[#888] uppercase tracking-widest leading-relaxed mb-8 max-w-sm mx-auto">
            Calibrating DAW resolution for landscape mode. The interface will automatically format to fit your screen.
          </p>
          
          <div className="flex flex-col items-center gap-3">
             <div className="flex gap-2">
               {[...Array(5)].map((_, i) => (
                 <div key={i} className="w-2.5 h-2.5 bg-[#E60000] rounded-full animate-bounce shadow-[0_0_10px_rgba(230,0,0,0.5)]" style={{ animationDelay: `${i * 0.15}s` }} />
               ))}
             </div>
             <p className="font-mono text-[9px] text-[#E60000] uppercase tracking-widest font-bold mt-2 animate-pulse">
               Please wait 5 seconds...
             </p>
          </div>
        </div>
      )}

      {/* --- MOBILE OVERLAY BACKDROP --- */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* --- RESPONSIVE SIDEBAR --- */}
      <aside className={`
        fixed lg:relative z-50 h-full w-72 bg-black border-r border-[#111] flex flex-col shrink-0 shadow-2xl transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:flex'}
      `}>
        <div className="p-8 border-b border-[#111] flex justify-between items-start">
          <div>
            <h1 className="font-oswald text-2xl uppercase tracking-[0.2em] font-bold text-[#E60000]">Bar-Code.ai</h1>
            {userSession && (
              <div className="mt-4 p-3 bg-[#050505] border border-[#222]">
                <p className="font-mono text-[9px] text-[#555] uppercase mb-1">Active Operator:</p>
                <p className="font-mono text-[10px] text-white truncate font-bold tracking-widest">
                  NODE_{userSession.id.substring(0, 8).toUpperCase()}
                </p>
                <div className="flex justify-between items-end mt-3 pt-2 border-t border-[#111]">
                  <p className="font-mono text-[9px] text-green-500 uppercase font-bold tracking-widest">{userSession.tier}</p>
                  <button onClick={handleDisconnect} className="text-[#9c5454] hover:text-[#E60000] transition-colors flex items-center gap-1 text-[9px] font-mono uppercase">
                    <LogOut size={10} /> Logout
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Mobile Close Button */}
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-[#555] hover:text-white mt-1">
             <X size={20} />
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
                  onClick={() => {
                    handleRoomTransition(room.id);
                    if (window.innerWidth < 1024) setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-all rounded-lg group relative ${activeRoom === room.id ? "bg-[#E60000] text-white shadow-[0_4px_15px_rgba(230,0,0,0.2)]" : "text-[#444] hover:bg-[#0a0a0a] hover:text-white"}`}
                >
                  <span className={`${activeRoom === room.id ? 'text-white' : 'text-[#888]'} ${(isLockedByProject || isLockedByTier) ? 'opacity-30' : ''}`}>{room.icon}</span>
                  <span className={`font-oswald text-sm uppercase tracking-widest font-bold ${(isLockedByProject || isLockedByTier) ? 'opacity-30' : ''}`}>R{room.id} - {room.name}</span>
                  {isLockedByTier && <ShieldCheck size={12} className="absolute right-4 text-yellow-600" />}
                  {isLockedByProject && !isLockedByTier && <Lock size={10} className="absolute right-4 text-[#E60000]" />}
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-[#111] space-y-1">
            <Link href="/dev-portal" className="w-full flex items-center gap-3 px-5 py-4 text-left text-[#555] hover:text-white hover:bg-[#0a0a0a] transition-all rounded-lg font-oswald text-sm uppercase tracking-widest font-bold">
              <ShieldAlert size={16} /> API Portal
            </Link>

            {CREATOR_ID && userSession?.id === CREATOR_ID && (
              <Link href="/admin-node" className="w-full flex items-center gap-3 px-5 py-4 text-left text-yellow-600 hover:text-yellow-400 hover:bg-[#111] transition-all rounded-lg font-oswald text-sm uppercase tracking-widest font-bold border border-yellow-600/20">
                <Terminal size={16} /> Admin Node
              </Link>
            )}

            {/* NEW: COMM-LINK / HELP BUTTON */}
            <button onClick={() => setShowHelp(true)} className="w-full flex items-center gap-3 px-5 py-4 text-left text-[#555] hover:text-white hover:bg-[#0a0a0a] transition-all rounded-lg font-oswald text-sm uppercase tracking-widest font-bold border-t border-[#111] mt-4">
              <HelpCircle size={16} /> Comm-Link / Help
            </button>
          </div>
        </nav>
      </aside>

      <main className="flex-1 relative flex flex-col bg-black overflow-hidden w-full">
        {/* MOBILE RESPONSIVE HEADER */}
        <div className="h-14 border-b border-[#111] bg-black/80 backdrop-blur-md flex items-center justify-between px-4 md:px-10 z-10 shrink-0">
           <div className="flex items-center gap-3">
             <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-[#E60000] hover:text-white transition-colors">
               <Menu size={24} />
             </button>
             <span className="font-mono text-[9px] text-[#444] uppercase tracking-[0.4em] hidden sm:inline">
               Matrix // {rooms.find(r => r.id === activeRoom)?.name.toUpperCase()}
             </span>
           </div>
           
           <div className="flex items-center gap-4 md:gap-6 ml-auto">
             {userSession && (
               <div className="flex items-center gap-3 md:gap-4">
                 <button 
                   onClick={handleNewProject} 
                   className="hidden sm:flex items-center gap-2 text-[#555] hover:text-[#E60000] transition-colors font-mono text-[9px] uppercase tracking-widest px-3 py-1 border border-transparent hover:border-[#E60000]/30 rounded-full"
                   title="Nuke Matrix and Start Fresh"
                 >
                   <Trash2 size={12} /> Format
                 </button>
                 
                 <div className="flex items-center gap-2 bg-[#110000] border border-[#330000] pl-3 pr-1 py-1 rounded-full shadow-[inset_0_0_10px_rgba(230,0,0,0.1)]">
                   <Zap size={12} className={userSession.creditsRemaining === 0 ? "text-[#555]" : "text-yellow-500"} />
                   <span className="font-mono text-[10px] text-white uppercase tracking-widest font-bold">{userSession.creditsRemaining} <span className="hidden sm:inline">CRD</span></span>
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
          
          {/* --- SURGICAL ADDITION: UNIVERSAL ROOM DIRECTIVES --- */}
          {/* This ensures the instructions stay pinned to the top of every room automatically */}
          <div className="relative z-10 max-w-5xl mx-auto w-full">
            <RoomDirectives roomId={activeRoom} />
          </div>

          {renderActiveRoom()}
        </div>

        {/* NEW: HELP OVERLAY */}
        {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
      </main>

      <GlobalSyncIndicator />

      {/* --- LANDSCAPE LOCK (MOBILE PORTRAIT OVERLAY) --- */}
      <div className="fixed inset-0 z-[9999] bg-[#050505] flex-col items-center justify-center text-center px-8 hidden portrait:flex lg:!hidden">
        <RotateCcw size={48} className="text-[#E60000] mb-6 mx-auto animate-[spin_4s_linear_infinite]" />
        <h2 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white mb-4">Rotate Device</h2>
        <p className="font-mono text-[10px] text-[#888] uppercase tracking-widest leading-relaxed">
          Bar-Code.ai requires a widescreen DAW interface. <br /><br />
          Please turn your device horizontally to enter the Matrix.
        </p>
      </div>

      {/* RESPONSIVE FOOTER PLAYER (Hidden on mobile to reclaim screen real estate) */}
      <div className="hidden md:flex fixed bottom-0 left-0 right-0 h-24 bg-[#0a0a0a] border-t border-[#222] z-50 items-center px-4 md:px-10 justify-between shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
        {/* FIX: Injected handleTrackEnd into the onEnded event listener */}
        <audio ref={audioRef} src={playbackMode === 'radio' && radioTrack ? radioTrack.url : audioData?.url || ""} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} onEnded={handleTrackEnd} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} className="hidden" />
        
        <div className="w-auto md:w-1/3 flex items-center gap-2 md:gap-4">
          <button onClick={toggleRadioMode} className={`w-10 h-10 md:w-12 md:h-12 flex shrink-0 items-center justify-center border transition-all ${playbackMode === 'radio' ? 'bg-[#E60000] border-[#E60000] shadow-[0_0_15px_rgba(230,0,0,0.4)]' : 'bg-black border-[#333] hover:bg-white hover:text-black hover:border-white'}`}>
            <Radio size={16} className={playbackMode === 'radio' ? "text-white animate-pulse" : "text-[#555]"} />
          </button>
          <div className="overflow-hidden hidden sm:block">
            <p className="font-oswald text-xs md:text-sm uppercase tracking-widest font-bold text-white truncate">{playbackMode === 'radio' && radioTrack ? radioTrack.title : (audioData?.fileName || "IDLE")}</p>
            <p className="font-mono text-[8px] md:text-[9px] uppercase tracking-widest mt-1 text-[#E60000]">{playbackMode === 'radio' ? `FM BROADCAST` : `STUDIO SESSION`}</p>
          </div>
        </div>
        
        <div className="flex-1 flex flex-col items-center max-w-xl px-2 md:px-10">
          <div className="flex items-center gap-4 md:gap-6 mb-2">
            <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-[#E60000] hover:text-white transition-all">
              {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-1" />}
            </button>
          </div>
          <div className="w-full flex items-center gap-2 md:gap-3">
            <span className="text-[9px] font-mono text-[#444]">{formatTime(currentTime)}</span>
            <div className="flex-1 h-1 bg-[#222] rounded-full overflow-hidden cursor-pointer" onClick={handleSeek}>
              <div className="h-full bg-[#E60000]" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}></div>
            </div>
            <span className="text-[9px] font-mono text-[#444]">{formatTime(duration)}</span>
          </div>
        </div>
        
        <div className="hidden md:flex w-1/3 justify-end items-center gap-3">
          <Volume2 size={14} className="text-[#444]" />
          <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => { setVolume(parseFloat(e.target.value)); if(audioRef.current) audioRef.current.volume = parseFloat(e.target.value); }} className="w-24 h-1 accent-[#E60000] bg-[#222] rounded-full appearance-none cursor-pointer" />
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