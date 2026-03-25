"use client";

import React, { useState, useEffect } from "react";
import { 
  CheckCircle2, Mail, Loader2, Lock, User as UserIcon, ArrowRight, ShieldCheck,
  UploadCloud, Cpu, PenTool, Mic2, Layers, Sliders, Send, Wallet, Radio, Users, FileAudio, ChevronRight, Zap
} from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { AccessTier, UserSession } from "../../lib/types";
import { supabase } from "../../lib/supabase";

export default function EntryGateway() {
  const { grantAccess, addToast } = useMatrixStore();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stageName, setStageName] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  
  // ADDED "landing" to the auth steps to serve the flashy page first
  const [authStep, setAuthStep] = useState<"landing" | "auth" | "verify_email" | "select_tier">("landing");
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // For Landing Page Navbar Scroll Effect
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        processUserSession(session.user).catch(console.error);
      }
    };
    checkUser();
  }, []);

  const processUserSession = async (user: any, retries = 0): Promise<void> => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      setUserProfile({ ...user, ...profile });

      if (profile.tier && profile.credits !== null) {
        const session: UserSession = {
          id: profile.id,
          stageName: profile.stage_name || "Artist",
          tier: profile.tier as AccessTier,
          walletBalance: profile.wallet_balance || 0,
          creditsRemaining: profile.tier === "The Mogul" ? "UNLIMITED" : profile.credits
        };

        // 1. Grant base authorization
        grantAccess(session);

        // 2. HALT AND PULL FROM CLOUD BEFORE CONTINUING
        try {
          const { data: savedData } = await supabase
            .from('matrix_sessions')
            .select('session_state')
            .eq('user_id', profile.id)
            .maybeSingle();
          
          if (savedData?.session_state) {
            // 3. Inject the saved rooms, lyrics, and settings
            useMatrixStore.setState({ ...savedData.session_state });
            
            // 4. Reach into the hard drive to reconnect the audio files
            await useMatrixStore.getState().hydrateDiskAudio();
          }
        } catch (err) {
          console.error("Session recovery failed:", err);
        }

      } else {
        setAuthStep("select_tier");
      }
    } else if (retries < 3) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      return processUserSession(user, retries + 1);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setIsScanning(true);
    
    try {
      const deviceId = btoa(navigator.userAgent).substring(0, 16);
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsScanning(false);

      if (authMode === "signup") {
        if (!stageName.trim()) throw new Error("Stage Name is required.");
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: { data: { stage_name: stageName, device_fingerprint: deviceId } }
        });
        if (error) throw error;
        if (data.user && !data.session) setAuthStep("verify_email");
        else if (data.session) await processUserSession(data.user);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) await processUserSession(data.user);
      }
    } catch (err: any) {
      if(addToast) addToast(err.message, "error");
    } finally {
      setLoading(false);
      setIsScanning(false);
    }
  };

  const handleTierSelection = async (tier: AccessTier) => {
    if (!userProfile?.id) return;
    
    if (tier === "Free Loader") {
      const { data: latest } = await supabase.from('profiles').select('credits').eq('id', userProfile.id).single();
      
      const session: UserSession = {
        id: userProfile.id,
        stageName: userProfile.stage_name || "Artist",
        tier: "Free Loader",
        walletBalance: userProfile.wallet_balance || 0,
        creditsRemaining: latest?.credits ?? 5 
      };

      await supabase.from('profiles').update({ tier: "Free Loader", credits: latest?.credits ?? 5 }).eq('id', userProfile.id);
      grantAccess(session);
    } else {
      setLoading(true);
      try {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier, userId: userProfile.id, email: userProfile.email })
        });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
      } catch (err: any) {
        if(addToast) addToast(err.message, "error");
        setLoading(false);
      }
    }
  };

  const tiers: { name: AccessTier; price: string; features: string[]; isPro?: boolean }[] = [
    { name: "Free Loader", price: "0", features: ["5 Credits / Mo", "Standard Queue", "Watermarked Audio"] },
    { name: "The Artist", price: "39", features: ["100 Credits / Mo", "Uncompressed WAVs", "Commercial Rights"] },
    { name: "The Mogul", price: "99", isPro: true, features: ["Unlimited Generations", "Instant Inference", "A&R Fast-Track"] }
  ];

  const roomsInfo = [
    { id: "01", name: "The Lab", desc: "Forensic Audio Injection. Extract the exact BPM, Musical Key, and Bar Count of any beat.", icon: <UploadCloud size={24} /> },
    { id: "02", name: "Brain Train", desc: "The Mind-Meld chamber. Analyzes your transients and vocabulary to build your Flow DNA.", icon: <Cpu size={24} /> },
    { id: "03", name: "Ghostwriter", desc: "Stateless RAG Intelligence. Aggressive, authentic street lyrics mathematically locked to the beat.", icon: <PenTool size={24} /> },
    { id: "04", name: "The Booth", desc: "Zero-latency, hardware-accelerated tracking with a synced, beat-locked teleprompter.", icon: <Mic2 size={24} /> },
    { id: "05", name: "Engineering", desc: "Proprietary Mix rack. Dynamic EQ and compression to glue your vocals directly in the pocket.", icon: <Layers size={24} /> },
    { id: "06", name: "Mastering", desc: "Commercial Render engine. Analog LUFS metering for Spotify and Brickwall club standards.", icon: <Sliders size={24} /> },
    { id: "07", name: "Distribution", desc: "Algorithmic A&R. Calculates Hit Scores and extracts viral snippets for TikTok.", icon: <Send size={24} /> },
    { id: "08", name: "The Bank", desc: "Royalty ledger. High scores trigger automated $1,000 marketing advances. Withdraw via Stripe.", icon: <Wallet size={24} /> },
    { id: "09", name: "The Radio", desc: "GetNice Nation FM. A 24/7 global syndication of the platform's highest-scoring tracks.", icon: <Radio size={24} /> },
    { id: "10", name: "Social Syndicate", desc: "Open Verse Economy. Book top-tier nodes for features using secure, programmatic fiat escrows.", icon: <Users size={24} /> },
    { id: "11", name: "Active Contracts", desc: "Active Contract Matrix. Monitor live escrow statuses and manage your B2B pipeline.", icon: <FileAudio size={24} /> },
  ];

