"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, Mail, Loader2, Music, Lock, User as UserIcon } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { AccessTier, UserSession } from "../../lib/types";
import { supabase } from "../../lib/supabase";

export default function EntryGateway() {
  const grantAccess = useMatrixStore((state) => state.grantAccess);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stageName, setStageName] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authStep, setAuthStep] = useState<"auth" | "select_tier">("auth");
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
    // Fetch the ledger profile to get their Stage Name and Tier
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile) {
      setUserProfile({ ...user, ...profile });
      
      // UX UPGRADE: If they are already a paid user, skip the checkout screen!
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
    
    try {
      if (authMode === "signup") {
        if (!stageName.trim()) throw new Error("Stage Name is required.");
        
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: { stage_name: stageName } // Inject Stage Name into raw_user_meta_data
          }
        });
        if (error) throw error;
        if (data.user) await processUserSession(data.user);
        
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) await processUserSession(data.user);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSpotifyLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({ 
      provider: 'spotify',
      options: { redirectTo: window.location.origin }
    });
    if (error) { alert(error.message); setLoading(false); }
  };

  const handleTierSelection = (tier: AccessTier) => {
    if (!userProfile) return;
    
    const savedRef = localStorage.getItem('barcode_referral');
    if (savedRef && userProfile.id) {
      fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userProfile.id, referralCode: savedRef })
      })
      .then(() => localStorage.removeItem('barcode_referral'))
      .catch(console.error);
    }

    const session: UserSession = {
      id: userProfile.id,
      stageName: userProfile.stage_name || "Artist",
      tier: tier,
      walletBalance: userProfile.wallet_balance || 0,
      creditsRemaining: tier === "The Mogul" ? "UNLIMITED" : tier === "The Artist" ? 100 : 5
    };
    grantAccess(session);
  };

  const tiers: { name: AccessTier; price: string; features: string[]; isPro?: boolean }[] = [
    { name: "Free Loader", price: "0", features: ["5 Generations / Mo", "Standard Queue", "Watermarked Audio"] },
    { name: "The Artist", price: "39", features: ["100 Generations / Mo", "Uncompressed WAVs", "Commercial Rights"] },
    { name: "The Mogul", price: "99", isPro: true, features: ["Unlimited Generations", "Instant Inference", "A&R Fast-Track", "Live Radio Submissions"] }
  ];

  return (
    <div className="min-h-screen bg-[#000] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#111 1px, transparent 1px), linear-gradient(90deg, #111 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="text-center mb-12 relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="w-20 h-20 border-2 border-[#E60000] flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(230,0,0,0.4)]">
          <span className="font-oswald text-4xl text-[#E60000] font-bold">BC</span>
        </div>
        <h1 className="font-oswald text-5xl md:text-7xl uppercase tracking-[0.3em] font-bold mb-4">Bar-Code<span className="text-[#E60000]">.ai</span></h1>
      </div>

      {authStep === "auth" && (
        <div className="w-full max-w-md bg-[#050505] border border-[#222] p-8 relative z-10 animate-in zoom-in">
          <div className="flex gap-4 mb-8 border-b border-[#222] pb-4">
             <button onClick={() => setAuthMode("login")} className={`flex-1 font-oswald text-sm uppercase tracking-widest font-bold ${authMode === 'login' ? 'text-[#E60000]' : 'text-[#555]'}`}>Login</button>
             <button onClick={() => setAuthMode("signup")} className={`flex-1 font-oswald text-sm uppercase tracking-widest font-bold ${authMode === 'signup' ? 'text-[#E60000]' : 'text-[#555]'}`}>Sign Up</button>
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
            <button type="submit" disabled={loading} className="w-full bg-[#E60000] text-white py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex justify-center items-center">
              {loading ? <Loader2 size={20} className="animate-spin" /> : authMode === "login" ? "Initialize Matrix" : "Create Profile"}
            </button>
          </form>

          <div className="relative flex items-center justify-center my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#222]"></div></div>
            <span className="relative bg-[#050505] px-4 text-[9px] text-[#555] uppercase tracking-widest">Or authenticate via</span>
          </div>

          <button onClick={handleSpotifyLogin} disabled={loading} className="w-full bg-black border border-[#1DB954] text-[#1DB954] py-3 font-oswald text-sm font-bold uppercase tracking-widest hover:bg-[#1DB954] hover:text-black transition-all flex justify-center items-center gap-3">
            <Music size={16} /> Link Spotify ID
          </button>
        </div>
      )}

      {authStep === "select_tier" && (
        <div className="w-full max-w-6xl relative z-10 animate-in fade-in">
          <p className="font-mono text-[10px] text-green-500 uppercase tracking-widest text-center mb-8 border border-green-500/20 bg-green-500/5 py-2 inline-block mx-auto px-6">
            Identity Verified: {userProfile?.stage_name || userProfile?.email}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
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
                <button onClick={() => handleTierSelection(tier.name)} className={`w-full py-4 text-[10px] uppercase font-bold tracking-widest transition-all ${tier.isPro ? 'bg-[#E60000] text-white hover:bg-red-700' : 'bg-black border border-[#333] hover:border-white'}`}>
                  {tier.price === "0" ? "Initialize Free Loader" : "Select Tier"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}