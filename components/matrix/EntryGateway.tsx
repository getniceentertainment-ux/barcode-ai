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

      // FIX: If they have a tier and credits already, grant access immediately.
      // Don't force them back to the select_tier screen unless they are brand new.
      if (profile.tier && profile.credits !== null) {
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
      // Simple hash for hardware signature
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
      // Force fetch latest profile to prevent credit resetting to default 5
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

  return (
    <div className="min-h-screen bg-[#000] text-white flex flex-col items-center justify-center p-6 font-mono">
      <div className="text-center mb-12 animate-in fade-in duration-700">
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

            <button type="submit" disabled={loading} className="w-full bg-[#E60000] text-white py-4 text-xs font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex justify-center items-center gap-2">
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