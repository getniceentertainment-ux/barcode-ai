"use client";

import React, { useState, useEffect } from "react";
import { Wallet, TrendingUp, FileText, CheckCircle2, AlertTriangle, ArrowRight, Lock, CreditCard, Loader2, Link as LinkIcon, Radio, Clock } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function Room08_Bank() {
  const { userSession, setActiveRoom, addToast } = useMatrixStore();
  
  const [status, setStatus] = useState<"evaluating" | "deal_ready" | "standard_payout" | "distributed">("evaluating");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [royaltyBalance, setRoyaltyBalance] = useState(userSession?.walletBalance || 0);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  
  // NEW: Store the actual score so the UI tells the truth
  const [trackScore, setTrackScore] = useState<number>(0);

  const artistSplit = 60;
  const labelSplit = 40;
  const marketingAdvance = 1000.00;

  useEffect(() => {
    const evaluateLedger = async () => {
      if (!userSession?.id) return;
      try {
        const { data, error } = await supabase
          .from('submissions')
          .select('hit_score')
          .eq('user_id', userSession.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error) throw error;

        setTrackScore(data.hit_score);

        setTimeout(() => {
          if (data.hit_score === 100) {
            setStatus("deal_ready");
          } else {
            setStatus("standard_payout");
          }
        }, 3000);

      } catch (err) {
        console.error("Ledger Evaluation Error:", err);
        setStatus("standard_payout");
      }
    };

    evaluateLedger();
  }, [userSession]);

  const handleAcceptDeal = () => setStatus("distributed");

  const handleWithdraw = async () => {
    if (royaltyBalance <= 0 || !userSession?.id) return;
    setIsWithdrawing(true);
    try {
      const res = await fetch('/api/stripe/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userSession.id, amount: royaltyBalance })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "Stripe Connect account not linked.") {
           setNeedsOnboarding(true);
           throw new Error("You must connect a bank account to receive fiat payouts.");
        }
        throw new Error(data.error || "Transfer failed");
      }
      setRoyaltyBalance(0);
      if(addToast) addToast("Funds successfully routed to your connected bank account.", "success");
    } catch (err: any) {
      if(addToast) addToast(err.message, "error");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleStripeOnboarding = async () => {
    if (!userSession?.id) return;
    setIsWithdrawing(true);
    try {
      const res = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userSession.id })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error("Failed to generate secure Stripe link.");
    } catch (err: any) {
      if(addToast) addToast(err.message, "error");
      setIsWithdrawing(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-8 lg:p-12 animate-in fade-in duration-500 overflow-y-auto custom-scrollbar">
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
          
          {needsOnboarding ? (
            <button onClick={handleStripeOnboarding} disabled={isWithdrawing} className="bg-[#635BFF] text-white px-4 py-3 font-bold uppercase tracking-widest text-[10px] hover:bg-[#5249eb] transition-all disabled:opacity-30 flex items-center gap-2">
              {isWithdrawing ? <Loader2 size={14} className="animate-spin" /> : <LinkIcon size={14} />} Link Bank
            </button>
          ) : (
            <button onClick={handleWithdraw} disabled={royaltyBalance <= 0 || isWithdrawing} className="bg-white text-black px-4 py-3 font-bold uppercase tracking-widest text-[10px] hover:bg-[#E60000] hover:text-white transition-all disabled:opacity-30 flex items-center gap-2">
              {isWithdrawing ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />} Withdraw
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full">
        {status === "evaluating" && (
          <div className="bg-[#050505] border border-[#222] p-16 flex flex-col items-center justify-center text-center rounded-lg h-[400px]">
            <TrendingUp size={64} className="text-[#E60000] animate-pulse mb-8" />
            <h3 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white mb-4">Auditing Track Value</h3>
            <p className="font-mono text-xs text-[#888] uppercase tracking-widest">Querying Ledger for Perfect Hit Score (100)...</p>
          </div>
        )}

        {status === "standard_payout" && (
          <div className="bg-[#050505] border border-[#222] p-16 flex flex-col items-center justify-center text-center rounded-lg h-[400px] animate-in zoom-in">
            {/* THE FIX: Dynamic UI based on score */}
            {trackScore >= 95 ? (
              <>
                <Radio size={64} className="text-green-500 mb-8 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full" />
                <h3 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white mb-2">Standard Distribution</h3>
                <p className="font-mono text-[10px] text-[#888] uppercase tracking-widest mb-8 max-w-sm text-center">
                  Track <span className="text-green-500 font-bold">Auto-Approved</span> to Global Streaming Radio. Royalties will accrue natively in your ledger.
                </p>
              </>
            ) : (
              <>
                <Clock size={64} className="text-[#888] mb-8" />
                <h3 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white mb-2">A&R Review Queued</h3>
                <p className="font-mono text-[10px] text-[#888] uppercase tracking-widest mb-8 max-w-sm text-center">
                  Track scored under 95 and is pending Admin Node clearance. Royalties will activate upon approval.
                </p>
              </>
            )}
            
            <button onClick={() => setActiveRoom("09")} className="bg-white text-black py-4 px-8 font-oswald text-sm font-bold uppercase tracking-[0.2em] hover:bg-[#E60000] hover:text-white transition-all flex items-center justify-center gap-3">
              Enter Live Radio Broadcast <ArrowRight size={16} />
            </button>
          </div>
        )}

        {status === "deal_ready" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-8 duration-700">
            <div className="bg-black border-2 border-yellow-500 p-8 flex flex-col relative shadow-[0_0_40px_rgba(234,179,8,0.15)] group">
              <div className="absolute top-0 right-0 bg-yellow-500 text-black text-[9px] uppercase font-bold tracking-widest px-3 py-1 animate-pulse">Golden Ticket</div>
              <FileText size={32} className="text-yellow-500 mb-6" />
              <h3 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white mb-2 leading-tight">Single-Track Upstream Deal</h3>
              <p className="font-mono text-[10px] text-[#888] uppercase tracking-widest mb-8 border-b border-[#222] pb-6">GetNice Records Algorithmic A&R Division</p>
              
              <div className="my-auto space-y-4 mb-10">
                <div className="flex justify-between items-center border border-[#111] bg-[#0a0a0a] p-4"><span className="text-[10px] font-mono text-[#888] uppercase tracking-widest">Your Royalty Keep</span><span className="text-xl font-oswald text-green-500 font-bold">{artistSplit}%</span></div>
                <div className="flex justify-between items-center border border-[#111] bg-[#110000] p-4"><span className="text-[10px] font-mono text-[#E60000] uppercase tracking-widest font-bold">Label Split</span><span className="text-xl font-oswald text-[#E60000] font-bold">{labelSplit}%</span></div>
                <div className="border border-green-500/30 bg-green-500/5 p-6 mt-6 flex flex-col items-center text-center">
                  <span className="text-[10px] font-mono text-green-500 uppercase tracking-widest mb-1">Locked Marketing Advance</span>
                  <span className="text-4xl font-oswald text-green-500 font-bold">${marketingAdvance.toLocaleString()}</span>
                </div>
              </div>
              <button onClick={handleAcceptDeal} className="w-full bg-yellow-500 text-black py-5 font-oswald text-lg font-bold uppercase tracking-[0.2em] hover:bg-yellow-400 transition-all flex items-center justify-center gap-3">
                Sign Deal & Route Advance <Lock size={18} />
              </button>
            </div>
            
            <div className="bg-[#050505] border border-[#222] p-8 flex flex-col justify-between">
              <div>
                <h4 className="font-oswald text-lg uppercase tracking-widest font-bold text-[#555] mb-6 flex items-center gap-2"><AlertTriangle size={18} className="text-yellow-600" /> Contract Protections</h4>
                <div className="space-y-6 font-mono text-[10px] text-[#888] uppercase leading-relaxed tracking-widest">
                  <p className="flex gap-3"><span className="text-yellow-500 shrink-0 font-bold">[SEC. 1]</span> ZERO RECOUPMENT TRAP: The $1,000 Advance is issued exclusively as "Marketing Credits".</p>
                  <p className="flex gap-3"><span className="text-yellow-500 shrink-0 font-bold">[SEC. 2]</span> NO 360 CLAUSES: GetNice Records claims 0% of your touring, merch, or publishing.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {status === "distributed" && (
          <div className="bg-[#050505] border border-green-500/30 p-16 flex flex-col items-center justify-center text-center rounded-lg relative overflow-hidden animate-in zoom-in">
            <CheckCircle2 size={80} className="text-green-500 mb-8 shadow-[0_0_30px_rgba(34,197,94,0.3)] rounded-full relative z-10" />
            <h3 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white mb-4 relative z-10">Contract Executed</h3>
            <button onClick={() => setActiveRoom("09")} className="relative z-10 flex items-center gap-3 bg-white text-black px-12 py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]">
              Enter Live Radio Broadcast <ArrowRight size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}