// ==========================================
  // VIEW 1: THE FLASHY LANDING PAGE
  // ==========================================
  if (authStep === "landing") {
    return (
      <div className="min-h-screen bg-[#121212] text-[#E0E0E0] selection:bg-[#E60000] selection:text-white relative overflow-x-hidden font-sans">
        
        {/* Background Grid Overlay */}
        <div 
          className="fixed inset-0 pointer-events-none opacity-[0.03] z-0" 
          style={{ backgroundImage: 'linear-gradient(#E0E0E0 1px, transparent 1px), linear-gradient(90deg, #E0E0E0 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        ></div>

        {/* Navigation Bar */}
        <nav className={`fixed w-full top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#121212]/90 backdrop-blur-md border-b border-[#333]' : 'bg-transparent'}`}>
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="text-[#E60000] animate-pulse-fast" size={20} />
              <span className="font-oswald text-2xl uppercase tracking-[0.2em] font-bold text-[#E60000]">BAR-CODE.AI</span>
            </div>
            <button onClick={() => setAuthStep("auth")} className="gn-btn-outline text-[10px] py-2 px-6">
              Access System
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <header className="relative pt-40 pb-24 px-6 flex flex-col items-center text-center z-10 border-b border-[#333]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#E60000]/5 via-[#121212] to-[#121212] -z-10"></div>
          
          <div className="inline-flex items-center gap-2 border border-[#333] bg-[#1a1a1a] px-4 py-1.5 rounded-full mb-8 mt-10">
            <span className="w-2 h-2 rounded-full bg-[#E60000] animate-pulse"></span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-[#888]">Secure Ingestion Node Ready</span>
          </div>

          <h1 className="font-oswald text-6xl md:text-8xl font-bold mb-6 tracking-tight uppercase text-white drop-shadow-neon-red">
            Crack The Code. <br/> <span className="text-[#E60000]">Own The Flow.</span>
          </h1>
          
          <p className="max-w-3xl mx-auto text-center text-balance font-sans text-lg text-[#888] mb-10 leading-relaxed">
            The First Identity-Aware AI Studio Built For Hip-Hop. Drop A Beat, Let Our Neural Engine Map Your Perfect Flow, Record Your Raw Takes, And Instantly Master Them To Industry Standards. We Bridge The Gap From A Concept In Your Head To A Commercial, Global Release. Your Sound, Amplified By The Machine.
          </p>
          
          <button onClick={() => setAuthStep("auth")} className="gn-btn-primary text-sm px-10 py-5 group shadow-neon-red uppercase tracking-widest">
            Initialize BarCode 
            <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform inline-block ml-2" />
          </button>
        </header>
        {/* Systems Architecture Grid */}
        <section className="max-w-7xl mx-auto px-6 py-24 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-end border-b border-[#333] pb-4 mb-12">
            <div>
              <h2 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white mb-2">System Architecture</h2>
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#888]">11 Dedicated Processing Nodes</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {roomsInfo.map((room) => (
              <div key={room.id} className="gn-panel p-6 group hover:border-[#E60000] transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-[#E60000]/50 opacity-0 group-hover:opacity-100 group-hover:animate-scan-line blur-[2px]"></div>
                
                <div className="flex justify-between items-start mb-6">
                  <div className="text-[#E60000] p-3 bg-[#121212] border border-[#333] rounded-lg group-hover:bg-[#E60000] group-hover:text-white transition-colors">
                    {room.icon}
                  </div>
                  <span className="font-mono text-[10px] text-[#555] group-hover:text-[#E60000] transition-colors uppercase font-bold tracking-widest">
                    R{room.id}
                  </span>
                </div>
                
                <h3 className="font-oswald text-xl uppercase tracking-widest font-bold text-white mb-3">
                  {room.name}
                </h3>
                <p className="font-sans text-sm text-[#888] leading-relaxed">
                  {room.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[#333] py-12 bg-[#0a0a0a] text-center relative z-10">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex justify-center mb-6">
              <Zap className="text-[#333]" size={24} />
            </div>
            <p className="font-mono text-[10px] text-[#555] uppercase tracking-[0.2em] mb-2">
              PROPERTY OF GETNICE™ ENTERTAINMENT &amp; RECORDS ©2026
            </p>
            <p className="font-mono text-[10px] text-[#555] uppercase tracking-[0.2em]">
              ALL RIGHTS RESERVED BY: TALON ANDREW LLOYD
            </p>
          </div>
        </footer>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: ORIGINAL AUTHENTICATION FLOW
  // ==========================================
  return (
    <div className="min-h-screen bg-[#000] text-white flex flex-col items-center justify-center p-6 font-mono relative">
      
      {/* Back to landing page button */}
      <button 
        onClick={() => setAuthStep("landing")} 
        className="absolute top-8 left-8 text-[#555] hover:text-white flex items-center gap-2 text-xs uppercase tracking-widest transition-colors"
      >
        ← Abort Login
      </button>

      <div className="text-center mb-12 animate-in fade-in duration-700 mt-12">
        <div className="w-16 h-16 border-2 border-[#E60000] flex items-center justify-center mx-auto mb-6">
          <span className="font-oswald text-2xl text-[#E60000] font-bold">BC</span>
        </div>
        <h1 className="font-oswald text-5xl uppercase tracking-[0.2em] font-bold">Bar-Code<span className="text-[#E60000]">.ai</span></h1>
      </div>

      {authStep === "auth" && (
        <div className="w-full max-w-md bg-[#050505] border border-[#222] p-8 shadow-2xl">
          <div className="flex gap-4 mb-8 border-b border-[#222] pb-4">
             <button onClick={() => setAuthMode("login")} className={`flex-1 text-[10px] uppercase tracking-widest font-bold ${authMode === 'login' ? 'text-[#E60000]' : 'text-[#444]'}`}>Login</button>
             <button onClick={() => setAuthMode("signup")} className={`flex-1 text-[10px] uppercase tracking-widest font-bold ${authMode === 'signup' ? 'text-[#E60000]' : 'text-[#444]'}`}>New Node</button>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {authMode === "signup" && (
              <input type="text" required value={stageName} onChange={(e) => setStageName(e.target.value)} placeholder="STAGE NAME" className="w-full bg-black border border-[#333] px-4 py-3 text-xs outline-none focus:border-[#E60000]" />
            )}
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="EMAIL" className="w-full bg-black border border-[#333] px-4 py-3 text-xs outline-none focus:border-[#E60000]" />
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="PASSWORD" className="w-full bg-black border border-[#333] px-4 py-3 text-xs outline-none focus:border-[#E60000]" />

            <div className="bg-[#111] border border-[#333] p-3 flex items-center gap-3">
              {isScanning ? <Loader2 size={14} className="animate-spin text-[#E60000]" /> : <ShieldCheck size={14} className="text-green-500" />}
              <span className="text-[9px] uppercase tracking-widest text-[#888]">
                {isScanning ? "Fingerprinting..." : "Device Signature Active"}
              </span>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-[#E60000] text-white py-4 text-xs font-bold uppercase tracking-widest hover:bg-red-900 transition-all flex justify-center items-center gap-2">
              {loading ? "Processing..." : authMode === "login" ? "Initialize Matrix" : "Generate Node"}
            </button>
          </form>
        </div>
      )}

      {authStep === "select_tier" && (
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-8 animate-in zoom-in">
          {tiers.map((tier) => (
            <div key={tier.name} className={`bg-[#050505] p-8 border ${tier.isPro ? 'border-[#E60000]' : 'border-[#222]'} flex flex-col`}>
              <h3 className="font-oswald text-xl uppercase tracking-widest mb-4">{tier.name}</h3>
              <div className="text-3xl font-bold mb-8">${tier.price}</div>
              <ul className="text-[10px] text-[#555] uppercase space-y-3 flex-1 mb-8">
                {tier.features.map(f => <li key={f}>• {f}</li>)}
              </ul>
              <button onClick={() => handleTierSelection(tier.name)} className="w-full py-3 bg-[#E60000] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-red-700 transition-colors">
                Select {tier.name}
              </button>
            </div>
          ))}
        </div>
      )}
      
      {authStep === "verify_email" && (
        <div className="bg-[#050505] border border-[#222] p-12 text-center max-w-md">
          <Mail size={40} className="mx-auto text-[#E60000] mb-4" />
          <p className="text-xs uppercase tracking-widest leading-relaxed">Identity Check Dispatch: Verify your email to complete node initialization.</p>
        </div>
      )}
    </div>
  );
}