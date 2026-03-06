"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, Mail, Loader2 } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { AccessTier, UserSession } from "../../lib/types";
import { supabase } from "../../lib/supabase";

export default function EntryGateway() {
  const grantAccess = useMatrixStore((state) => state.grantAccess);
  
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [authStep, setAuthStep] = useState<"login" | "magic_link_sent" | "select_tier">("login");
  const [user, setUser] = useState<any>(null);

  // Check if user is already logged in on mount
  useEffect(() => {
    // 1. NEW: Capture the referral code from the URL if it exists
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const refCode = params.get('ref');
      if (refCode) {
        localStorage.setItem('barcode_referral', refCode);
      }
    }

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        setAuthStep("select_tier");
      }
    };
    checkUser();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Send a secure Magic Link to their email
    const { error } = await supabase.auth.signInWithOtp({ email });
    
    if (error) {
      alert(error.message);
    } else {
      setAuthStep("magic_link_sent");
    }
    setLoading(false);
  };

  const handleTierSelection = (tier: AccessTier) => {
    if (!user) return;
    
    // 2. NEW: Process Referral Claim silently in the background
    const savedRef = localStorage.getItem('barcode_referral');
    if (savedRef && user.id) {
      fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, referralCode: savedRef })
      })
      .then(() => localStorage.removeItem('barcode_referral'))
      .catch((err) => console.error("Referral claim failed:", err));
    }

    // Grant access using their REAL Supabase Auth ID
    const session: UserSession = {
      id: user.id, // Real Secure UUID from Supabase
      tier: tier,
      walletBalance: 0,
      creditsRemaining: tier === "The Mogul" ? "UNLIMITED" : tier === "The Artist" ? 100 : 5
    };
    grantAccess(session);
  };

  const tiers: { name: AccessTier; price: string; features: string[]; isPro?: boolean }[] = [
    { name: "Free Node", price: "0", features: ["5 Generations / Mo", "Standard Queue", "Watermarked Audio"] },
    { name: "The Artist", price: "10", features: ["100 Generations / Mo", "Priority GPU Access", "Commercial Rights"] },
    { name: "The Mogul", price: "25", isPro: true, features: ["Unlimited Generations", "Instant Inference", "A&R Fast-Track", "Live Radio Submissions"] }
  ];

  return (
    <div className="min-h-screen bg-[#000] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#111 1px, transparent 1px), linear-gradient(90deg, #111 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="absolute top-0 left-0 w-full h-[100px] bg-gradient-to-b from-[#E60000]/10 to-transparent pointer-events-none"></div>

      <div className="text-center mb-12 relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="w-20 h-20 border-2 border-[#E60000] flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(230,0,0,0.4)]">
          <span className="font-oswald text-4xl text-[#E60000] font-bold">BC</span>
        </div>
        <h1 className="font-oswald text-5xl md:text-7xl uppercase tracking-[0.3em] font-bold mb-4">Bar-Code<span className="text-[#E60000]">.ai</span></h1>
      </div>

      {/* AUTHENTICATION STEP */}
      {authStep === "login" && (
        <div className="w-full max-w-md bg-[#050505] border border-[#222] p-8 relative z-10 animate-in zoom-in">
          <p className="font-mono text-xs text-[#888] uppercase tracking-widest text-center mb-8">
            Facility Mainframe Locked // Authenticate to Initialize
          </p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-[10px] text-[#555] font-bold uppercase tracking-widest mb-2 block">Secure Network Link</label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" />
                <input 
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter operator email..." 
                  className="w-full bg-black border border-[#333] pl-12 pr-4 py-4 text-xs font-mono text-white outline-none focus:border-[#E60000] transition-colors"
                />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-[#E60000] text-white py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex justify-center items-center">
              {loading ? <Loader2 size={20} className="animate-spin" /> : "Request Access Token"}
            </button>
          </form>
        </div>
      )}

      {/* MAGIC LINK SENT STEP */}
      {authStep === "magic_link_sent" && (
        <div className="w-full max-w-md bg-[#050505] border border-green-500/30 p-8 text-center relative z-10 animate-in zoom-in">
          <CheckCircle2 size={48} className="text-green-500 mx-auto mb-6 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full" />
          <h3 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-2">Token Dispatched</h3>
          <p className="font-mono text-[10px] text-[#888] uppercase tracking-widest leading-relaxed">
            Check your inbox for the secure Magic Link to bypass the firewall. You can close this window.
          </p>
        </div>
      )}

      {/* TIER SELECTION STEP (Shown after they click the email link) */}
      {authStep === "select_tier" && (
        <div className="w-full max-w-6xl relative z-10 animate-in fade-in">
          <p className="font-mono text-[10px] text-green-500 uppercase tracking-widest text-center mb-8 border border-green-500/20 bg-green-500/5 py-2 inline-block mx-auto px-6">
            Identity Verified: {user?.email}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
            {tiers.map((tier, i) => (
              <div key={tier.name} className={`bg-[#050505] p-8 flex flex-col transition-all duration-300 animate-in zoom-in delay-${i * 100} ${tier.isPro ? 'border-2 border-[#E60000] scale-105 shadow-[0_0_30px_rgba(230,0,0,0.15)]' : 'border border-[#222] hover:border-[#E60000]'}`}>
                {tier.isPro && <div className="bg-[#E60000] text-white text-[10px] uppercase font-bold tracking-widest text-center py-1 -mt-8 mx-auto px-4 mb-6">Recommended</div>}
                <h3 className="font-oswald text-2xl uppercase tracking-widest mb-2 font-bold">{tier.name}</h3>
                <div className="text-4xl font-oswald font-bold mb-8">${tier.price} <span className="text-[10px] text-[#555] font-mono">/MO</span></div>
                <ul className="text-[10px] text-[#888] uppercase font-mono space-y-4 flex-1 mb-8">
                  {tier.features.map(f => (
                    <li key={f} className="flex items-start gap-3"><CheckCircle2 size={14} className="text-[#E60000] shrink-0" /> {f}</li>
                  ))}
                </ul>
                <button 
                  onClick={() => handleTierSelection(tier.name)}
                  className={`w-full py-4 text-[10px] uppercase font-bold tracking-widest transition-all ${tier.isPro ? 'bg-[#E60000] text-white hover:bg-red-700' : 'bg-black border border-[#333] hover:border-white'}`}
                >
                  {tier.price === "0" ? "Initialize Free Node" : "Select Tier"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}