"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  LayoutDashboard, Mic2, Cpu, Music, Layers, Settings2, Disc, Send, 
  Wallet, Radio, Users, FileText, Lock, Power, Bell, Zap, Loader2, 
  ChevronRight, Play, Pause, SkipForward, Volume2, Globe, Terminal, 
  ShieldCheck, RefreshCw
} from "lucide-react";

// Store & Supabase
import { useMatrixStore } from "../store/useMatrixStore";
import { supabase } from "../lib/supabase";

// Matrix Components (Rooms)
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
import EntryGateway from "../components/matrix/EntryGateway";
import MatrixAutoSave from "../components/matrix/MatrixAutoSave";

const CREATOR_ID = process.env.NEXT_PUBLIC_CREATOR_ID;

export default function App() {
  const { 
    activeRoom, setActiveRoom, hasAccess, userSession, 
    isProjectFinalized, clearMatrix, addToast, audioData 
  } = useMatrixStore();

  const [isHydrated, setIsHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Radio State
  const [isRadioPlaying, setIsRadioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // --- 1. INITIAL HYDRATION ---
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // --- 2. REAL-TIME PROFILE SYNCHRONIZER ---
  // Restores the logic that listens for credit deductions and tier updates in the DB
  useEffect(() => {
    if (!userSession?.id) return;

    const channel = supabase
      .channel(`profile_sync_${userSession.id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles', 
        filter: `id=eq.${userSession.id}` 
      }, (payload) => {
        const updated = payload.new;
        // Sync local store with DB changes (Credits, Tier, Balance)
        useMatrixStore.setState((state) => ({
          userSession: state.userSession ? {
            ...state.userSession,
            tier: updated.tier,
            creditsRemaining: updated.tier === "The Mogul" ? "UNLIMITED" : updated.credits,
            walletBalance: updated.wallet_balance,
            marketingCredits: updated.marketing_credits
          } : null
        }) as any);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userSession?.id]);

  // --- 3. GLOBAL STRIPE REDIRECT HANDLER ---
  // Restores logic to catch success flags from checkout redirects
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    
    if (params.get('topup_success') === 'true') {
      window.history.replaceState({}, document.title, window.location.pathname);
      addToast("Ledger Synchronized. 50 Credits Added.", "success");
    }
    
    if (params.get('master_purchased') === 'true') {
      window.history.replaceState({}, document.title, window.location.pathname);
      addToast("Mastering Token Secured. System Unlocked.", "success");
      setActiveRoom("06");
    }
  }, [addToast, setActiveRoom]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const handleNewProject = () => {
    if (confirm("WARNING: This will purge the current Matrix state and initialize a new artifact session. Proceed?")) {
      clearMatrix();
      setActiveRoom("01");
      addToast("Matrix Purged. New session initialized.", "info");
    }
  };

  const toggleRadio = () => {
    if (!audioRef.current) return;
    if (isRadioPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
    setIsRadioPlaying(!isRadioPlaying);
  };

  // --- ROOM RENDERING ENGINE ---
  const renderActiveRoom = () => {
    const lockedRooms = ["01", "02", "03", "04", "05"];
    
    if (isProjectFinalized && lockedRooms.includes(activeRoom) && userSession?.id !== CREATOR_ID) {
      const isFreeLoader = (userSession?.tier || "").includes("Free Loader");
      return (
        <div className="h-full flex flex-col items-center justify-center text-center animate-in zoom-in duration-500 bg-black/40 backdrop-blur-sm">
          <div className="bg-[#0a0000] border border-[#E60000]/30 p-12 rounded-lg flex flex-col items-center max-w-xl shadow-[0_0_50px_rgba(230,0,0,0.1)]">
            <Lock size={64} className="text-[#E60000] mb-6 shadow-[0_0_30px_rgba(230,0,0,0.5)] rounded-full p-4 bg-[#111]" />
            <h2 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white mb-4">Artifact Gated</h2>
            <p className="font-mono text-xs text-[#888] uppercase tracking-widest mb-8 leading-relaxed">
              This track has been finalized and secured in the ledger. <br/> 
              Structural parameters are no longer editable for this node.
            </p>
            <div className="flex gap-4 w-full">
              {!isFreeLoader ? (
                <button onClick={() => setActiveRoom("08")} className="flex-1 bg-black border border-[#222] text-white py-4 font-bold uppercase tracking-widest text-[10px] hover:border-[#E60000] transition-all">Open Vault</button>
              ) : (
                <button onClick={() => setActiveRoom("06")} className="flex-1 bg-black border border-[#222] text-white py-4 font-bold uppercase tracking-widest text-[10px] hover:border-[#E60000] transition-all">Mastering Suite</button>
              )}
              <button onClick={handleNewProject} className="flex-1 bg-[#E60000] text-white py-4 font-bold uppercase tracking-widest text-[10px] hover:bg-red-700 transition-colors shadow-[0_0_15px_rgba(230,0,0,0.3)]">Initialize New</button>
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
      default: return <Room01_Lab />;
    }
  };

  const rooms = [
    { id: "01", name: "The Lab", icon: <LayoutDashboard size={18} />, category: "Structural" },
    { id: "02", name: "Brain Train", icon: <Cpu size={18} />, category: "Structural" },
    { id: "03", name: "Ghostwriter", icon: <FileText size={18} />, category: "Structural" },
    { id: "04", name: "The Booth", icon: <Mic2 size={18} />, category: "Production" },
    { id: "05", name: "Vocal Suite", icon: <Settings2 size={18} />, category: "Production" },
    { id: "06", name: "Mastering", icon: <Layers size={18} />, category: "Production" },
    { id: "07", name: "Distribution", icon: <Send size={18} />, category: "Market" },
    { id: "08", name: "The Bank", icon: <Wallet size={18} />, category: "Market" },
    { id: "09", name: "Ad Manager", icon: <Radio size={18} />, category: "Market" },
    { id: "10", name: "Syndicate", icon: <Users size={18} />, category: "Social" },
    { id: "11", name: "Legal / AI", icon: <Disc size={18} />, category: "Social" },
  ];

  if (!isHydrated) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center">
        <Loader2 className="text-[#E60000] animate-spin mb-4" size={40} />
        <p className="font-mono text-[10px] text-[#E60000] uppercase tracking-[0.3em] animate-pulse">Initialising OS Node...</p>
      </div>
    );
  }

  if (!hasAccess) return <EntryGateway />;

  return (
    <div className="h-screen bg-[#050505] text-white flex overflow-hidden font-mono selection:bg-[#E60000]">
      <MatrixAutoSave />
      
      {/* SIDEBAR NAVIGATION */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-black border-r border-[#111] transition-all duration-300 flex flex-col shrink-0 z-50`}>
        <div className="p-6 border-b border-[#111] flex items-center justify-between">
          <div className={`font-oswald text-xl font-bold tracking-tighter text-[#E60000] ${!sidebarOpen && 'hidden'}`}>
            BAR-CODE<span className="text-white">.AI</span>
          </div>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-[#333] hover:text-white transition-colors">
            <ChevronRight size={20} className={`transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
          {rooms.map((room) => {
            const isActive = activeRoom === room.id;
            return (
              <button
                key={room.id}
                onClick={() => setActiveRoom(room.id)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-sm transition-all group
                  ${isActive ? 'bg-[#E60000] text-white shadow-[0_0_15px_rgba(230,0,0,0.3)]' : 'text-[#444] hover:bg-[#111] hover:text-white'}`}
              >
                <span className={isActive ? 'text-white' : 'text-[#333] group-hover:text-[#E60000]'}>{room.icon}</span>
                {sidebarOpen && (
                  <div className="flex flex-col items-start overflow-hidden">
                    <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">{room.name}</span>
                    <span className={`text-[7px] uppercase tracking-tighter opacity-50 ${isActive ? 'text-white' : 'text-[#555]'}`}>Room {room.id}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-[#111] bg-[#020202]">
          <button onClick={handleLogout} className="w-full flex items-center gap-4 px-4 py-3 text-[#333] hover:text-red-500 transition-colors">
            <Power size={18} />
            {sidebarOpen && <span className="text-[10px] font-bold uppercase tracking-widest">Terminate Session</span>}
          </button>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-black">
        
        {/* GLOBAL HEADER */}
        <header className="h-16 border-b border-[#111] bg-black flex items-center justify-between px-8 z-40">
           <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[9px] text-[#555] uppercase tracking-[0.2em] font-bold">Node Operator</span>
                <span className="text-xs font-bold text-white uppercase tracking-widest">
                  {userSession?.stageName || "Artist"} // <span className="text-[#E60000]">{userSession?.tier}</span>
                </span>
              </div>
              <div className="h-8 w-[1px] bg-[#111]" />
              <div className="flex flex-col">
                <span className="text-[9px] text-[#555] uppercase tracking-[0.2em] font-bold">Neural Balance</span>
                <span className="text-xs font-bold text-white tracking-widest flex items-center gap-2">
                  <Zap size={10} className="fill-[#E60000] text-[#E60000]" /> {userSession?.creditsRemaining} CRD
                </span>
              </div>
           </div>

           <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col items-end mr-4">
                 <span className="text-[8px] text-[#333] uppercase font-bold tracking-widest">Uplink Status</span>
                 <span className="text-[10px] text-green-500 font-bold uppercase flex items-center gap-1.5">
                   <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" /> Encrypted
                 </span>
              </div>
              <button className="p-2 text-[#333] hover:text-white transition-colors relative">
                <Bell size={18} />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#E60000] rounded-full animate-pulse" />
              </button>
           </div>
        </header>

        {/* ROOM CONTAINER */}
        <section className="flex-1 relative overflow-hidden">
           <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
           <div className="h-full relative z-10 p-6 lg:p-10 overflow-y-auto custom-scrollbar">
             {renderActiveRoom()}
           </div>
        </section>

        {/* NEURAL RADIO FOOTER (RESTORED) */}
        <footer className="h-20 border-t border-[#111] bg-black px-8 flex items-center justify-between z-50">
           <div className="flex items-center gap-6 w-1/3">
              <div className="w-10 h-10 bg-[#111] border border-[#222] flex items-center justify-center rounded-sm overflow-hidden">
                 <Radio size={20} className={isRadioPlaying ? "text-[#E60000] animate-pulse" : "text-[#333]"} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-white uppercase tracking-widest">Brain-Train FM</p>
                <p className="text-[8px] text-[#555] uppercase mt-1 tracking-tighter flex items-center gap-2">
                   <Globe size={8} /> Global Neural Broadcast
                </p>
              </div>
           </div>

           <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-6">
                 <button className="text-[#333] hover:text-white transition-colors"><RefreshCw size={14}/></button>
                 <button onClick={toggleRadio} className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-[#E60000] hover:text-white transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                   {isRadioPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                 </button>
                 <button className="text-[#333] hover:text-white transition-colors"><SkipForward size={14}/></button>
              </div>
              <div className="w-64 h-1 bg-[#111] rounded-full overflow-hidden relative">
                 <div className={`h-full bg-[#E60000] transition-all duration-1000 ${isRadioPlaying ? 'w-2/3' : 'w-0'}`} />
              </div>
           </div>

           <div className="flex items-center justify-end gap-6 w-1/3">
              <div className="flex items-center gap-3">
                 <Volume2 size={14} className="text-[#333]" />
                 <div className="w-20 h-1 bg-[#111] rounded-full overflow-hidden">
                    <div className="w-3/4 h-full bg-[#333]" />
                 </div>
              </div>
              <div className="h-6 w-[1px] bg-[#111]" />
              <div className="text-[8px] font-mono text-[#333] uppercase text-right">
                 <p>OS: v.2.5.0-PROD</p>
                 <p className="text-[#555]">LAT: 0.04ms</p>
              </div>
           </div>

           <audio ref={audioRef} src="https://stream.zeno.fm/078r6zsz9u8uv" className="hidden" crossOrigin="anonymous" />
        </footer>
      </main>
    </div>
  );
}