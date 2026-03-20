"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, Mail, Loader2, Lock, User as UserIcon, ArrowRight, ShieldCheck } from "lucide-react";
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
  const [authStep, setAuthStep] = useState<"auth" | "verify_email" | "select_tier">("auth");
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const refCode = params.get('ref');
      if (refCode) localStorage.setItem('barcode_referral', refCode);
    }

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await processUserSession(session.user);
      }
    };
    checkUser();
  }, []);

  const processUserSession = async (user: any) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile) {
      setUserProfile({ ...user, ...profile });

      // If they are already paid or have a role, grant access to the Matrix
      // The B2B Portal (Room 11) is now waiting for them inside.
      if (profile.tier !== 'Free Loader') {
        const session: UserSession = {
          id: profile.id,
          stageName: profile.stage_name || "Artist",
          tier: profile.tier as AccessTier,
          walletBalance: profile.wallet_balance || 0,
          creditsRemaining: profile.tier === "The Mogul" ? "UNLIMITED" : profile.credits
        };
        grantAccess(session);
      } else {
        setAuthStep("select_tier");
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setIsScanning(true);
    
    try {
      // Phase 1 Sybil Resistance: Device Fingerprinting
      const fingerprintString = `${navigator.userAgent}|${navigator.language}|${window.screen.width}x${window.screen.height}|${navigator.hardwareConcurrency}|${new Date().getTimezoneOffset()}`;
      let hash = 0;
      for (let i = 0; i < fingerprintString.length; i++) {
        hash = ((hash << 5) - hash) + fingerprintString.charCodeAt(i);
        hash |= 0;
      }
      const deviceId = Math.abs(hash).toString(16);

      // Simulated UI scan delay for UX feedback
      await new Promise(resolve => setTimeout(resolve, 1500));
      setIsScanning(false);

      if (authMode === "signup") {
        if (!stageName.trim()) throw new Error("Stage Name / Moniker is required.");
        
        // --- SURGICAL INJECTION: The Sybil Lock ---
        // Check if this hardware hash is already active on the matrix
        const { data: existingDevice } = await supabase
          .from('profiles')
          .select('id')
          .eq('device_fingerprint', deviceId)
          .maybeSingle();

        if (existingDevice) {
           throw new Error("Sybil Shield Activated: Hardware signature already registered to an active node.");
        }
        // ------------------------------------------

        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            // Bake the hardware hash permanently into their profile
            data: { stage_name: stageName, device_fingerprint: deviceId },
            emailRedirectTo: window.location.origin
          }
        });
        if (error) throw error;
        
        if (data.user && !data.session) {
          setAuthStep("verify_email");
          if(addToast) addToast("Secure link dispatched to your inbox.", "success");
        } else if (data.session) {
          await processUserSession(data.user);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        // --- SURGICAL INJECTION: Retroactive Fingerprint Tagging ---
        // If an older account (or current test account) logs in, permanently tag their hardware hash now.
        if (data.user) {
          await supabase.from('profiles').update({ device_fingerprint: deviceId }).eq('id', data.user.id);
          await processUserSession(data.user);
        }
        // -----------------------------------------------------------
      }
    } catch (err: any) {
      if(addToast) addToast("Auth Failed: " + err.message, "error");
      setIsScanning(false);
    } finally {
      setLoading(false);
    }
  };

  const handleTierSelection = async (tier: AccessTier) => {
    if (!userProfile?.id) return;
    
    const savedRef = localStorage.getItem('barcode_referral');
    if (savedRef) {
      fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userProfile.id, referralCode: savedRef })
      })
      .then(() => localStorage.removeItem('barcode_referral'))
      .catch(console.error);
    }

    if (tier === "Free Loader") {
      const session: UserSession = {
        id: userProfile.id,
        stageName: userProfile.stage_name || "Artist",
        tier: "Free Loader",
        walletBalance: userProfile.wallet_balance || 0,
        creditsRemaining: userProfile.credits !== undefined ? userProfile.credits : 5 
      };
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
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error(data.error || "Failed to initialize Stripe.");
        }
      } catch (err: any) {
        if(addToast) addToast(err.message, "error");
        setLoading(false);
      }
    }
  };

  const tiers: { name: AccessTier; price: string; features: string[]; isPro?: boolean }[] = [
    { name: "Free Loader", price: "0", features: ["5 Generations / Mo", "Standard Queue", "Watermarked Audio"] },
    { name: "The Artist", price: "39", features: ["100 Generations / Mo", "Uncompressed WAVs", "Commercial Rights"] },
    { name: "The Mogul", price: "99", isPro: true, features: ["Unlimited Generations", "Instant Inference", "A&R Fast-Track", "Live Radio Submissions"] }
  ];

  return (
    <div className="min-h-screen bg-[#000] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden selection:bg-[#E60000]">
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#111 1px, transparent 1px), linear-gradient(90deg, #111 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="text-center mb-12 relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="w-20 h-20 border-2 border-[#E60000] flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(230,0,0,0.4)]">
          <span className="font-oswald text-4xl text-[#E60000] font-bold">BC</span>
        </div>
        <h1 className="font-oswald text-5xl md:text-7xl uppercase tracking-[0.3em] font-bold mb-4">Bar-Code<span className="text-[#E60000]">.ai</span></h1>
      </div>

      {authStep === "auth" && (
        <div className="w-full max-w-md bg-[#050505] border border-[#222] p-8 relative z-10 animate-in zoom-in shadow-[0_0_50px_rgba(230,0,0,0.1)]">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#E60000] to-transparent opacity-50"></div>
          
          <div className="flex gap-4 mb-8 border-b border-[#222] pb-4">
             <button onClick={() => setAuthMode("login")} className={`flex-1 font-oswald text-[10px] uppercase tracking-widest font-bold ${authMode === 'login' ? 'text-[#E60000]' : 'text-[#555]'}`}>Operator Login</button>
             <button onClick={() => setAuthMode("signup")} className={`flex-1 font-oswald text-[10px] uppercase tracking-widest font-bold ${authMode === 'signup' ? 'text-[#E60000]' : 'text-[#555]'}`}>New Node</button>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
            {authMode === "signup" && (
              <div>
                <label className="text-[10px] text-[#555] font-bold uppercase tracking-widest mb-2 block">Artist / Stage Name</label>
                <div className="relative">
                  <UserIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" />
                  <input type="text" required value={stageName} onChange={(e) => setStageName(e.target.value)} placeholder="Enter your moniker..." className="w-full bg-black border border-[#333] pl-12 pr-4 py-3 text-xs font-mono text-white outline-none focus:border-[#E60000]" />
                </div>
              </div>
            )}
            <div>
              <label className="text-[10px] text-[#555] font-bold uppercase tracking-widest mb-2 block">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="operator@domain.com" className="w-full bg-black border border-[#333] pl-12 pr-4 py-3 text-xs font-mono text-white outline-none focus:border-[#E60000]" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-[#555] font-bold uppercase tracking-widest mb-2 block">Secure Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" />
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-black border border-[#333] pl-12 pr-4 py-3 text-xs font-mono text-white outline-none focus:border-[#E60000]" />
              </div>
            </div>

            <div className="bg-[#111] border border-[#333] p-3 flex items-center gap-3">
              {isScanning ? <Loader2 size={16} className="text-[#E60000] animate-spin" /> : <ShieldCheck size={16} className="text-green-500" />}
              <span className="text-[9px] font-mono uppercase tracking-widest text-[#888]">
                {isScanning ? "Scanning Device Fingerprint..." : "Sybil Resistance Active (Device Hash)"}
              </span>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-[#E60000] text-white py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex justify-center items-center gap-2">
              {loading && !isScanning ? <Loader2 size={20} className="animate-spin" /> : <>{authMode === "login" ? "Initialize Matrix" : "Create Profile"} <ArrowRight size={18} /></>}
            </button>
          </form>
        </div>
      )}

      {authStep === "verify_email" && (
        <div className="w-full max-w-md bg-black border border-[#222] p-10 text-center relative shadow-[0_0_50px_rgba(230,0,0,0.1)] animate-in zoom-in z-10">
          <Mail size={48} className="mx-auto text-green-500 mb-6" />
          <h2 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-3">Verify Identity</h2>
          <p className="font-mono text-xs text-[#888] uppercase tracking-widest leading-relaxed mb-8">
            A secure entry link has been dispatched to<br/><span className="text-white">{email}</span>
          </p>
          <button onClick={() => setAuthStep("auth")} className="text-[10px] text-[#555] font-mono uppercase tracking-widest hover:text-white transition-colors">
            Return to Login
          </button>
        </div>
      )}

      {authStep === "select_tier" && (
        <div className="w-full max-w-6xl relative z-10 animate-in fade-in">
          <div className="text-center mb-10">
            <p className="font-mono text-[10px] text-green-500 uppercase tracking-widest border border-green-500/20 bg-green-500/5 py-2 inline-block px-6 mb-4">
              Identity Verified: {userProfile?.stage_name || userProfile?.email}
            </p>
            <h2 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white">Select Access Tier</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl mx-auto">
            {tiers.map((tier, i) => (
              <div key={tier.name} className={`bg-[#050505] p-8 flex flex-col transition-all duration-300 animate-in zoom-in delay-${i * 100} ${tier.isPro ? 'border-2 border-[#E60000] scale-105 shadow-[0_0_30px_rgba(230,0,0,0.15)]' : 'border border-[#222] hover:border-[#E60000]'}`}>
                {tier.isPro && <div className="bg-[#E60000] text-white text-[10px] uppercase font-bold tracking-widest text-center py-1 -mt-8 mx-auto px-4 mb-6">Label Recommended</div>}
                <h3 className="font-oswald text-2xl uppercase tracking-widest mb-2 font-bold">{tier.name}</h3>
                <div className="text-4xl font-oswald font-bold mb-8">${tier.price} <span className="text-[10px] text-[#555] font-mono">/MO</span></div>
                <ul className="text-[10px] text-[#888] uppercase font-mono space-y-4 flex-1 mb-8">
                  {tier.features.map(f => (
                    <li key={f} className="flex items-start gap-3"><CheckCircle2 size={14} className="text-[#E60000] shrink-0" /> {f}</li>
                  ))}
                </ul>
                <button 
                  onClick={() => handleTierSelection(tier.name)} 
                  disabled={loading}
                  className={`w-full py-4 text-[10px] uppercase font-bold tracking-widest transition-all flex justify-center items-center gap-2 ${tier.isPro ? 'bg-[#E60000] text-white hover:bg-red-700' : 'bg-black border border-[#333] text-[#888] hover:text-white hover:border-white'} disabled:opacity-50`}
                >
                  {loading && tier.name !== "Free Loader" ? <Loader2 size={14} className="animate-spin" /> : null}
                  {tier.price === "0" ? "Initialize Free Loader" : "Route to Stripe Checkout"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}