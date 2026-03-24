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
  
  // --- STRIPE CONNECT STATE ---
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
    console.error("Connect Error:", err);
    if(addToast) addToast(err.message, "error");
    setIsConnectingBank(false);
  }
};
  useEffect(() => {
    fetchFinancialData();
  }, [userSession]);

  const fetchFinancialData = async () => {
    if (!userSession?.id) return;
    setLoading(true);
    
    try {
      // 1. Check if they have a Stripe Connect Account linked
      const { data: profileData } = await supabase
        .from('profiles')
        .select('stripe_account_id')
        .eq('id', userSession.id)
        .single();

      if (profileData?.stripe_account_id) {
        setHasConnectedBank(true);
      }

      // 2. Pull the actual latest artifact submission
      const { data: subData } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', userSession.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subData) {
        setSubmission(subData);
        if (subData.upstream_deal_signed) {
          setContractSigned(true);
        }
      }

      // 3. Pull the real transaction ledger from the database
      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userSession.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (txData) {
        setLedger(txData);
      }
    } catch (err) {
      console.error("Bank sync error:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- STRIPE CONNECT ACTIONS ---
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
        throw new Error(data.error || "Failed to initialize Stripe Connect.");
      }
    } catch (err: any) {
      console.error("Connect Error:", err);
      if(addToast) addToast("Failed to route to Stripe Onboarding.", "error");
      setIsConnectingBank(false);
    }
  };

