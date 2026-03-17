"use client";

import React, { useState, useEffect } from "react";
import { Lock, Mail, Key, Loader2, ArrowRight, User as UserIcon, CheckCircle2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useMatrixStore } from "../../store/useMatrixStore";
import { AccessTier, UserSession } from "../../lib/types";

export default function EntryGateway() {
  const { grantAccess, addToast } = useMatrixStore();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stageName, setStageName] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authStep, setAuthStep] = useState<"auth" | "verify_email" | "select_tier">("auth");
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    // Auto-check if they just clicked the email link and have a session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await processUserSession(session.user);
      }
    };
    checkSession();
  }, []);

  const processUserSession = async (user: any) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      let currentProfile = profile;

      // If no profile exists yet (newly verified user), create the default Free Loader profile
      if (!currentProfile) {
        const fallbackStageName = user.user_metadata?.stage_name || "Artist";
        const { error: insertError } = await supabase.from('profiles').insert({
          id: user.id,
          tier: 'Free Loader',
          credits: 5,
          stage_name: fallbackStageName
        });
        if (insertError) throw insertError;
        
        currentProfile = { id: user.id, tier: 'Free Loader', credits: 5, stage_name: fallbackStageName, wallet_balance: 0 };
      }

      setUserProfile({ ...user, ...currentProfile });

      // UX UPGRADE: If they are already a paid user, skip the checkout screen!
      if (currentProfile.tier !== 'Free Loader') {
        const session: UserSession = {
          id: currentProfile.id,
          stageName: currentProfile.stage_name || "Artist",
          tier: currentProfile.tier as AccessTier,
          walletBalance: currentProfile.wallet_balance || 0,
          creditsRemaining: currentProfile.tier === "The Mogul" ? "UNLIMITED" : currentProfile.credits
        };
        grantAccess(session);
      } else {
        // New or Free users land on the tier selection screen
        setAuthStep("select_tier");
      }
    } catch (error: any) {
      console.error("Profile Error:", error);
      if(addToast) addToast("Error syncing matrix profile.", "error");
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (authMode === "signup") {
        if (!stageName.trim()) throw new Error("Moniker / Stage Name is required.");
        
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: { stage_name: stageName }, // Inject Moniker securely into metadata
            emailRedirectTo: window.location.origin
          }
        });
        if (error) throw error;

        // If user is returned but session is null, email confirmation is active!
        if (data.user && !data.session) {
          setAuthStep("verify_email");
          if(addToast) addToast("Secure link dispatched to your inbox.", "success");
        } else if (data.session) {
          await processUserSession(data.user);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) await processUserSession(data.user);
      }
    } catch (error: any) {
      if(addToast) addToast(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // THE FIX: ACTUALLY ROUTE TO STRIPE
  const handleTierSelection = async (tier: AccessTier) => {
    if (!userProfile) return;
    
    if (tier === "Free Loader") {
      // Enter directly without paying
      grantAccess({
        id: userProfile.id,
        stageName: userProfile.stage_name || "Artist",
        tier: "Free Loader",
        walletBalance: userProfile.wallet_balance || 0,
        creditsRemaining: 5
      });
    } else {
      // Trigger the secure Stripe Checkout API
      setLoading(true);
      try {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier, userId: userProfile.id, email: userProfile.email })
        });
        
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url; // Redirect to Stripe
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
    <div className="flex min-h-screen bg-[#050505] text-white items-center justify-center p-6 selection:bg-[#E60000] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'linear-gradient(#111 1px, transparent 1px), linear-gradient(90deg, #111 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      
      <div className="w-full max-w-6xl relative z-10 animate-in fade-in zoom-in duration-500">
        
        {authStep === "auth" && (
          <div className="max-w-md mx-auto bg-black border border-[#222] p-10 relative overflow-hidden shadow-[0_0_50px_rgba(230,0,0,0.1)]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#E60000] to-transparent opacity-50"></div>
            
            <div className="flex flex-col items-center mb-8 text-center">
              <div className="w-16 h-16 bg-[#110000] border border-[#E60000]/30 rounded-full flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(230,0,0,0.2)]">
                <Lock size={24} className="text-[#E60000]" />
              </div>
              <h1 className="font-oswald text-3xl uppercase tracking-[0.2em] font-bold text-white mb-2">Bar-Code.ai</h1>
              <p className="font-mono text-[10px] text-[#888] uppercase tracking-widest">A&R Neural Network Matrix</p>
            </div>

            <div className="flex gap-4 mb-8 border-b border-[#222] pb-4">
               <button onClick={() => setAuthMode("login")} className={`flex-1 font-oswald text-sm uppercase tracking-widest font-bold ${authMode === 'login' ? 'text-[#E60000]' : 'text-[#555]'}`}>Operator Login</button>
               <button onClick={() => setAuthMode("signup")} className={`flex-1 font-oswald text-sm uppercase tracking-widest font-bold ${authMode === 'signup' ? 'text-[#E60000]' : 'text-[#555]'}`}>New Node</button>
            </div>

            <form onSubmit={handleAuth} className="space-y-6">
              <div className="space-y-4">
                {authMode === "signup" && (
                  <div className="relative">
                    <UserIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" />
                    <input 
                      type="text" placeholder="ARTIST / STAGE NAME" value={stageName} onChange={(e) => setStageName(e.target.value)} required
                      className="w-full bg-[#0a0a0a] border border-[#222] text-white py-4 pl-12 pr-4 font-mono text-xs tracking-widest focus:outline-none focus:border-[#E60000] transition-colors"
                    />
                  </div>
                )}
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" />
                  <input 
                    type="email" placeholder="OPERATOR EMAIL" value={email} onChange={(e) => setEmail(e.target.value)} required
                    className="w-full bg-[#0a0a0a] border border-[#222] text-white py-4 pl-12 pr-4 font-mono text-xs tracking-widest focus:outline-none focus:border-[#E60000] transition-colors"
                  />
                </div>
                <div className="relative">
                  <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" />
                  <input 
                    type="password" placeholder="ENCRYPTION KEY" value={password} onChange={(e) => setPassword(e.target.value)} required
                    className="w-full bg-[#0a0a0a] border border-[#222] text-white py-4 pl-12 pr-4 font-mono text-xs tracking-widest focus:outline-none focus:border-[#E60000] transition-colors"
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full bg-white text-black py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all flex justify-center items-center gap-3 disabled:opacity-50">
                {loading ? <Loader2 size={20} className="animate-spin" /> : <>{authMode === "login" ? "Initialize Session" : "Create Node"} <ArrowRight size={18} /></>}
              </button>
            </form>
          </div>
        )}

        {authStep === "verify_email" && (
          <div className="max-w-md mx-auto bg-black border border-[#222] p-10 text-center relative shadow-[0_0_50px_rgba(230,0,0,0.1)] animate-in zoom-in">
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
          <div className="w-full animate-in fade-in">
            <div className="text-center mb-10">
              <p className="font-mono text-[10px] text-green-500 uppercase tracking-widest border border-green-500/20 bg-green-500/5 py-2 inline-block px-6 mb-4">
                Identity Verified: {userProfile?.stage_name}
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
    </div>
  );
}