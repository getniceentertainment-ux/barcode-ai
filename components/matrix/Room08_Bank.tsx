"use client";

import React, { useState, useEffect } from "react";
import { ShieldAlert, FileSignature, CheckCircle2, Lock, Unlock, DollarSign, ArrowRight, Activity, Zap, ExternalLink, Loader2 } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function Room08_Bank() {
  const { userSession, addToast, setActiveRoom } = useMatrixStore();
  
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isSigning, setIsSigning] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  useEffect(() => {
    fetchVaultData();
  }, [userSession]);

  const fetchVaultData = async () => {
    if (!userSession?.id) return;
    setLoading(true);
    try {
      // 1. Fetch latest artifact to check Hit Score
      const { data: subData } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', userSession.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subData) setSubmission(subData);

      // 2. Fetch Wallet Balance
      const { data: profile } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', userSession.id)
        .single();
        
      if (profile) setWalletBalance(profile.wallet_balance || 0);

    } catch (err) {
      console.error("Vault Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignDeal = async () => {
    if (!submission || submission.hit_score < 90) return;
    setIsSigning(true);
    
    try {
      // Mark as signed in Submissions
      const { error: subErr } = await supabase
        .from('submissions')
        .update({ upstream_deal_signed: true })
        .eq('id', submission.id);

      if (subErr) throw subErr;

      // Flag profile as GetNice Partner & Deposit $1500 Marketing Advance
      const { data: currentProfile } = await supabase.from('profiles').select('marketing_credits').eq('id', userSession?.id).single();
      const currentCredits = currentProfile?.marketing_credits || 0;

      await supabase
        .from('profiles')
        .update({ 
          getnice_signed: true,
          marketing_credits: currentCredits + 1500 
        })
        .eq('id', userSession?.id);

      // Create ledger receipt
      await supabase.from('transactions').insert({
        user_id: userSession?.id,
        amount: 1500,
        type: 'ADVANCE_DEPOSIT',
        description: 'GetNice Records $1,500 Automated Marketing Advance'
      });

      if (addToast) addToast("Upstream Deal Executed. Welcome to GetNice Records.", "success");
      setSubmission({ ...submission, upstream_deal_signed: true });
      
    } catch (err: any) {
      if (addToast) addToast("Contract Execution Failed: " + err.message, "error");
    } finally {
      setIsSigning(false);
    }
  };

  const handleWithdraw = async () => {
    setIsWithdrawing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/stripe/withdraw', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url; // Redirect to Stripe Express Dashboard
      } else {
        throw new Error(data.error || "Failed to route to financial processor.");
      }
    } catch (err: any) {
      if (addToast) addToast(err.message, "error");
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-[#E60000]" size={48} /></div>;

  const hitScore = submission?.hit_score || 0;
  const isEligible = hitScore >= 90;
  const isSigned = submission?.upstream_deal_signed;

  return (
    <div className="h-full flex flex-col md:flex-row bg-[#050505] animate-in fade-in duration-500 overflow-hidden border border-[#222]">
      
      {/* LEFT: FINANCIAL LEDGER & WITHDRAWALS */}
      <div className="w-full md:w-1/3 border-r border-[#222] bg-black p-8 flex flex-col justify-between shrink-0">
        <div>
          <h2 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-8 flex items-center gap-3">
             <ShieldAlert className="text-[#E60000]" /> Node Wallet
          </h2>
          
          <div className="bg-[#111] border border-[#333] p-6 text-center mb-6 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-t from-green-500/5 to-transparent pointer-events-none" />
            <p className="text-[10px] font-mono text-[#888] uppercase tracking-widest mb-2 font-bold">Available Fiat Balance</p>
            <p className="text-4xl font-oswald font-bold text-green-500 tracking-tighter">
              ${walletBalance.toFixed(2)}
            </p>
          </div>

          <button 
            onClick={handleWithdraw}
            disabled={isWithdrawing}
            className="w-full flex items-center justify-center gap-3 bg-[#E60000] text-white py-4 font-oswald text-sm font-bold uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50"
          >
            {isWithdrawing ? <Loader2 size={16} className="animate-spin" /> : <DollarSign size={16} />} 
            Withdraw via Stripe Connect
          </button>
          <p className="font-mono text-[8px] text-[#555] uppercase tracking-widest text-center mt-4">
            Routes fiat liquidity to external bank accounts via Stripe secure tunnel.
          </p>
        </div>

        <div className="mt-8 border-t border-[#222] pt-6">
          <p className="text-[9px] font-mono text-[#888] uppercase tracking-widest mb-4">Ledger Status</p>
          <div className="space-y-3">
             <div className="flex justify-between items-center bg-[#0a0a0a] border border-[#222] p-3 text-[10px] font-mono uppercase text-[#555]">
               <span>Matrix Routing</span> <span className="text-green-500">Active</span>
             </div>
             <div className="flex justify-between items-center bg-[#0a0a0a] border border-[#222] p-3 text-[10px] font-mono uppercase text-[#555]">
               <span>Escrow Locks</span> <span className="text-white">Cleared</span>
             </div>
          </div>
        </div>
      </div>

      {/* RIGHT: THE 90+ UPSTREAM GATEWAY */}
      <div className="flex-1 bg-[#020202] p-8 lg:p-12 overflow-y-auto custom-scrollbar flex flex-col">
        {!submission ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
             <Lock size={64} className="mb-6 text-[#555]" />
             <h3 className="font-oswald text-3xl uppercase tracking-widest text-white mb-2">Vault Locked</h3>
             <p className="font-mono text-[10px] text-[#888] uppercase tracking-widest">Process an artifact through R07 Distribution to unlock.</p>
          </div>
        ) : !isEligible ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center max-w-lg mx-auto animate-in zoom-in-95">
             <div className="w-32 h-32 rounded-full border border-[#E60000]/30 bg-[#110000] flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(230,0,0,0.2)]">
               <Activity size={48} className="text-[#E60000]" />
             </div>
             <h3 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white mb-4">Access Denied</h3>
             
             <div className="bg-black border border-[#333] p-6 w-full mb-6">
               <div className="flex justify-between items-center mb-2">
                 <span className="font-mono text-[10px] text-[#888] uppercase tracking-widest">Your Hit Score</span>
                 <span className="font-oswald text-2xl text-[#E60000] font-bold">{hitScore}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="font-mono text-[10px] text-[#888] uppercase tracking-widest">Required Score</span>
                 <span className="font-oswald text-2xl text-white font-bold">90</span>
               </div>
             </div>
             
             <p className="font-mono text-[10px] text-[#888] uppercase tracking-widest leading-relaxed mb-8">
               Your latest artifact failed to meet the rigorous A&R standards for an Upstream Deal. The algorithm requires optimal BPM, pattern interrupts, and highly complex syllable density. 
             </p>
             <button 
               onClick={() => setActiveRoom("07")}
               className="bg-[#111] border border-[#333] text-white px-8 py-4 font-oswald text-sm font-bold uppercase tracking-widest hover:border-white transition-all w-full flex items-center justify-center gap-2"
             >
               Return to Distribution <ArrowRight size={16} />
             </button>
          </div>
        ) : isSigned ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center max-w-lg mx-auto animate-in zoom-in-95">
             <CheckCircle2 size={64} className="text-green-500 mb-6 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full" />
             <h3 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white mb-2">Deal Executed</h3>
             <p className="font-mono text-[10px] text-green-500 uppercase tracking-widest mb-8">GetNice Records Upstream Partner</p>
             
             <div className="bg-[#111] border border-[#222] p-6 w-full mb-8 text-left space-y-4">
               <p className="text-xs font-mono text-[#888] uppercase tracking-widest flex items-center gap-2"><Zap size={14} className="text-yellow-500"/> $1,500 Advance Deposited to Ad Vault</p>
               <p className="text-xs font-mono text-[#888] uppercase tracking-widest flex items-center gap-2"><Zap size={14} className="text-yellow-500"/> Profile Elevated to Label Roster</p>
             </div>

             <button 
               onClick={() => setActiveRoom("11")}
               className="bg-[#E60000] text-white px-8 py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all w-full flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(230,0,0,0.3)]"
             >
               Enter The Exec Campaign Hub <ArrowRight size={20} />
             </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col max-w-2xl mx-auto animate-in fade-in w-full">
            <div className="flex items-center gap-3 mb-8 border-b border-[#222] pb-6">
              <Unlock size={24} className="text-green-500" />
              <h3 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white">Upstream Deal Unlocked</h3>
            </div>

            <div className="bg-black border border-[#333] p-8 mb-8 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#E60000]" />
              <p className="font-mono text-[10px] text-[#E60000] uppercase tracking-widest font-bold mb-6">Smart Contract // Terms of Agreement</p>
              
              <div className="space-y-6 font-mono text-xs text-gray-300 leading-relaxed uppercase tracking-widest">
                <p>1. <span className="text-white font-bold">The Advance:</span> GetNice Records will deposit $1,500 in non-recoupable marketing credits to your Matrix Node.</p>
                <p>2. <span className="text-white font-bold">The Execution:</span> The Exec AI will instantly seize control of your campaign, deploying automated Ad Spend, TikTok renders, and Fan CRM blasts over a strict 30-Day period.</p>
                <p>3. <span className="text-white font-bold">The Prestige:</span> Your public profile will be permanently elevated to "GetNice Records Partner," granting priority ranking in the Network Syndicate.</p>
              </div>

              <div className="mt-8 bg-[#110000] border border-[#330000] p-4 flex items-start gap-3">
                <ShieldAlert size={16} className="text-[#E60000] shrink-0 mt-0.5" />
                <p className="text-[9px] text-[#E60000] uppercase font-bold tracking-widest">
                  Warning: By signing this agreement, you authorize the Neural Network to execute marketing actions on your behalf. This action is irreversible.
                </p>
              </div>
            </div>

            <button 
               onClick={handleSignDeal}
               disabled={isSigning}
               className="w-full bg-white text-black py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all flex items-center justify-center gap-3 disabled:opacity-50"
             >
               {isSigning ? <Loader2 size={24} className="animate-spin" /> : <><FileSignature size={24} /> Execute $1,500 Upstream Deal</>}
             </button>
          </div>
        )}
      </div>
    </div>
  );
}