"use client";

import React, { useState, useEffect } from "react";
import { 
  CheckCircle2, Mail, Loader2, Lock, User as UserIcon, ArrowRight, ShieldCheck,
  UploadCloud, Cpu, PenTool, Mic2, Layers, Sliders, Send, Wallet, Radio, Users, FileAudio, ChevronRight, Zap, Copy
} from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { AccessTier, UserSession } from "../../lib/types";
import { supabase } from "../../lib/supabase";
import Link from "next/link"; 

export default function EntryGateway() {
  const { grantAccess, addToast, setActiveRoom } = useMatrixStore();
  
  // FIXED: State Variables properly declared
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stageName, setStageName] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  
  const [authStep, setAuthStep] = useState<"landing" | "auth" | "verify_email" | "select_tier">("landing");
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // URL Query State for Referrals & Paywall
  const [referredBy, setReferredBy] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasBypassedPaywall, setHasBypassedPaywall] = useState(false);

  // --- SURGICAL FIX: THE STRIPE RETURN INTERCEPTOR ---
  // Catches the user returning from Stripe and instantly re-authenticates them to unlock the doors
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('queue_skipped') === 'true' || params.get('success') === 'true') {
        window.history.replaceState({}, document.title, window.location.pathname);
        if (addToast) addToast("Node Upgraded. Access Granted.", "success");
        
        // Re-run the session check to pull the new upgraded tier from the database
        const verifyUpgrade = async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            await processUserSession(session.user);
          }
        };
        verifyUpgrade();
      }
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    
    // Check URL for referral codes
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (ref) setReferredBy(ref);
    }
    
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
      .select('*, ref_code')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      setUserProfile({ ...user, ...profile });

      if (profile.tier) {
        
        // --- SURGICAL FIX: MANDATORY PAYWALL INTERCEPT ---
        // If they are a Free Loader and haven't manually clicked past the paywall this session, stop them.
        if (profile.tier === "Free Loader" && !hasBypassedPaywall) {
          setAuthStep("select_tier");
          return; // Halts the login process and forces the upgrade screen
        }

        let safeCredits = profile.credits;
        
        if (safeCredits === null) {
          safeCredits = profile.tier === "The Mogul" ? 999999 : (profile.tier === "The Artist" ? 100 : 5);
          supabase.from('profiles').update({ credits: safeCredits }).eq('id', profile.id).then();
        }

        const session: UserSession = {
          id: profile.id,
          stageName: profile.stage_name || "Artist",
          tier: profile.tier as AccessTier,
          walletBalance: profile.wallet_balance || 0,
          creditsRemaining: profile.tier === "The Mogul" ? "UNLIMITED" : safeCredits
        };

        grantAccess(session);
        setActiveRoom("01"); // Explicitly drop them in the Lab

        try {
          const { data: savedData } = await supabase
            .from('matrix_sessions')
            .select('session_state')
            .eq('user_id', profile.id)
            .maybeSingle();
          
          if (savedData?.session_state) {
            useMatrixStore.setState({ ...savedData.session_state });
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
          options: { 
            data: { 
              stage_name: stageName, 
              device_fingerprint: deviceId,
              referred_by: referredBy 
            } 
          }
        });

        // 🚨 SURGICAL FIX: FIRE GOOGLE ADS CONVERSION WITH ERROR BOUNDARY
        // This ensures aggressive ad-blockers don't crash the entire registration process
        try {
          if (typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', 'conversion', {
                'send_to': 'AW-18074669646/f5ZQCNXOuZscEM6k1qpD'
            });
            console.log("TALON: Google Ads Artist Signup Conversion Fired.");
          }
        } catch (gtagErr) {
          console.warn("TALON: Google Ads conversion blocked by browser security. Proceeding with registration.");
        }

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
      
      // Flip the intercept switch so they can enter
      setHasBypassedPaywall(true);
      
      // Proceed directly into the Matrix
      processUserSession(userProfile);
    } else {
      setLoading(true);
      try {
        const res = await fetch('../api/stripe/checkout', {
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

  const copyReferralLink = () => {
    const link = typeof window !== 'undefined' ? `${window.location.origin}/?ref=${userProfile?.ref_code || userProfile?.id.substring(0,8)}` : '';
    const textArea = document.createElement("textarea");
    textArea.value = link;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      if (addToast) addToast("Bypass Link Copied", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed", err);
    }
    document.body.removeChild(textArea);
  };

  // FIXED: Tiers Array properly formatted
  const tiers: { name: AccessTier; price: string; features: string[]; isPro?: boolean }[] = [
    { name: "Free Loader", price: "0", features: ["5 Credits / Mo", "Standard Audio Processing", "Watermarked Audio"] },
    { name: "The Artist", price: "39", features: ["100 Credits / Mo", "Uncompressed WAVs", "Commercial Rights", "Zero-Latency Priority"] },
    { name: "The Mogul", price: "99", isPro: true, features: ["Unlimited Generations", "Instant Inference", "A&R Fast-Track", "$1,500 Advance Eligibility"] }
  ];

  const roomsInfo = [
    { id: "01", name: "The Lab", desc: "Forensic Audio Injection. Extract the exact BPM, Musical Key, and Bar Count of any beat.", icon: <UploadCloud size={24} /> },
    { id: "02", name: "Brain Train", desc: "The Mind-Meld chamber. Analyzes your transients and vocabulary to build your Flow DNA.", icon: <Cpu size={24} /> },
    { id: "03", name: "Ghostwriter", desc: "Stateless RAG Intelligence. Aggressive, authentic street lyrics mathematically locked to the beat.", icon: <PenTool size={24} /> },
    { id: "04", name: "The Booth", desc: "Zero-latency, hardware-accelerated tracking with a synced, beat-locked teleprompter.", icon: <Mic2 size={24} /> },
    { id: "05", name: "Engineering", desc: "Proprietary Mix rack. Dynamic EQ and compression to glue your vocals directly in the pocket.", icon: <Layers size={24} /> },
    { id: "06", name: "Mastering", desc: "Commercial Render engine. Analog LUFS metering for Spotify and Brickwall club standards.", icon: <Sliders size={24} /> },
    { id: "07", name: "Distribution", desc: "Algorithmic A&R. Calculates Hit Scores and extracts viral snippets for TikTok.", icon: <Send size={24} /> },
    { id: "08", name: "The Bank", desc: "Royalty ledger. High scores trigger automated $1,500 marketing advances. Use in-House to run a 30-day Marketing Campaign. Completely Automated and Guarenteed to bring thousands of fans.", icon: <Wallet size={24} /> },
    { id: "09", name: "The Radio", desc: "GetNice Nation FM. A 24/7 global syndication of the platform's highest-scoring tracks.", icon: <Radio size={24} /> },
    { id: "10", name: "Social Syndicate", desc: "Open Verse Economy. Book top-tier nodes for features using secure, programmatic fiat escrows. Personal Profile Pages! Customize your very own Profile Page. Live Chat Room and More", icon: <Users size={24} /> },
    { id: "11", name: "Active Contracts", desc: "Active Contract Matrix. Monitor live escrow statuses and manage your B2B pipeline.", icon: <FileAudio size={24} /> },
  ];

  // ==========================================
  // VIEW 1: THE FLASHY LANDING PAGE
  // ==========================================
  if (authStep === "landing") {
    return (
      <div className="min-h-screen bg-[#050505] text-[#E0E0E0] selection:bg-[#E60000] selection:text-white relative overflow-x-hidden font-sans">
        
        {/* Background Grid Overlay */}
        <div 
          className="fixed inset-0 pointer-events-none opacity-[0.05] z-0" 
          style={{ backgroundImage: 'linear-gradient(#E0E0E0 1px, transparent 1px), linear-gradient(90deg, #E0E0E0 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        ></div>

        {/* SYSTEM BANNER */}
        <div className="w-full bg-[#E60000] text-white py-2 text-center font-mono text-[9px] uppercase tracking-[0.3em] font-bold z-50 relative">
          <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse mr-2 mb-[1px]"></span>
          System Alert: Matrix Access Open. Zero Latency Tracking Enabled.
        </div>

        {/* Navigation Bar */}
        <nav className={`fixed w-full top-8 z-50 transition-all duration-300 ${scrolled ? 'bg-[#050505]/95 backdrop-blur-md border-b border-[#222] py-2' : 'bg-transparent py-4'}`}>
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="text-[#E60000]" size={20} />
              <span className="font-oswald text-xl md:text-2xl uppercase tracking-[0.2em] font-bold text-white">BAR-CODE<span className="text-[#E60000]">.AI</span></span>
            </div>
            
            <button onClick={() => setAuthStep("auth")} className="border border-[#E60000]/50 bg-[#E60000]/10 hover:bg-[#E60000] hover:text-white text-[#E60000] text-[10px] uppercase font-mono font-bold tracking-widest py-2.5 px-6 transition-colors shadow-[0_0_15px_rgba(230,0,0,0.2)]">
              Access System
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <header className="relative pt-40 pb-20 px-6 flex flex-col items-center text-center z-10 border-b border-[#222]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#E60000]/10 via-[#050505] to-[#050505] -z-10"></div>
          
          <div className="inline-flex items-center gap-2 border border-[#333] bg-[#111] px-4 py-2 rounded-sm mb-10 mt-6 shadow-lg">
            <ShieldCheck size={14} className="text-green-500" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-[#888]">GetNice Records // Operational</span>
          </div>

          <h1 className="font-oswald text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tighter uppercase text-white drop-shadow-[0_0_30px_rgba(230,0,0,0.2)] max-w-5xl leading-[1.1]">
            The First Identity-Aware <br />
            <span className="text-[#E60000] underline underline-offset-[12px] decoration-[#222]">AI Studio Built For Hip-Hop.</span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-center font-mono text-xs md:text-sm text-[#888] mb-12 leading-loose uppercase tracking-widest">
            We put elite A&R, Ghostwriting, and Audio Engineering directly in your browser. Record your vocals, let the matrix mix them to perfection, and distribute your next hit to the world. 
            <br/><br/>
            <span className="text-white font-bold">Stop waiting to be discovered. Build your anthem today.</span>
          </p>
          
          <button onClick={() => setAuthStep("auth")} className="bg-[#E60000] text-white font-oswald text-lg md:text-xl px-12 py-6 uppercase tracking-[0.2em] font-bold relative group hover:bg-red-700 transition-all shadow-[0_0_40px_rgba(230,0,0,0.4)] flex items-center gap-3">
            Enter The Studio (Free) 
            <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform" />
          </button>

          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 max-w-4xl mx-auto w-full border-t border-[#222] pt-12">
            <div className="text-center">
              <p className="font-oswald text-3xl md:text-4xl text-white font-bold tracking-widest mb-1">11</p>
              <p className="font-mono text-[9px] text-[#555] uppercase tracking-widest">Dedicated Rooms</p>
            </div>
            <div className="text-center">
              <p className="font-oswald text-3xl md:text-4xl text-white font-bold tracking-widest mb-1">8,402</p>
              <p className="font-mono text-[9px] text-[#555] uppercase tracking-widest">Artifacts Minted</p>
            </div>
            <div className="text-center">
              <p className="font-oswald text-3xl md:text-4xl text-[#E60000] font-bold tracking-widest mb-1">$24.5K</p>
              <p className="font-mono text-[9px] text-[#555] uppercase tracking-widest">Escrow Secured</p>
            </div>
            <div className="text-center">
              <p className="font-oswald text-3xl md:text-4xl text-green-500 font-bold tracking-widest mb-1">99.9%</p>
              <p className="font-mono text-[9px] text-[#555] uppercase tracking-widest">DSP Uptime</p>
            </div>
          </div>
        </header>

        {/* Systems Architecture Grid */}
        <section className="max-w-7xl mx-auto px-6 py-24 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-end border-b border-[#222] pb-6 mb-12">
            <div>
              <h2 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white mb-2 flex items-center gap-3">
                <Cpu className="text-[#E60000]" size={32} /> System Architecture
              </h2>
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#888]">The 11 Processing Nodes of the Matrix</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {roomsInfo.map((room) => (
              <div key={room.id} className="bg-[#0a0a0a] border border-[#222] p-8 group hover:border-[#E60000] hover:bg-[#110000] transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-[#E60000] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="flex justify-between items-start mb-6">
                  <div className="text-[#E60000] p-3 bg-black border border-[#333] rounded-sm group-hover:shadow-[0_0_15px_rgba(230,0,0,0.3)] transition-all">
                    {room.icon}
                  </div>
                  <span className="font-mono text-[10px] text-[#555] group-hover:text-[#E60000] transition-colors uppercase font-bold tracking-widest">
                    R{room.id}
                  </span>
                </div>
                
                <h3 className="font-oswald text-xl uppercase tracking-widest font-bold text-white mb-4">
                  {room.name}
                </h3>
                <p className="font-mono text-[10px] text-[#888] leading-relaxed uppercase tracking-tighter group-hover:text-gray-300 transition-colors">
                  {room.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA Footer */}
        <section className="border-t border-[#222] py-24 bg-black text-center relative z-10 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-[#E60000]/10 via-transparent to-transparent pointer-events-none"></div>
          <div className="max-w-3xl mx-auto px-6 relative z-10">
            <Lock size={48} className="mx-auto text-[#E60000] mb-6" />
            <h2 className="font-oswald text-4xl md:text-5xl uppercase tracking-widest font-bold text-white mb-6">The Industry is Shifting.</h2>
            <p className="font-mono text-xs text-[#888] uppercase tracking-widest mb-10 leading-loose">
              Don't get left on the old tech. The Matrix is currently open.
            </p>
            <button onClick={() => setAuthStep("auth")} className="bg-white text-black font-oswald text-lg px-10 py-5 uppercase tracking-widest font-bold hover:bg-[#E60000] hover:text-white transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]">
              Start Recording Now
            </button>
          </div>
        </section>

        {/* Legal Footer */}
        <footer className="border-t border-[#111] py-8 bg-[#020202] text-center relative z-10">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-[#555]">
              <Zap size={14} />
              <span className="font-mono text-[9px] uppercase tracking-[0.2em]">PROPERTY OF GETNICE™ ENTERTAINMENT & RECORDS ©2026</span>
            </div>
            
            <div className="flex gap-6">
              <Link href="/terms" className="font-mono text-[9px] text-[#555] hover:text-[#E60000] uppercase tracking-widest transition-colors">
                Terms & Conditions
              </Link>
              <a href="mailto:support@bar-code.ai" className="font-mono text-[9px] text-[#555] hover:text-[#E60000] uppercase tracking-widest transition-colors">
                Admin Support
              </a>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: ORIGINAL AUTHENTICATION FLOW
  // ==========================================
  if (authStep === "auth") {
    return (
      <div className="min-h-screen bg-[#000] text-white flex flex-col items-center justify-center p-6 font-mono relative">
        <button 
          onClick={() => setAuthStep("landing")} 
          className="absolute top-8 left-8 text-[#555] hover:text-white flex items-center gap-2 text-xs uppercase tracking-widest transition-colors relative group"
        >
          ← Abort Login
        </button>

        <div className="text-center mb-12 animate-in fade-in duration-700 mt-12">
          <div className="w-16 h-16 border-2 border-[#E60000] flex items-center justify-center mx-auto mb-6">
            <span className="font-oswald text-2xl text-[#E60000] font-bold">BC</span>
          </div>
          <h1 className="font-oswald text-5xl uppercase tracking-[0.2em] font-bold">Bar-Code<span className="text-[#E60000]">.ai</span></h1>
        </div>

        <div className="w-full max-w-md bg-[#050505] border border-[#222] p-8 shadow-2xl">
          <div className="flex gap-4 mb-8 border-b border-[#222] pb-4">
             <button onClick={() => setAuthMode("login")} className={`flex-1 text-[10px] uppercase tracking-widest font-bold relative group ${authMode === 'login' ? 'text-[#E60000]' : 'text-[#a8aba6]'}`}>
               Login
             </button>
             
             <button onClick={() => setAuthMode("signup")} className={`flex-1 text-[10px] uppercase tracking-widest font-bold relative group ${authMode === 'signup' ? 'text-[#E60000]' : 'text-[#a8aba6]'}`}>
               Register
             </button>
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

            <button type="submit" disabled={loading} className="w-full bg-[#948e8e] text-white py-4 text-xs font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex justify-center items-center gap-2 relative group">
              {loading ? <Loader2 size={16} className="animate-spin" /> : authMode === "login" ? "Enter Studio" : "Register"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: SUBSCRIPTION / UPGRADE TIER
  // ==========================================
  if (authStep === "select_tier") {
    return (
      <div className="min-h-screen bg-[#000] text-white flex flex-col items-center justify-center p-6 font-mono relative">
        <button 
          onClick={async () => { await supabase.auth.signOut(); setAuthStep("landing"); }}
          className="absolute top-8 left-8 text-[#555] hover:text-white flex items-center gap-2 text-xs uppercase tracking-widest transition-colors relative group"
        >
          ← Cancel & Disconnect
        </button>

        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-8 animate-in zoom-in">
          {tiers.map((tier) => (
            <div key={tier.name} className={`bg-[#050505] p-8 border ${tier.isPro ? 'border-[#E60000]' : 'border-[#222]'} flex flex-col`}>
              <h3 className="font-oswald text-xl uppercase tracking-widest mb-4">{tier.name}</h3>
              <div className="text-3xl font-bold mb-8">${tier.price}</div>
              <ul className="text-[10px] text-[#555] uppercase space-y-3 flex-1 mb-8">
                {tier.features.map(f => <li key={f}>• {f}</li>)}
              </ul>
              
              <button 
                onClick={() => handleTierSelection(tier.name)} 
                disabled={loading}
                className="w-full py-3 bg-[#E60000] text-white text-[10px] font-bold uppercase tracking-widest hover:bg-red-700 transition-colors relative flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : `Select ${tier.name}`}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Fallback for Verify Email
  return (
    <div className="min-h-screen bg-[#000] text-white flex flex-col items-center justify-center p-6 font-mono relative">
      <div className="bg-[#050505] border border-[#222] p-12 text-center max-w-md">
        <Mail size={40} className="mx-auto text-[#E60000] mb-4" />
        <p className="text-xs uppercase tracking-widest leading-relaxed">Identity Check Dispatch: Verify your email to complete node initialization.</p>
      </div>
    </div>
  );
}