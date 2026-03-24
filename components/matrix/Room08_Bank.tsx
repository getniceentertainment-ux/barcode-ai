"use client";

import React, { useState, useEffect } from "react";
import { 
  Wallet, TrendingUp, ShieldCheck, ArrowUpRight, 
  History, DollarSign, Zap, FileText, Lock, 
  ChevronRight, BadgeCheck, Gavel, BarChart3, Loader2, Landmark
} from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function Room08_Bank() {
  const { userSession, addToast, setActiveRoom } = useMatrixStore();
  
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<any>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [contractSigned, setContractSigned] = useState(false);
  const [ledger, setLedger] = useState<any[]>([]);
  
  // --- STATE HOOKS ---
  const [hasConnectedBank, setHasConnectedBank] = useState(false);
  const [isConnectingBank, setIsConnectingBank] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Catch returning Stripe redirects for Bank Onboarding
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('connect') === 'success') {
        window.history.replaceState({}, document.title, window.location.pathname);
        setHasConnectedBank(true);
        if(addToast) addToast("Bank Account Linked Successfully.", "success");
      }
    }
  }, [addToast]);

  useEffect(() => {
    fetchFinancialData();
  }, [userSession]);

  const fetchFinancialData = async () => {
    if (!userSession?.id) return;
    setLoading(true);
    
    try {
      // 1. Check for Stripe Account
      const { data: profileData } = await supabase
        .from('profiles')
        .select('stripe_account_id')
        .eq('id', userSession.id)
        .single();

      if (profileData?.stripe_account_id) {
        setHasConnectedBank(true);
      }

      // 2. Latest Artifact
      const { data: subData } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', userSession.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subData) {
        setSubmission(subData);
        if (subData.upstream_deal_signed) setContractSigned(true);
      }

      // 3. Transactions
      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userSession.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (txData) setLedger(txData);
    } catch (err) {
      console.error("Bank sync error:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- ACTIONS ---
  const handleConnectBank = async () => {
    if (!userSession?.id) return;
    setIsConnectingBank(true);
    try {
      const res = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userSession.id })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url; 
      } else {
        throw new Error(data.error || "Failed to initialize Stripe.");
      }
    } catch (err: any) {
      if(addToast) addToast(err.message, "error");
      setIsConnectingBank(false);
    }
  };

  const handleWithdrawFunds = async () => {
    const balance = userSession?.walletBalance || 0;
    if (balance <= 0) {
      if(addToast) addToast("No fiat funds to withdraw.", "error");
      return;
    }

    if (!window.confirm(`Withdraw $${balance.toFixed(2)} to your bank?`)) return;

    setIsWithdrawing(true);
    try {
      const res = await fetch('/api/stripe/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userSession?.id, amount: balance })
      });
      const data = await res.json();
      if (data.success) {
        if(addToast) addToast("Withdrawal successful!", "success");
        fetchFinancialData();
      } else {
        throw new Error(data.error || "Withdrawal failed.");
      }
    } catch (err: any) {
      if(addToast) addToast(err.message, "error");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleSignDeal = async () => {
    if (!userSession?.id || !submission?.id) return;
    setIsSigning(true);
    try {
      const { error: subErr } = await supabase
        .from('submissions')
        .update({ upstream_deal_signed: true })
        .eq('id', submission.id);

      if (subErr) throw new Error("Contract signing failed.");

      const { data: profile } = await supabase.from('profiles').select('marketing_credits').eq('id', userSession.id).single();
      const currentCredits = profile?.marketing_credits || 0;
      const advanceAmount = 1500.00;

      await supabase.from('profiles').update({ marketing_credits: currentCredits + advanceAmount }).eq('id', userSession.id);
      await supabase.from('transactions').insert({
        user_id: userSession.id,
        amount: advanceAmount,
        type: 'ADVANCE_DEPOSIT',
        description: `Upstream Advance: ${submission.title}`
      });

      setContractSigned(true);
      if(addToast) addToast("Advance Deployed to Wallet.", "success");
      fetchFinancialData();
    } catch (err: any) {
      if(addToast) addToast(err.message, "error");
    } finally {
      setIsSigning(false);
    }
  };

  const isEligibleForDeal = submission && submission.hit_score >= 90;

  return (
    <div className="h-full flex flex-col bg-[#050505] animate-in fade-in duration-500 overflow-hidden border border-[#222]">
      
      <div className="p-8 border-b border-[#111] bg-black flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white flex items-center gap-3">
            <Wallet className="text-[#E60000]" size={28} /> The Bank & Ledger
          </h2>
          <p className="font-mono text-[10px] text-[#555] uppercase tracking-[0.3em] mt-2">
            Node Status: ONLINE
          </p>
        </div>
        
        <div className="flex gap-4">
          <div className="bg-[#0a0a0a] border border-[#222] p-4 min-w-[160px] flex flex-col justify-between">
            <div>
              <p className="text-[8px] font-mono text-[#555] uppercase mb-1 font-bold">Fiat Balance</p>
              <p className="text-2xl font-oswald font-bold text-white">${userSession?.walletBalance?.toFixed(2) || "0.00"}</p>
            </div>
            
            <button 
              onClick={hasConnectedBank ? handleWithdrawFunds : handleConnectBank}
              disabled={isConnectingBank || isWithdrawing}
              className={`mt-3 w-full border text-[9px] font-mono uppercase tracking-widest py-1.5 transition-all flex items-center justify-center gap-2
                ${hasConnectedBank 
                  ? "bg-white text-black border-white hover:bg-[#E60000] hover:text-white" 
                  : "bg-black text-[#888] border-[#333] hover:text-white"}`}
            >
              {(isConnectingBank || isWithdrawing) ? <Loader2 size={10} className="animate-spin" /> : <Landmark size={12} />}
              {hasConnectedBank ? "Withdraw Funds" : "Link Bank"}
            </button>
          </div>

          <div className="bg-[#0a0a0a] border border-[#222] p-4 min-w-[160px] flex flex-col justify-between">
            <div>
              <p className="text-[8px] font-mono text-[#E60000] uppercase mb-1 font-bold">Marketing Credits</p>
              <p className="text-2xl font-oswald font-bold text-[#E60000]">
                ${(userSession as any)?.marketingCredits?.toFixed(2) || "0.00"}
              </p>
            </div>
            <p className="mt-3 text-[8px] font-mono text-[#444] uppercase tracking-widest text-center">Ecosystem Locked</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="w-full lg:w-1/2 border-r border-[#111] flex flex-col bg-[#020202]">
          <div className="p-6 border-b border-[#111] flex justify-between items-center bg-black">
            <h3 className="font-oswald text-sm uppercase tracking-widest text-[#888] flex items-center gap-2">
              <History size={14} /> Transaction History
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar">
            {ledger.map((item) => (
              <div key={item.id} className="flex justify-between items-center p-4 bg-black border border-[#111] hover:border-[#333] transition-colors group">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-full ${item.amount > 0 ? 'bg-green-500/10 text-green-500' : 'bg-[#E60000]/10 text-[#E60000]'}`}>
                    {item.amount > 0 ? <TrendingUp size={14} /> : <DollarSign size={14} />}
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-white uppercase font-bold tracking-widest">{item.description}</p>
                    <p className="text-[8px] font-mono text-[#444] uppercase mt-1">{new Date(item.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className={`font-oswald text-lg font-bold ${item.amount > 0 ? 'text-green-500' : 'text-white'}`}>
                  {item.amount > 0 ? '+' : ''}${Math.abs(item.amount).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-black overflow-y-auto custom-scrollbar">
          <div className="p-8 border-b border-[#111] bg-[#050505]">
            <h3 className="font-oswald text-sm uppercase tracking-widest text-[#E60000] mb-6 flex items-center gap-2">
              <ShieldCheck size={16} /> Active Artifact License
            </h3>
            {submission ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0a0a0a] border border-[#222] p-4 text-center">
                  <span className="text-[8px] font-mono text-[#555] uppercase block mb-1">Royalty Split</span>
                  <p className="text-xl font-oswald font-bold text-white">60% Artist / 40% BC</p>
                </div>
                <div className="bg-[#0a0a0a] border border-[#222] p-4 text-center">
                  <span className="text-[8px] font-mono text-[#555] uppercase block mb-1">A&R Score</span>
                  <p className={`text-xl font-oswald font-bold ${submission.hit_score >= 85 ? 'text-green-500' : 'text-[#E60000]'}`}>
                    {submission.hit_score}/100
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center opacity-30 font-mono text-[10px] uppercase">No artifacts found.</div>
            )}
          </div>

          {isEligibleForDeal && !contractSigned && (
            <div className="p-8 bg-[#110000] border-b border-[#E60000]/30 animate-in zoom-in duration-700">
               <h3 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-4">Upstream Deal Offered</h3>
               <p className="text-xs font-mono text-gray-300 leading-relaxed mb-8">Score: {submission.hit_score}. $1,500 Marketing Advance Ready.</p>
               <button onClick={handleSignDeal} disabled={isSigning} className="w-full bg-white text-black py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                 {isSigning ? <Loader2 size={24} className="animate-spin" /> : "Sign Upstream Contract"}
               </button>
            </div>
          )}

          {contractSigned && (
            <div className="p-12 text-center">
              <BadgeCheck size={64} className="text-green-500 mx-auto mb-6" />
              <h3 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white mb-2">Partnered with GetNice</h3>
              <p className="font-mono text-xs text-green-500 uppercase">Master Ownership: 60/40 Split Active</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}