"use client";

import React, { useState, useEffect } from "react";
import { 
  Wallet, TrendingUp, ShieldCheck, ArrowUpRight, 
  History, DollarSign, Zap, FileText, Lock, 
  ChevronRight, BadgeCheck, Gavel, BarChart3, Loader2, Landmark,
  ShieldAlert, Activity, Unlock, FileSignature, ArrowRight, CheckCircle2
} from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function Room08_Bank() {
  const { userSession, addToast, setActiveRoom } = useMatrixStore();
  
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<any>(null);
  const [isSigning, setIsSigning] = useState(false);
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

  // SURGICAL FIX: Changed dependency to [userSession?.id] to prevent the infinite loop!
  useEffect(() => {
    if (userSession?.id) {
      fetchFinancialData();
    }
  }, [userSession?.id]);

  const fetchFinancialData = async () => {
    setLoading(true);
    
    try {
      // 1. Check for Stripe Account & Wallet Balance
      const { data: profileData } = await supabase
        .from('profiles')
        .select('stripe_account_id, wallet_balance')
        .eq('id', userSession?.id)
        .single();

      if (profileData?.stripe_account_id) {
        setHasConnectedBank(true);
      }
      
      // Sync global state wallet balance just in case
      if (profileData && profileData.wallet_balance !== undefined) {
        useMatrixStore.setState({ userSession: { ...userSession, walletBalance: profileData.wallet_balance } as any });
      }

      // 2. Latest Artifact
      const { data: subData } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', userSession?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subData) {
        setSubmission(subData);
      }

      // 3. Transactions Ledger
      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userSession?.id)
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
      // SURGICAL FIX: Fetch the user's secure session token
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch('/api/stripe/withdraw', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}` // SURGICAL FIX: Pass the token to bypass the 401 Unauthorized block
        },
        body: JSON.stringify({ userId: userSession?.id, amount: balance })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url; // Routes to their Stripe Express Dashboard
      } else {
        throw new Error(data.error || "Withdrawal routing failed.");
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
      // 1. Execute Deal on Artifact
      const { error: subErr } = await supabase
        .from('submissions')
        .update({ upstream_deal_signed: true })
        .eq('id', submission.id);

      if (subErr) throw new Error("Contract signing failed.");

      // 2. Elevate Profile to GetNice Partner & Deposit Advance
      const { data: profile } = await supabase.from('profiles').select('marketing_credits').eq('id', userSession.id).single();
      const currentCredits = profile?.marketing_credits || 0;
      const advanceAmount = 1500.00;

      await supabase
        .from('profiles')
        .update({ 
            getnice_signed: true, 
            marketing_credits: currentCredits + advanceAmount 
        })
        .eq('id', userSession.id);
        
      // 3. Create Audit Ledger Record
      await supabase.from('transactions').insert({
        user_id: userSession.id,
        amount: advanceAmount,
        type: 'ADVANCE_DEPOSIT',
        description: `GetNice Records Advance: ${submission.title}`
      });

      // 4. Local State Updates
      setSubmission({ ...submission, upstream_deal_signed: true });
      if(addToast) addToast("Advance Deployed to Wallet. Welcome to GetNice.", "success");
      
      // Refresh to grab the new transaction for the ledger UI
      fetchFinancialData();
    } catch (err: any) {
      if(addToast) addToast(err.message, "error");
    } finally {
      setIsSigning(false);
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-[#E60000]" size={48} /></div>;

  const hitScore = submission?.hit_score || 0;
  const isEligibleForDeal = hitScore >= 90;
  const isSigned = submission?.upstream_deal_signed;

  return (
    <div className="h-full flex flex-col bg-[#050505] animate-in fade-in duration-500 overflow-hidden border border-[#222]">
      
      {/* HEADER */}
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
        
        {/* LEFT COL: TRANSACTION LEDGER */}
        <div className="w-full lg:w-1/2 border-r border-[#111] flex flex-col bg-[#020202]">
          <div className="p-6 border-b border-[#111] flex justify-between items-center bg-black">
            <h3 className="font-oswald text-sm uppercase tracking-widest text-[#888] flex items-center gap-2">
              <History size={14} /> Transaction History
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar">
            {ledger.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-[#444] opacity-50">
                 <History size={48} className="mb-4" />
                 <p className="font-mono text-[10px] uppercase tracking-widest">Ledger Empty</p>
               </div>
            ) : (
              ledger.map((item) => (
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
              ))
            )}
          </div>
        </div>

        {/* RIGHT COL: STRICT VAULT & GATEWAY */}
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
                  <p className={`text-xl font-oswald font-bold ${submission.hit_score >= 90 ? 'text-green-500' : 'text-[#E60000]'}`}>
                    {submission.hit_score}/100
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center opacity-30 font-mono text-[10px] uppercase border border-dashed border-[#333]">No artifacts found in Vault.</div>
            )}
          </div>

          <div className="flex-1 p-8 lg:p-12 flex flex-col justify-center">
             {!submission ? (
               <div className="flex flex-col items-center justify-center text-center opacity-40">
                  <Lock size={64} className="mb-6 text-[#555]" />
                  <h3 className="font-oswald text-3xl uppercase tracking-widest text-white mb-2">Vault Locked</h3>
                  <p className="font-mono text-[10px] text-[#888] uppercase tracking-widest">Process an artifact through R07 Distribution to unlock.</p>
               </div>
             ) : !isEligibleForDeal ? (
               <div className="flex flex-col items-center justify-center text-center max-w-lg mx-auto animate-in zoom-in-95">
                  <div className="w-24 h-24 rounded-full border border-[#E60000]/30 bg-[#110000] flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(230,0,0,0.2)]">
                    <Activity size={36} className="text-[#E60000]" />
                  </div>
                  <h3 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white mb-4">Access Denied</h3>
                  
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
               <div className="flex flex-col items-center justify-center text-center max-w-lg mx-auto animate-in zoom-in-95">
                  <CheckCircle2 size={64} className="text-green-500 mb-6 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full" />
                  <h3 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white mb-2">Deal Executed</h3>
                  <p className="font-mono text-[10px] text-green-500 uppercase tracking-widest mb-8">GetNice Records Upstream Partner</p>
                  
                  <div className="bg-[#111] border border-[#222] p-6 w-full mb-8 text-left space-y-4">
                    <p className="text-xs font-mono text-[#888] uppercase tracking-widest flex items-center gap-2"><Zap size={14} className="text-yellow-500"/> $1,500 Advance Deposited to Ledger</p>
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
               <div className="flex flex-col max-w-xl mx-auto animate-in fade-in w-full">
                 <div className="flex items-center gap-3 mb-6 border-b border-[#222] pb-6">
                   <Unlock size={24} className="text-green-500" />
                   <h3 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white">Upstream Deal Unlocked</h3>
                 </div>

                 <div className="bg-black border border-[#333] p-6 mb-8 relative overflow-hidden group">
                   <div className="absolute top-0 left-0 w-1 h-full bg-[#E60000]" />
                   <p className="font-mono text-[10px] text-[#E60000] uppercase tracking-widest font-bold mb-4">Smart Contract // Terms of Agreement</p>
                   
                   <div className="space-y-4 font-mono text-[10px] text-gray-300 leading-relaxed uppercase tracking-widest">
                     <p>1. <span className="text-white font-bold">The Advance:</span> GetNice Records will deposit $1,500 in non-recoupable marketing credits to your Matrix Node.</p>
                     <p>2. <span className="text-white font-bold">The Execution:</span> The Exec AI will instantly seize control of your campaign, deploying automated Ad Spend, TikTok renders, and Fan CRM blasts over a strict 30-Day period.</p>
                     <p>3. <span className="text-white font-bold">The Prestige:</span> Your public profile will be permanently elevated to "GetNice Records Partner," granting priority ranking in the Network Syndicate.</p>
                   </div>

                   <div className="mt-6 bg-[#110000] border border-[#330000] p-4 flex items-start gap-3">
                     <ShieldAlert size={16} className="text-[#E60000] shrink-0 mt-0.5" />
                     <p className="text-[9px] text-[#E60000] uppercase font-bold tracking-widest">
                       Warning: By signing this agreement, you authorize the Neural Network to execute marketing actions on your behalf. This action is irreversible.
                     </p>
                   </div>
                 </div>

                 <button 
                    onClick={handleSignDeal}
                    disabled={isSigning}
                    className="w-full bg-white text-black py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isSigning ? <Loader2 size={24} className="animate-spin" /> : <><FileSignature size={24} /> Execute $1,500 Upstream Deal</>}
                  </button>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}