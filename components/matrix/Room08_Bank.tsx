"use client";

import React, { useState, useEffect } from "react";
import { Wallet, TrendingUp, FileText, CheckCircle2, Lock, Loader2, Database, Download, ExternalLink, History } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

interface MasteredArtifact {
  id: string;
  title: string;
  audio_url: string;
  hit_score: number;
  created_at: string;
  status: string;
}

export default function Room08_Bank() {
  const { userSession, addToast } = useMatrixStore();
  
  const [view, setView] = useState<"bank" | "vault">("bank");
  const [status, setStatus] = useState<"evaluating" | "deal_ready" | "distributed" | "no_deal">("evaluating");
  const [walletBalance, setWalletBalance] = useState(0);
  const [artifacts, setArtifacts] = useState<MasteredArtifact[]>([]);
  const [isLoadingVault, setIsLoadingVault] = useState(false);
  const [stripeConnectId, setStripeConnectId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (userSession?.id) {
      syncLedger();
      fetchVault();
    }
  }, [userSession]);

  const syncLedger = async () => {
    try {
      const { data: profile } = await supabase.from('profiles').select('wallet_balance, stripe_connect_id').eq('id', userSession?.id).single();
      if (profile) {
        setWalletBalance(Number(profile.wallet_balance));
        setStripeConnectId(profile.stripe_connect_id);
      }

      const { data: submissions } = await supabase.from('submissions').select('hit_score').eq('user_id', userSession?.id).order('created_at', { ascending: false }).limit(1);
      if (submissions && submissions.length > 0 && submissions[0].hit_score >= 80) {
        setStatus("deal_ready");
      } else {
        setStatus("no_deal");
      }
    } catch (err) { 
      console.error(err); 
    }
  };

  const handleBankAction = async () => {
    if (!userSession) return;
    setIsProcessing(true);

    try {
      if (!stripeConnectId) {
        // Route to Stripe Onboarding
        const res = await fetch('/api/stripe/connect', { method: 'POST', body: JSON.stringify({ userId: userSession.id }) });
        const data = await res.json();
        if (data.url) window.location.href = data.url;
        else throw new Error(data.error);
      } else {
        // Trigger Real Payout
        if (walletBalance <= 0) {
           if(addToast) addToast("Wallet is empty.", "error");
           setIsProcessing(false);
           return;
        }
        const res = await fetch('/api/stripe/transfer', { method: 'POST', body: JSON.stringify({ userId: userSession.id, amount: walletBalance }) });
        const data = await res.json();
        if (data.success) {
           setWalletBalance(0);
           if(addToast) addToast("Funds securely routed to your connected bank account.", "success");
        } else {
           throw new Error(data.error);
        }
      }
    } catch (err: any) {
      if(addToast) addToast(err.message || "Financial transaction failed.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAcceptDeal = async () => {
    // Add advance to wallet balance
    const newBalance = walletBalance + 1000;
    setWalletBalance(newBalance);
    
    // Update Ledger silently
    if (userSession?.id) {
       await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', userSession.id);
    }
    
    setStatus("distributed");
    if(addToast) addToast("Advance Contract Executed.", "success");
  };

  const fetchVault = async () => {
    setIsLoadingVault(true);
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', userSession?.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setArtifacts(data || []);
    } catch (err) { 
      console.error("Vault Error:", err); 
    } finally { 
      setIsLoadingVault(false); 
    }
  };

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500 overflow-hidden">
      
      {/* TABS HEADER */}
      <div className="flex gap-4 mb-8 border-b border-[#222] pb-6 px-8 lg:px-12 mt-8 shrink-0">
        <button 
          onClick={() => setView("bank")}
          className={`flex items-center gap-3 px-6 py-3 font-oswald uppercase tracking-widest text-sm font-bold border transition-all
            ${view === 'bank' ? 'bg-[#E60000] border-[#E60000] text-white shadow-[0_0_20px_rgba(230,0,0,0.2)]' : 'bg-black border-[#222] text-[#555] hover:border-white hover:text-white'}`}
        >
          <Wallet size={18} /> The Bank
        </button>
        <button 
          onClick={() => setView("vault")}
          className={`flex items-center gap-3 px-6 py-3 font-oswald uppercase tracking-widest text-sm font-bold border transition-all
            ${view === 'vault' ? 'bg-[#E60000] border-[#E60000] text-white shadow-[0_0_20px_rgba(230,0,0,0.2)]' : 'bg-black border-[#222] text-[#555] hover:border-white hover:text-white'}`}
        >
          <Database size={18} /> The Vault
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-8 lg:px-12 pb-12">
        
        {/* VIEW 1: THE BANK */}
        {view === "bank" && (
          <div className="max-w-5xl mx-auto w-full space-y-8 animate-in slide-in-from-left-4">
             
             {/* THE BANK LEDGER UI */}
             <div className="bg-[#050505] border border-[#222] p-8 flex flex-col md:flex-row items-start md:items-center justify-between rounded shadow-lg gap-6">
                <div>
                  <p className="text-[10px] text-[#888] uppercase tracking-widest font-bold mb-1">Available Royalties (Fiat)</p>
                  <p className="font-oswald text-4xl font-bold text-white tracking-widest">${walletBalance.toFixed(2)}</p>
                </div>
                <button 
                  onClick={handleBankAction}
                  disabled={isProcessing}
                  className="bg-white text-black px-8 py-4 font-bold uppercase tracking-widest text-xs hover:bg-[#E60000] hover:text-white transition-all disabled:opacity-50 flex items-center gap-3"
                >
                  {isProcessing && <Loader2 size={16} className="animate-spin" />}
                  {!stripeConnectId ? "Link Bank Account" : "Request Payout"}
                </button>
             </div>
             
             {/* ALGORITHMIC OFFER LOGIC */}
             {status === "deal_ready" && (
                <div className="bg-black border-2 border-[#E60000] p-8 relative animate-in slide-in-from-bottom-4 shadow-[0_0_30px_rgba(230,0,0,0.1)] group">
                   <div className="absolute top-0 right-0 bg-[#E60000] text-white text-[9px] uppercase font-bold tracking-widest px-3 py-1 animate-pulse">
                     Upstream Offer
                   </div>
                   <FileText size={32} className="text-[#E60000] mb-6" />
                   <h3 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white mb-2 underline decoration-[#E60000]">Contract Detected</h3>
                   <p className="font-mono text-xs text-[#888] mb-6">Your latest Hit Score (80+) qualified you for a $1,000 marketing advance.</p>
                   <button 
                     onClick={handleAcceptDeal} 
                     className="bg-[#E60000] text-white px-10 py-4 font-oswald font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex items-center gap-3"
                   >
                     Execute Contract <Lock size={16} />
                   </button>
                </div>
             )}

             {status === "distributed" && (
               <div className="bg-[#050505] border border-green-500/30 p-10 flex flex-col items-center text-center rounded-lg relative overflow-hidden animate-in zoom-in duration-500">
                 <CheckCircle2 size={48} className="text-green-500 mb-4" />
                 <h3 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-2">Contract Executed</h3>
                 <p className="font-mono text-[10px] text-[#888] uppercase tracking-widest">Marketing advance deposited into wallet ledger.</p>
               </div>
             )}

             {(status === "evaluating" || status === "no_deal") && (
               <div className="bg-[#050505] border border-[#222] p-10 flex flex-col items-center text-center">
                 <TrendingUp size={32} className="text-[#333] mb-4" />
                 <p className="font-mono text-[10px] text-[#555] uppercase tracking-widest">Awaiting high-scoring tracks to unlock algorithmic advances.</p>
               </div>
             )}
          </div>
        )}

        {/* VIEW 2: THE VAULT */}
        {view === "vault" && (
          <div className="max-w-5xl mx-auto w-full animate-in slide-in-from-right-4">
            <div className="flex justify-between items-center mb-8 border-b border-[#222] pb-4">
               <h3 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white flex items-center gap-3">
                 <History size={24} className="text-[#E60000]" /> Master Artifacts
               </h3>
               <span className="text-[10px] font-mono text-[#555] uppercase tracking-widest">{artifacts.length} Total Masters</span>
            </div>

            {isLoadingVault ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-30">
                <Loader2 size={48} className="animate-spin text-[#E60000] mb-4" />
                <p className="font-mono text-xs uppercase tracking-widest">Accessing Secure Archive...</p>
              </div>
            ) : artifacts.length === 0 ? (
              <div className="border border-dashed border-[#222] py-20 text-center bg-[#050505]">
                <FileText size={48} className="mx-auto text-[#222] mb-4" />
                <p className="font-oswald text-xl text-[#444] uppercase tracking-widest">Vault is Empty</p>
                <p className="text-[10px] font-mono text-[#333] uppercase mt-2">Master your first track in Room 06 to see it here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {artifacts.map((art) => (
                  <div key={art.id} className="bg-black border border-[#222] p-6 flex flex-col md:flex-row items-center justify-between gap-6 group hover:border-[#E60000]/50 transition-all">
                    <div className="flex items-center gap-6">
                      <div className={`w-12 h-12 flex items-center justify-center font-oswald text-xl font-bold rounded-sm shrink-0
                        ${art.hit_score >= 80 ? 'bg-green-500/10 text-green-500 border border-green-500/30' : 'bg-[#111] text-[#888] border border-[#222]'}`}>
                        {art.hit_score}
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="font-oswald text-xl uppercase tracking-widest text-white truncate">{art.title}</h4>
                        <p className="text-[9px] font-mono text-[#555] uppercase mt-1 tracking-widest">
                          Secured: {new Date(art.created_at).toLocaleDateString()} // Status: <span className={art.status === 'approved' ? 'text-green-500' : 'text-white'}>{art.status}</span>
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                       <a 
                         href={art.audio_url} target="_blank" rel="noreferrer"
                         className="p-3 bg-[#111] border border-[#333] text-[#888] hover:text-white hover:border-white transition-all rounded"
                         title="Stream Master"
                       >
                         <ExternalLink size={18} />
                       </a>
                       <button className="flex items-center gap-2 bg-white text-black px-6 py-3 font-oswald text-[10px] font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all">
                         <Download size={14} /> Download WAV
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}