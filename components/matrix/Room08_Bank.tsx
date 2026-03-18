"use client";

import React, { useState, useEffect } from "react";
import { Wallet, TrendingUp, FileText, CheckCircle2, AlertTriangle, ArrowRight, Lock, CreditCard, Loader2, Link as LinkIcon, Radio, Clock, Archive, Download, PlusCircle, Zap, Calendar, X } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function Room08_Bank() {
  const { userSession, setActiveRoom, addToast, clearMatrix } = useMatrixStore();
  
  // Tab State
  const [activeTab, setActiveTab] = useState<"ledger" | "vault">("ledger");

  // Bank State
  const [status, setStatus] = useState<"evaluating" | "deal_ready" | "standard_payout" | "distributed">("evaluating");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [royaltyBalance, setRoyaltyBalance] = useState(userSession?.walletBalance || 0);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [trackScore, setTrackScore] = useState<number>(0);

  // Vault & Rollout State
  const [vaultTracks, setVaultTracks] = useState<any[]>([]);
  const [isLoadingVault, setIsLoadingVault] = useState(false);
  const [isGeneratingRollout, setIsGeneratingRollout] = useState<string | null>(null);
  const [activeRollout, setActiveRollout] = useState<string | null>(null);

  const artistSplit = 60;
  const labelSplit = 40;
  const marketingAdvance = 1000.00;

  useEffect(() => {
    // Check for returning Stripe URLs (Rollouts or Bank Onboarding)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      
      // 1. Returning from an Exec Rollout purchase
      if (params.get('rollout_purchased') === 'true') {
        const trackId = params.get('track_id');
        if (trackId) {
          window.history.replaceState({}, document.title, window.location.pathname);
          setActiveTab("vault");
          generateExecRollout(trackId);
        }
      }

      // 2. Returning from Linking a Bank Account
      if (params.get('connect') === 'success') {
        window.history.replaceState({}, document.title, window.location.pathname);
        if (addToast) addToast("Stripe Account Linked! You may now withdraw funds.", "success");
        setNeedsOnboarding(false);
      }
    }
  }, [userSession]); 

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
          if (data.hit_score === 100) setStatus("deal_ready");
          else setStatus("standard_payout");
        }, 3000);
      } catch (err) {
        console.error("Ledger Evaluation Error:", err);
        setStatus("standard_payout");
      }
    };
    if (activeTab === "ledger") evaluateLedger();
  }, [userSession, activeTab]);

  useEffect(() => {
    const fetchVault = async () => {
      setIsLoadingVault(true);
      try {
        const { data, error } = await supabase
          .from('submissions')
          .select('*')
          .eq('user_id', userSession?.id)
          .order('created_at', { ascending: false });
        if (!error && data) setVaultTracks(data);
      } catch (err) {
        console.error("Vault fetch error:", err);
      } finally {
        setIsLoadingVault(false);
      }
    };
    if (activeTab === "vault") fetchVault();
  }, [userSession, activeTab]);

  // --- EXEC ROLLOUT LOGIC ---
  const handlePurchaseRollout = async (track: any) => {
    setIsGeneratingRollout(track.id);
    try {
      const res = await fetch('/api/stripe/rollout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.id, trackTitle: track.title, userId: userSession?.id })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error);
    } catch(err: any) {
      if(addToast) addToast("Checkout failed: " + err.message, "error");
      setIsGeneratingRollout(null);
    }
  };

  const generateExecRollout = async (trackId: string) => {
     setIsGeneratingRollout(trackId);
     if(addToast) addToast("Payment verified. Generating 30-Day Exec Rollout...", "info");
     try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/distribution/rollout', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
           body: JSON.stringify({ trackId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setVaultTracks(prev => prev.map(t => t.id === trackId ? { ...t, exec_rollout: data.rollout } : t));
        setActiveRollout(data.rollout);
        if(addToast) addToast("Exec Rollout Strategy Generated.", "success");
     } catch(err: any) {
        if(addToast) addToast(err.message, "error");
     } finally {
        setIsGeneratingRollout(null);
     }
  };
  // -------------------------

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

  const handleInitializeNewTrack = () => {
    if(confirm("This will wipe the current session Matrix. Are you sure?")) {
      clearMatrix();
      setActiveRoom("01");
    }
  };

  return (
    <div className="h-full flex flex-col p-8 lg:p-12 animate-in fade-in duration-500 overflow-y-auto custom-scrollbar relative">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-6">
        <div>
          <h2 className="font-oswald text-4xl uppercase tracking-widest font-bold text-[#E60000] flex items-center gap-4">
            <Wallet size={36} /> Bank & Vault
          </h2>
          <p className="text-[10px] text-[#555] uppercase tracking-[0.3em] mt-2 font-mono">
            Royalty Ledger // Permanent Artifact Storage
          </p>
        </div>
        
        <button 
          onClick={handleInitializeNewTrack}
          className="flex items-center gap-2 bg-[#E60000] text-white px-6 py-3 font-oswald text-sm font-bold uppercase tracking-widest hover:bg-red-700 transition-colors shadow-[0_0_15px_rgba(230,0,0,0.4)]"
        >
          <PlusCircle size={16} /> Initialize New Record
        </button>
      </div>

      {/* TABS */}
      <div className="flex gap-6 border-b border-[#222] mb-10">
        <button 
          onClick={() => setActiveTab("ledger")} 
          className={`pb-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'ledger' ? 'border-[#E60000] text-[#E60000]' : 'border-transparent text-[#555] hover:text-white'}`}
        >
          Royalty Ledger & Offers
        </button>
        <button 
          onClick={() => setActiveTab("vault")} 
          className={`pb-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${activeTab === 'vault' ? 'border-[#E60000] text-[#E60000]' : 'border-transparent text-[#555] hover:text-white'}`}
        >
          <Archive size={14} /> The Vault
        </button>
      </div>

      <div className="max-w-6xl mx-auto w-full">
        
        {/* TAB 1: THE BANK (STRIPE LOGIC) */}
        {activeTab === "ledger" && (
          <div className="animate-in fade-in">
            <div className="bg-[#050505] border border-[#222] p-4 flex items-center justify-between gap-6 rounded mb-8 max-w-sm ml-auto">
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

            {status === "evaluating" && (
              <div className="bg-[#050505] border border-[#222] p-16 flex flex-col items-center justify-center text-center rounded-lg h-[400px]">
                <TrendingUp size={64} className="text-[#E60000] animate-pulse mb-8" />
                <h3 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white mb-4">Auditing Track Value</h3>
                <p className="font-mono text-xs text-[#888] uppercase tracking-widest">Querying Ledger for Perfect Hit Score (100)...</p>
              </div>
            )}

            {status === "standard_payout" && (
              <div className="bg-[#050505] border border-[#222] p-16 flex flex-col items-center justify-center text-center rounded-lg h-[400px] animate-in zoom-in">
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
        )}

        {/* TAB 2: THE VAULT & EXEC ROLLOUTS */}
        {activeTab === "vault" && (
          <div className="animate-in fade-in">
            {isLoadingVault ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-50">
                <Loader2 size={48} className="animate-spin text-[#E60000] mb-4" />
                <p className="font-mono text-[10px] uppercase tracking-widest">Decrypting Vault...</p>
              </div>
            ) : vaultTracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-[#222] bg-[#050505]">
                <Archive size={48} className="text-[#333] mb-4" />
                <p className="font-oswald text-xl uppercase tracking-widest text-[#555]">Vault Empty</p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#444] mt-2">You have not finalized any master tracks yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vaultTracks.map((track) => (
                  <div key={track.id} className="bg-black border border-[#222] hover:border-[#E60000] transition-colors group flex flex-col h-full">
                    <div className="aspect-square bg-[#111] w-full relative overflow-hidden shrink-0">
                      {track.cover_url ? (
                        <img src={track.cover_url} alt="Cover" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center opacity-10"><Archive size={64} /></div>
                      )}
                      <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm border border-[#333] px-2 py-1 text-[9px] font-mono text-white font-bold uppercase">
                        Score: {track.hit_score}
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-oswald text-lg uppercase tracking-widest text-white truncate mb-1" title={track.title}>{track.title}</h3>
                        <p className="font-mono text-[9px] text-[#555] uppercase tracking-widest mb-6">
                          {new Date(track.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      
                      {/* ACTION BUTTONS */}
                      <div className="flex flex-col gap-2 mt-auto">
                        <a 
                          href={track.audio_url} 
                          download
                          target="_blank" rel="noreferrer"
                          className="w-full flex items-center justify-center gap-2 bg-[#111] border border-[#222] text-white py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-[#222] transition-colors"
                        >
                          <Download size={14} /> Download Master
                        </a>

                        {/* EXEC ROLLOUT UPSELL / DISPLAY */}
                        {track.exec_rollout ? (
                          <button 
                            onClick={() => setActiveRollout(track.exec_rollout)}
                            className="w-full flex items-center justify-center gap-2 bg-[#E60000] text-white py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-red-700 transition-colors shadow-[0_0_15px_rgba(230,0,0,0.3)]"
                          >
                            <Calendar size={14} /> View Exec Rollout
                          </button>
                        ) : (
                          <button 
                            onClick={() => handlePurchaseRollout(track)} 
                            disabled={isGeneratingRollout === track.id}
                            className="w-full flex items-center justify-center gap-2 bg-black border border-[#333] text-yellow-500 py-3 text-[10px] font-bold uppercase tracking-widest hover:border-yellow-500 transition-colors disabled:opacity-50"
                          >
                            {isGeneratingRollout === track.id ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />} 
                            Acquire Rollout ($14.99)
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* EXEC ROLLOUT MODAL */}
      {activeRollout && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300">
           <div className="bg-[#050505] border border-[#E60000] w-full max-w-4xl h-full md:max-h-[85vh] flex flex-col relative shadow-[0_0_50px_rgba(230,0,0,0.3)]">
              <button 
                onClick={() => setActiveRollout(null)} 
                className="absolute top-6 right-6 text-[#888] hover:text-white transition-colors z-10"
              >
                <X size={28} />
              </button>
              
              <div className="p-8 border-b border-[#222] bg-[#0a0a0a] shrink-0">
                <h2 className="font-oswald text-3xl uppercase tracking-widest font-bold text-[#E60000] flex items-center gap-3">
                  <Calendar size={28} /> Exec Rollout Strategy
                </h2>
                <p className="font-mono text-[10px] text-[#888] uppercase tracking-[0.3em] mt-2">
                  30-Day Omnichannel Deployment Calendar
                </p>
              </div>
              
              <div className="p-8 overflow-y-auto custom-scrollbar font-mono text-sm text-gray-300 leading-loose whitespace-pre-wrap">
                {activeRollout}
              </div>
              
              <div className="p-6 border-t border-[#222] bg-black shrink-0 flex justify-between items-center">
                 <span className="text-[10px] text-green-500 font-mono uppercase tracking-widest flex items-center gap-2">
                   <CheckCircle2 size={14}/> Saved permanently to Vault
                 </span>
                 <button 
                   onClick={() => setActiveRollout(null)} 
                   className="bg-white text-black px-8 py-3 font-oswald uppercase tracking-widest text-xs font-bold hover:bg-[#E60000] hover:text-white transition-colors"
                 >
                   Close Terminal
                 </button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}