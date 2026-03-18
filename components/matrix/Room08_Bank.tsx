"use client";

import React, { useState, useEffect } from "react";
import { Wallet, TrendingUp, FileText, CheckCircle2, AlertTriangle, ArrowRight, Lock, CreditCard, Loader2, Link as LinkIcon, Radio, Clock, Archive, Download, PlusCircle, Zap, Calendar, X, Megaphone, Coins } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function Room08_Bank() {
  const { userSession, setActiveRoom, addToast, clearMatrix } = useMatrixStore();
  const [activeTab, setActiveTab] = useState<"ledger" | "vault">("ledger");
  const [status, setStatus] = useState<"evaluating" | "deal_ready" | "standard_payout" | "distributed">("evaluating");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  
  // DUAL LEDGER STATE
  const [royaltyBalance, setRoyaltyBalance] = useState(0);
  const [marketingCredits, setMarketingCredits] = useState(0);
  
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [trackScore, setTrackScore] = useState<number>(0);
  const [vaultTracks, setVaultTracks] = useState<any[]>([]);
  const [isLoadingVault, setIsLoadingVault] = useState(false);

  const marketingAdvance = 1000.00;

  useEffect(() => {
    fetchLedger();
  }, [userSession]); 

  const fetchLedger = async () => {
    if (!userSession?.id) return;
    const { data } = await supabase.from('profiles').select('wallet_balance, marketing_credits').eq('id', userSession.id).single();
    if (data) { 
       setRoyaltyBalance(Number((data as any).wallet_balance) || 0); 
       setMarketingCredits(Number((data as any).marketing_credits) || 0); 
    }
  };

  useEffect(() => {
    const evaluate = async () => {
      if (!userSession?.id || activeTab !== "ledger") return;
      const { data } = await supabase.from('submissions').select('hit_score').eq('user_id', userSession.id).order('created_at', { ascending: false }).limit(1).single();
      if (data) setTrackScore((data as any).hit_score);
      setTimeout(() => setStatus((data as any)?.hit_score >= 90 ? "deal_ready" : "standard_payout"), 2000);
    };
    evaluate();
  }, [userSession, activeTab]);

  const handleAcceptDeal = async () => {
    const { error } = await supabase.from('profiles').update({ marketing_credits: marketingCredits + marketingAdvance }).eq('id', userSession?.id);
    if (!error) { 
       setMarketingCredits(prev => prev + marketingAdvance); 
       setStatus("distributed"); 
       if(addToast) addToast("Marketing Advance Secured in Matrix Ledger.", "success"); 
    }
  };

  return (
    <div className="h-full flex flex-col p-8 lg:p-12 animate-in fade-in duration-500 overflow-y-auto custom-scrollbar relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-6">
        <div><h2 className="font-oswald text-4xl uppercase font-bold text-[#E60000] flex items-center gap-4"><Wallet size={36} /> Bank & Vault</h2><p className="text-[10px] text-[#555] uppercase mt-2 font-mono tracking-widest">Algorithmic Label Ledger // Stripe Connect</p></div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="bg-[#110000] border border-[#330000] p-4 flex items-center gap-6 rounded shadow-lg">
            <div className="text-right"><p className="text-[9px] text-[#E60000] uppercase tracking-widest font-bold mb-1">Marketing Credits (Locked)</p><p className="font-oswald text-2xl font-bold text-white tracking-widest">${marketingCredits.toFixed(2)}</p></div>
            <Megaphone size={24} className="text-[#E60000] opacity-50" />
          </div>
          <div className="bg-black border border-[#222] p-4 flex items-center gap-6 rounded shadow-xl">
            <div className="text-right"><p className="text-[9px] text-green-500 uppercase tracking-widest font-bold mb-1">Available Royalties (Fiat)</p><p className="font-oswald text-2xl font-bold text-white tracking-widest">${royaltyBalance.toFixed(2)}</p></div>
            <button disabled className="bg-white text-black px-4 py-2 font-bold uppercase tracking-widest text-[9px] hover:bg-[#E60000] hover:text-white transition-all disabled:opacity-30 flex items-center gap-2"><CreditCard size={12} /> Payout</button>
          </div>
        </div>
      </div>

      <div className="flex gap-6 border-b border-[#222] mb-10">
        <button onClick={() => setActiveTab("ledger")} className={`pb-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'ledger' ? 'border-[#E60000] text-[#E60000]' : 'border-transparent text-[#555] hover:text-white'}`}>Ledger & Offers</button>
        <button onClick={() => setActiveTab("vault")} className={`pb-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${activeTab === 'vault' ? 'border-[#E60000] text-[#E60000]' : 'border-transparent text-[#555] hover:text-white'}`}><Archive size={14} /> The Vault</button>
      </div>

      <div className="max-w-6xl mx-auto w-full">
        {activeTab === "ledger" && (
          <div className="animate-in fade-in">
            {status === "evaluating" && <div className="bg-[#050505] border border-[#222] p-16 flex flex-col items-center justify-center text-center h-[300px]"><TrendingUp size={48} className="text-[#E60000] animate-pulse mb-6"/><h3 className="font-oswald text-2xl uppercase font-bold text-white">Auditing Track Value</h3></div>}
            {status === "deal_ready" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-8">
                <div className="bg-black border-2 border-yellow-500 p-8 flex flex-col relative shadow-[0_0_40px_rgba(234,179,8,0.15)] group">
                  <div className="absolute top-0 right-0 bg-yellow-500 text-black text-[9px] uppercase font-bold tracking-widest px-3 py-1">Golden Ticket</div>
                  <FileText size={32} className="text-yellow-500 mb-6" /><h3 className="font-oswald text-3xl uppercase font-bold text-white mb-8">Single-Track Upstream Deal</h3>
                  <div className="space-y-4 mb-10">
                    <div className="flex justify-between border-b border-[#222] pb-2 text-[10px] uppercase font-mono"><span>Label Advance</span> <span className="text-green-500 font-bold">$1,000.00 (Locked)</span></div>
                    <div className="flex justify-between border-b border-[#222] pb-2 text-[10px] uppercase font-mono"><span>Split</span> <span className="text-white">60% Artist / 40% Label</span></div>
                  </div>
                  <button onClick={handleAcceptDeal} className="w-full bg-yellow-500 text-black py-5 font-oswald text-lg font-bold uppercase transition-all flex items-center justify-center gap-3">Sign Deal & Route Advance <Lock size={18} /></button>
                </div>
              </div>
            )}
            {status === "distributed" && <div className="bg-[#050505] border border-green-500/30 p-16 flex flex-col items-center justify-center text-center animate-in zoom-in"><CheckCircle2 size={80} className="text-green-500 mb-8"/><h3 className="font-oswald text-4xl uppercase font-bold text-white mb-8">Artifact Signed</h3><button onClick={() => setActiveRoom("09")} className="bg-white text-black px-12 py-4 font-oswald text-lg font-bold uppercase transition-all flex items-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.2)]">Enter Live Radio <ArrowRight size={20} /></button></div>}
            {status === "standard_payout" && <div className="bg-[#050505] border border-[#222] p-16 flex flex-col items-center justify-center text-center h-[300px]"><Clock size={64} className="text-[#888] mb-8" /><h3 className="font-oswald text-3xl uppercase font-bold text-white mb-2">A&R Review Queued</h3><p className="font-mono text-[10px] text-[#888] uppercase tracking-widest mb-8">Score: {trackScore}/100. Royalties will activate upon Admin Node approval.</p><button onClick={() => setActiveRoom("09")} className="bg-white text-black py-4 px-8 font-oswald text-sm font-bold uppercase transition-all flex items-center gap-3">Enter Radio <ArrowRight size={16} /></button></div>}
          </div>
        )}
      </div>
    </div>
  );
}