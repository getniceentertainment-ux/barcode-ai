"use client";

import React, { useState, useEffect } from "react";
import { Wallet, TrendingUp, FileText, CheckCircle2, AlertTriangle, ArrowRight, Lock, CreditCard, Loader2 } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";

export default function Room08_Bank() {
  const { userSession, setActiveRoom } = useMatrixStore();
  
  const [status, setStatus] = useState<"evaluating" | "deal_ready" | "distributed">("evaluating");
  const [platformSplit, setPlatformSplit] = useState(15);
  
  // Mocking a generated balance to demonstrate the Stripe withdrawal feature
  const [royaltyBalance, setRoyaltyBalance] = useState(userSession?.walletBalance || 142.50);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  useEffect(() => {
    // Simulate the Bank evaluating the Hit Score to determine their Distribution Deal terms
    const timer = setTimeout(() => {
      // Platform takes a smaller split for higher-tier users
      const split = userSession?.tier === "The Mogul" ? 5 : userSession?.tier === "The Artist" ? 10 : 20;
      setPlatformSplit(split);
      setStatus("deal_ready");
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [userSession]);

  const handleAcceptDeal = () => {
    // Simulate accepting the distribution contract
    setStatus("distributed");
  };

  const handleWithdraw = async () => {
    if (royaltyBalance <= 0) return;
    setIsWithdrawing(true);
    
    // Simulate Stripe Connect payout API call
    setTimeout(() => {
      setRoyaltyBalance(0);
      setIsWithdrawing(false);
      alert("Funds successfully routed to your connected Stripe bank account.");
    }, 2000);
  };

  const handleProceed = () => {
    setActiveRoom("09");
  };

  return (
    <div className="h-full flex flex-col p-8 lg:p-12 animate-in fade-in duration-500 overflow-y-auto custom-scrollbar">
      
      {/* HEADER & STRIPE DASHBOARD */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-[#222] pb-6 mb-10 gap-6">
        <div>
          <h2 className="font-oswald text-4xl uppercase tracking-widest font-bold text-[#E60000] flex items-center gap-4">
            <Wallet size={36} /> The Bank
          </h2>
          <p className="text-[10px] text-[#555] uppercase tracking-[0.3em] mt-2 font-mono">
            Royalty Ledger // Stripe Connect Gateway
          </p>
        </div>
        
        <div className="bg-[#050505] border border-[#222] p-4 flex items-center gap-6 rounded">
          <div className="text-right">
            <p className="text-[10px] text-[#888] uppercase tracking-widest font-bold mb-1">Available Royalties</p>
            <p className="font-oswald text-3xl font-bold text-white tracking-widest">
              ${royaltyBalance.toFixed(2)} <span className="text-sm text-green-500 font-mono">USD</span>
            </p>
          </div>
          <button 
            onClick={handleWithdraw}
            disabled={royaltyBalance <= 0 || isWithdrawing}
            className="bg-white text-black px-4 py-3 font-bold uppercase tracking-widest text-[10px] hover:bg-[#E60000] hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isWithdrawing ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
            Withdraw
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full">
        
        {/* EVALUATING STATE */}
        {status === "evaluating" && (
          <div className="bg-[#050505] border border-[#222] p-16 flex flex-col items-center justify-center text-center rounded-lg h-[400px]">
            <TrendingUp size={64} className="text-[#E60000] animate-pulse mb-8" />
            <h3 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white mb-4">
              Auditing Track Value
            </h3>
            <p className="font-mono text-xs text-[#888] uppercase tracking-widest">
              Calculating distribution tier and royalty splits based on A&R Hit Score...
            </p>
          </div>
        )}

        {/* DEAL READY STATE */}
        {status === "deal_ready" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-8 duration-700">
            
            {/* THE DISTRIBUTION TICKET */}
            <div className="bg-black border-2 border-[#E60000] p-8 flex flex-col relative shadow-[0_0_30px_rgba(230,0,0,0.15)] group">
              <div className="absolute top-0 right-0 bg-[#E60000] text-white text-[9px] uppercase font-bold tracking-widest px-3 py-1">
                Action Required
              </div>
              
              <FileText size={32} className="text-[#E60000] mb-6" />
              <h3 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-2">
                360 Media & Broadcast Deal
              </h3>
              <p className="font-mono text-[10px] text-[#888] uppercase tracking-widest mb-8 border-b border-[#222] pb-6">
                Sync Licensing // 24/7 FM Broadcast // Content ID
              </p>
              
              <div className="my-auto space-y-6 mb-10">
                <div className="flex justify-between items-center border border-[#111] bg-[#050505] p-4">
                  <span className="text-[10px] font-mono text-[#888] uppercase tracking-widest">Upfront Fee</span>
                  <span className="text-xl font-oswald text-green-500 font-bold">$0.00</span>
                </div>
                <div className="flex justify-between items-center border border-[#111] bg-[#050505] p-4">
                  <span className="text-[10px] font-mono text-[#888] uppercase tracking-widest">Your Royalty Keep</span>
                  <span className="text-xl font-oswald text-white font-bold">{100 - platformSplit}%</span>
                </div>
                <div className="flex justify-between items-center border border-[#111] bg-[#110000] p-4">
                  <span className="text-[10px] font-mono text-[#E60000] uppercase tracking-widest font-bold">Platform Split</span>
                  <span className="text-xl font-oswald text-[#E60000] font-bold">{platformSplit}%</span>
                </div>
              </div>

              <button 
                onClick={handleAcceptDeal}
                className="w-full bg-[#E60000] text-white py-5 font-oswald text-lg font-bold uppercase tracking-[0.2em] hover:bg-red-700 transition-all flex items-center justify-center gap-3"
              >
                Sign 360 Deal & Broadcast <Lock size={18} />
              </button>
            </div>

            {/* LEGAL / LORE DISCLAIMER */}
            <div className="bg-[#050505] border border-[#222] p-8 flex flex-col justify-between">
              <div>
                <h4 className="font-oswald text-lg uppercase tracking-widest font-bold text-[#555] mb-6 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-yellow-600" /> Media & Sync Terms
                </h4>
                
                <div className="space-y-4 font-mono text-[10px] text-[#888] uppercase leading-relaxed tracking-widest">
                  <p className="flex gap-3">
                    <span className="text-[#E60000] shrink-0">[SEC. 1]</span> 
                    BROADCAST: Your track will be immediately queued on the GetNice Nation 24/7 global FM stream (YouTube/Twitch).
                  </p>
                  <p className="flex gap-3">
                    <span className="text-[#E60000] shrink-0">[SEC. 2]</span> 
                    SYNC VAULT: Your track is added to our micro-licensing vault. Content creators pay to use it, generating direct revenue.
                  </p>
                  <p className="flex gap-3">
                    <span className="text-[#E60000] shrink-0">[SEC. 3]</span> 
                    CONTENT ID: We register the audio footprint. Any unauthorized use on TikTok or YouTube automatically redirects ad revenue to you.
                  </p>
                  <p className="flex gap-3">
                    <span className="text-[#E60000] shrink-0">[SEC. 4]</span> 
                    The algorithm retains a {platformSplit}% publishing split. All fiat revenue (USD) accrued is deposited to your ledger for Stripe withdrawal.
                  </p>
                </div>
              </div>
              
              <div className="mt-8 pt-6 border-t border-[#111]">
                 <p className="text-[9px] font-mono text-[#444] uppercase tracking-widest text-center">
                   Legally binding media publishing agreement.
                 </p>
              </div>
            </div>

          </div>
        )}

        {/* DISTRIBUTED STATE */}
        {status === "distributed" && (
          <div className="bg-[#050505] border border-green-500/30 p-16 flex flex-col items-center justify-center text-center rounded-lg relative overflow-hidden animate-in zoom-in duration-500">
            <div className="absolute inset-0 bg-green-500/5 pointer-events-none"></div>
            
            <CheckCircle2 size={80} className="text-green-500 mb-8 shadow-[0_0_30px_rgba(34,197,94,0.3)] rounded-full relative z-10" />
            <h3 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white mb-4 relative z-10">
              Contract Executed
            </h3>
            <p className="font-mono text-xs text-green-500 uppercase tracking-widest mb-10 relative z-10">
              Track secured in the Sync Vault & registered to Content ID.
            </p>

            <button 
              onClick={handleProceed}
              className="relative z-10 flex items-center gap-3 bg-white text-black px-12 py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              Enter Live Radio Broadcast <ArrowRight size={20} />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}