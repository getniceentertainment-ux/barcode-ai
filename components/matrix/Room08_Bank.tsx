"use client";

import React, { useState, useEffect } from "react";
import { 
  Wallet, TrendingUp, ShieldCheck, ArrowUpRight, 
  History, DollarSign, Zap, FileText, Lock, 
  ChevronRight, BadgeCheck, Gavel, BarChart3, Loader2
} from "lucide-react";

/**
 * FIX: Using relative paths that align with the standard project structure.
 * If these still fail in your specific local environment, ensure the 
 * folders 'store' and 'lib' exist at the root level.
 */
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function Room08_Bank() {
  const { userSession, addToast, setActiveRoom } = useMatrixStore();
  
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<any>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [contractSigned, setContractSigned] = useState(false);

  // Mock Ledger Data representing user transactions and platform arbitrage
  const ledger = [
    { id: 1, type: "CREDIT_PURCHASE", amount: "-$9.99", desc: "50 Generation Credits", date: "2026-03-15" },
    { id: 2, type: "BEAT_LEASE", amount: "-$29.99", desc: "Dior Freestyle #017", date: "2026-03-14" },
    { id: 3, type: "ROYALTY_DIST", amount: "+$142.50", desc: "Spotify Monthly Payout", date: "2026-03-01" },
  ];

  useEffect(() => {
    fetchLatestSubmission();
  }, [userSession]);

  const fetchLatestSubmission = async () => {
    if (!userSession?.id) return;
    try {
      // Pull the latest analysis from Room 07 submission to check for "Hit Score"
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', userSession.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) setSubmission(data);
    } catch (err) {
      console.error("Bank sync error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignDeal = async () => {
    setIsSigning(true);
    // Logic: Simulate the GetNice Algorithmic Advance injection ($1,500 Marketing Credits)
    setTimeout(() => {
      setIsSigning(false);
      setContractSigned(true);
      if(addToast) addToast("Upstream Deal Secured. $1,500 Marketing Credits Issued.", "success");
    }, 3000);
  };

  // Rubric Rule: Score of 90+ triggers the Upstream Deal intercept
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
          <div className="bg-[#0a0a0a] border border-[#222] p-4 min-w-[160px]">
            <p className="text-[8px] font-mono text-[#555] uppercase mb-1 font-bold">Wallet Balance</p>
            <p className="text-2xl font-oswald font-bold text-white">${userSession?.walletBalance?.toFixed(2) || "0.00"}</p>
          </div>
          <div className="bg-[#0a0a0a] border border-[#222] p-4 min-w-[160px]">
            <p className="text-[8px] font-mono text-[#E60000] uppercase mb-1 font-bold">Marketing Credits</p>
            <p className="text-2xl font-oswald font-bold text-[#E60000]">{contractSigned ? "$1,500.00" : "$0.00"}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* LEFT: THE LEDGER (Transaction history) */}
        <div className="w-full lg:w-1/2 border-r border-[#111] flex flex-col bg-[#020202]">
          <div className="p-6 border-b border-[#111] flex justify-between items-center bg-black">
            <h3 className="font-oswald text-sm uppercase tracking-widest text-[#888] flex items-center gap-2">
              <History size={14} /> Transaction History
            </h3>
            <button className="text-[9px] font-mono text-[#555] hover:text-white uppercase tracking-widest transition-colors">Download CSV</button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar">
            {ledger.map((item) => (
              <div key={item.id} className="flex justify-between items-center p-4 bg-black border border-[#111] hover:border-[#333] transition-colors group">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-full ${item.amount.startsWith('+') ? 'bg-green-500/10 text-green-500' : 'bg-[#E60000]/10 text-[#E60000]'}`}>
                    {item.amount.startsWith('+') ? <TrendingUp size={14} /> : <DollarSign size={14} />}
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-white uppercase font-bold tracking-widest">{item.desc}</p>
                    <p className="text-[8px] font-mono text-[#444] uppercase mt-1">{item.date} // {item.type}</p>
                  </div>
                </div>
                <div className={`font-oswald text-lg font-bold ${item.amount.startsWith('+') ? 'text-green-500' : 'text-white'}`}>
                  {item.amount}
                </div>
              </div>
            ))}
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

          {/* THE INTERCEPTION: UPSTREAM DEAL (Triggered by Hit Score > 90) */}
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