const handleWithdrawFunds = async () => {
  const balance = userSession?.walletBalance || 0;
  if (balance <= 0) {
    if(addToast) addToast("No fiat funds to withdraw.", "error");
    return;
  }
  // Call your new withdraw router
  const res = await fetch('/api/stripe/withdraw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: userSession?.id, amount: balance })
  });
  const data = await res.json();
  if (data.success) {
    if(addToast) addToast("Withdrawal successful!", "success");
    fetchFinancialData();
  }
};
  const handleSignDeal = async () => {
    if (!userSession?.id || !submission?.id) return;
    setIsSigning(true);
    
    try {
      const { data: checkSub } = await supabase
        .from('submissions')
        .select('upstream_deal_signed')
        .eq('id', submission.id)
        .single();
        
      if (checkSub?.upstream_deal_signed) {
        setContractSigned(true);
        throw new Error("Security Alert: Contract has already been executed.");
      }

      const { error: subErr } = await supabase
        .from('submissions')
        .update({ upstream_deal_signed: true })
        .eq('id', submission.id);

      if (subErr) {
        console.error("Contract Lock Failed:", subErr);
        throw new Error("Failed to sign contract. Database lock rejected.");
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('marketing_credits')
        .eq('id', userSession.id)
        .single();

      const currentCredits = profile?.marketing_credits || 0;
      const advanceAmount = 1500.00;

      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ marketing_credits: currentCredits + advanceAmount })
        .eq('id', userSession.id);

      if (profileErr) throw profileErr;

      await supabase.from('transactions').insert({
        user_id: userSession.id,
        amount: advanceAmount,
        type: 'ADVANCE_DEPOSIT',
        description: `Upstream Advance: ${submission.title}`
      });

      setContractSigned(true);
      
      useMatrixStore.setState({ 
        userSession: { 
          ...userSession, 
          marketingCredits: currentCredits + advanceAmount 
        } as any
      });

      if(addToast) addToast("Upstream Deal Executed. $1,500 Deployed to Wallet.", "success");
      
    } catch (err: any) {
      console.error("Deal Execution Error:", err);
      if(addToast) addToast(err.message || "Contract execution failed.", "error");
    } finally {
      setIsSigning(false);
    }
  };

  const isEligibleForDeal = submission && submission.hit_score >= 90;

  return (
    <div className="h-full flex flex-col bg-[#050505] animate-in fade-in duration-500 overflow-hidden border border-[#222]">
      
      {/* HEADER: WALLET OVERVIEW */}
      <div className="p-8 border-b border-[#111] bg-black flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white flex items-center gap-3">
            <Wallet className="text-[#E60000]" size={28} /> The Bank & Ledger
          </h2>
          <p className="font-mono text-[10px] text-[#555] uppercase tracking-[0.3em] mt-2">
            Financial Node // NODE_{userSession?.id ? userSession.id.substring(0,8).toUpperCase() : "OFFLINE"}
          </p>
        </div>
        
        <div className="flex gap-4">
          <div className="bg-[#0a0a0a] border border-[#222] p-4 min-w-[160px] flex flex-col justify-between">
            <div>
              <p className="text-[8px] font-mono text-[#555] uppercase mb-1 font-bold">Fiat Balance</p>
              <p className="text-2xl font-oswald font-bold text-white">${userSession?.walletBalance?.toFixed(2) || "0.00"}</p>
            </div>
            
            {/* STRIPE CONNECT BUTTON INJECTION */}
<button 
  onClick={hasConnectedBank ? handleWithdrawFunds : handleConnectBank} // <-- CRITICAL
  disabled={isConnectingBank}
  className={`mt-3 w-full border text-[9px] font-mono uppercase tracking-widest py-1.5 transition-all flex items-center justify-center gap-2
    ${hasConnectedBank 
      ? "bg-white text-black border-white hover:bg-[#E60000] hover:text-white hover:border-[#E60000]" 
      : "bg-black text-[#888] border-[#333] hover:text-white hover:border-white"}`}
>
  {isConnectingBank ? <Loader2 size={10} className="animate-spin" /> : <Landmark size={12} />}
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
            <p className="mt-3 text-[8px] font-mono text-[#444] uppercase tracking-widest text-center">
              Ecosystem Locked
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* LEFT: THE REAL LEDGER */}
        <div className="w-full lg:w-1/2 border-r border-[#111] flex flex-col bg-[#020202]">
          <div className="p-6 border-b border-[#111] flex justify-between items-center bg-black">
            <h3 className="font-oswald text-sm uppercase tracking-widest text-[#888] flex items-center gap-2">
              <History size={14} /> Transaction History
            </h3>
            <button className="text-[9px] font-mono text-[#555] hover:text-white uppercase tracking-widest transition-colors">Download CSV</button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar">
            {ledger.length === 0 && !loading ? (
              <div className="text-center py-10 opacity-30">
                <p className="text-[10px] font-mono uppercase tracking-widest">No transactions found.</p>
              </div>
            ) : (
              ledger.map((item) => {
                const isPositive = Number(item.amount) > 0;
                return (
                  <div key={item.id} className="flex justify-between items-center p-4 bg-black border border-[#111] hover:border-[#333] transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${isPositive ? 'bg-green-500/10 text-green-500' : 'bg-[#E60000]/10 text-[#E60000]'}`}>
                        {isPositive ? <TrendingUp size={14} /> : <DollarSign size={14} />}
                      </div>
                      <div>
                        <p className="text-[10px] font-mono text-white uppercase font-bold tracking-widest">{item.description}</p>
                        <p className="text-[8px] font-mono text-[#444] uppercase mt-1">
                          {new Date(item.created_at).toLocaleDateString()} // {item.type}
                        </p>
                      </div>
                    </div>
                    <div className={`font-oswald text-lg font-bold ${isPositive ? 'text-green-500' : 'text-white'}`}>
                      {isPositive ? '+' : ''}${Math.abs(item.amount).toFixed(2)}
                    </div>
                  </div>
                );
              })
            )}
            <div className="pt-8 text-center">
              <p className="text-[9px] font-mono text-[#333] uppercase tracking-widest">--- End of Recorded Ledger ---</p>
            </div>
          </div>
        </div>

        {/* RIGHT: THE VAULT & SMART CONTRACTS */}
        <div className="flex-1 flex flex-col bg-black overflow-y-auto custom-scrollbar">
          
          {/* Active Artifact Stats */}
          <div className="p-8 border-b border-[#111] bg-[#050505]">
            <h3 className="font-oswald text-sm uppercase tracking-widest text-[#E60000] mb-6 flex items-center gap-2">
              <ShieldCheck size={16} /> Active Artifact License
            </h3>
            
            {!submission ? (
              <div className="border border-dashed border-[#222] p-12 text-center opacity-30">
                <Lock size={32} className="mx-auto mb-4" />
                <p className="text-[10px] font-mono uppercase tracking-widest">No finalized artifacts found in ledger.</p>
                <button onClick={() => setActiveRoom("07")} className="mt-4 text-[9px] border border-white px-3 py-1 hover:bg-white hover:text-black transition-all uppercase font-bold">Go to Distribution</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0a0a0a] border border-[#222] p-4">
                  <span className="text-[8px] font-mono text-[#555] uppercase block mb-1">Standard Royalty Split</span>
                  <p className="text-xl font-oswald font-bold text-white">80% Artist / 20% BC</p>
                </div>
                <div className="bg-[#0a0a0a] border border-[#222] p-4">
                  <span className="text-[8px] font-mono text-[#555] uppercase block mb-1">Last A&R Score</span>
                  <p className={`text-xl font-oswald font-bold ${submission.hit_score >= 85 ? 'text-green-500' : 'text-[#E60000]'}`}>
                    {submission.hit_score}/100
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* THE INTERCEPTION: UPSTREAM DEAL */}
          {isEligibleForDeal && !contractSigned && (
            <div className="p-8 bg-[#110000] border-b border-[#E60000]/30 animate-in zoom-in duration-700">
               <div className="flex items-center gap-3 mb-6">
                 <div className="bg-[#E60000] p-2 rounded-sm text-white shadow-[0_0_15px_rgba(230,0,0,0.5)]">
                   <Gavel size={20} />
                 </div>
                 <h3 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white">
                   Upstream Deal Offered
                 </h3>
               </div>
               
               <p className="text-xs font-mono text-gray-300 leading-relaxed mb-8 border-l-2 border-[#E60000] pl-6">
                 Your artifact scored <span className="text-white font-bold">{submission.hit_score}</span>. 
                 GetNice Records has triggered an algorithmic buyout. We are offering a 
                 <span className="text-white font-bold"> $1,500 Marketing Advance</span> in exchange for a 
                 <span className="text-white font-bold"> 40% Master Stake</span> for 5 years.
               </p>

               <div className="space-y-3 mb-8">
                 <div className="flex items-center gap-3 text-[10px] text-green-500 font-bold uppercase tracking-widest">
                   <BadgeCheck size={14} /> $1,500 Marketing Credits (Tik Tok/Spotify Ads)
                 </div>
                 <div className="flex items-center gap-3 text-[10px] text-green-500 font-bold uppercase tracking-widest">
                   <BadgeCheck size={14} /> Priority Global Playlist Pitching
                 </div>
                 <div className="flex items-center gap-3 text-[10px] text-green-500 font-bold uppercase tracking-widest">
                   <BadgeCheck size={14} /> 0% Transaction Fees on Future Sales
                 </div>
               </div>

               <button 
                 onClick={handleSignDeal}
                 disabled={isSigning}
                 className="w-full bg-white text-black py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all flex justify-center items-center gap-3 shadow-[0_0_30px_rgba(255,255,255,0.1)]"
               >
                 {isSigning ? <Loader2 size={24} className="animate-spin" /> : <><ArrowUpRight size={20} /> Sign Upstream Contract</>}
               </button>
               <p className="text-[8px] font-mono text-[#444] uppercase mt-4 text-center">Funds are non-fiat and must be deployed via the GetNice Ad-Manager (Room 09).</p>
            </div>
          )}

          {/* SIGNED STATUS UI */}
          {contractSigned && (
            <div className="p-12 text-center animate-in zoom-in">
              <BadgeCheck size={64} className="text-green-500 mx-auto mb-6 shadow-[0_0_30px_rgba(34,197,94,0.3)] rounded-full" />
              <h3 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white mb-2">Partnered with GetNice</h3>
              <p className="font-mono text-xs text-green-500 uppercase tracking-widest mb-10">Master Ownership: 60% Artist / 40% Label</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-sm mx-auto">
                <button onClick={() => setActiveRoom("09")} className="bg-[#111] border border-[#222] text-white py-4 text-[10px] font-bold uppercase tracking-widest hover:border-white transition-all flex items-center justify-center gap-2">
                  Ad Manager <BarChart3 size={12} />
                </button>
                <button onClick={() => setActiveRoom("10")} className="bg-[#111] border border-[#222] text-white py-4 text-[10px] font-bold uppercase tracking-widest hover:border-white transition-all flex items-center justify-center gap-2">
                  Social Network <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}