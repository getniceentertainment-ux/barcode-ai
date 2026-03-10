"use client";

import React, { useState, useEffect } from "react";
import { Users, ShieldCheck, Zap, Handshake, Lock, Search, ArrowRight, Mic2, Calendar, DollarSign, Disc3 } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";
import CreditHustle from "./CreditHustle";

interface RosterNode {
  id: string;
  email: string;
  mogul_score: number;
  total_referrals: number;
}

export default function Room10_Social() {
  const { userSession } = useMatrixStore();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [roster, setRoster] = useState<RosterNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<RosterNode | null>(null);
  const [interactionType, setInteractionType] = useState<"feature" | "booking">("feature");
  const [escrowStatus, setEscrowStatus] = useState<"idle" | "processing" | "locked">("idle");

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      // Pull real top-tier users ordered by Mogul Score
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, mogul_score, total_referrals')
        .order('mogul_score', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRoster(data || []);
    } catch (err) {
      console.error("Syndicate Load Failure:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitiateEscrow = () => {
    if (!selectedNode) return;
    setEscrowStatus("processing");
    setTimeout(() => setEscrowStatus("locked"), 2500);
  };

  const basePrice = selectedNode ? Math.max(100, Math.floor(selectedNode.mogul_score / 2)) : 0;
  const platformFee = basePrice * 0.15;

  return (
    <div className="h-full flex flex-col md:flex-row bg-[#050505] animate-in fade-in duration-500 overflow-hidden">
      
      <div className="w-full md:w-1/2 lg:w-7/12 border-r border-[#222] flex flex-col relative h-full">
        <div className="p-6 border-b border-[#222] bg-black z-10">
          <h2 className="font-oswald text-3xl uppercase tracking-widest font-bold text-[#E60000] flex items-center gap-3 mb-4">
            <Users size={28} /> Network Syndicate
          </h2>
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" />
            <input 
              type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search active nodes..." 
              className="w-full bg-[#111] border border-[#333] pl-12 pr-4 py-3 text-xs text-white outline-none focus:border-[#E60000] font-mono"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-[#020202]">
          <p className="text-[10px] text-[#555] font-mono uppercase tracking-widest mb-2 border-b border-[#111] pb-2">Global Leaderboard // Mogul Score</p>
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 opacity-30">
               <Disc3 size={32} className="animate-spin text-[#E60000] mb-4" />
               <p className="font-mono text-[9px] uppercase tracking-widest">Syncing Matrix Hierarchy...</p>
            </div>
          ) : roster.map((node, index) => (
            <div 
              key={node.id} 
              onClick={() => { setSelectedNode(node); setEscrowStatus("idle"); }}
              className={`bg-black border p-4 cursor-pointer transition-all group hover:border-[#E60000]/50
                ${selectedNode?.id === node.id ? 'border-[#E60000] shadow-[0_0_15px_rgba(230,0,0,0.2)] bg-[#0a0a0a]' : 'border-[#111]'}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-4">
                  <div className={`font-oswald text-xl font-bold w-6 text-center ${index < 3 ? 'text-yellow-500' : 'text-[#444]'}`}>
                    #{index + 1}
                  </div>
                  <div>
                    <h3 className="font-oswald text-xl uppercase tracking-widest text-white group-hover:text-[#E60000] transition-colors">
                      NODE_{node.id.substring(0, 8)}
                    </h3>
                    <p className="font-mono text-[9px] text-[#555] uppercase tracking-widest">Recruits: {node.total_referrals}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-mono text-[#E60000] uppercase tracking-widest mb-1">Mogul Score</span>
                  <div className="text-2xl font-oswald font-bold text-white tracking-tighter">
                    {node.mogul_score}
                  </div>
                </div>
              </div>
              <div className="flex gap-4 mt-2 pt-4 border-t border-[#111]">
                 <span className="text-[9px] font-mono text-[#444] uppercase tracking-widest">EST. FEATURE: <span className="text-white">${Math.max(100, Math.floor(node.mogul_score / 2))}</span></span>
                 <div className="ml-auto flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-[8px] font-mono uppercase text-[#444]">Node Active</span>
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-[#0a0a0a] flex flex-col h-full overflow-y-auto custom-scrollbar">
        {!selectedNode ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10">
            <div className="flex flex-col items-center text-center opacity-30 mb-12">
              <Handshake size={64} className="mb-6" />
              <h3 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white mb-2">GetNice Brokerage</h3>
              <p className="font-mono text-[10px] text-white uppercase tracking-[0.3em]">Select a node to initiate an escrow contract</p>
            </div>
            {userSession?.id && <CreditHustle userId={userSession.id} />}
          </div>
        ) : (
          <div className="p-8 flex flex-col h-full animate-in slide-in-from-right-8">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 bg-[#110000] text-[#E60000] border border-[#330000] px-3 py-1 text-[9px] uppercase font-bold tracking-widest mb-4">
                <ShieldCheck size={12} /> Syndicate Artist
              </div>
              <h2 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white">NODE_{selectedNode.id.substring(0, 8)}</h2>
            </div>

            <div className="flex gap-2 mb-8 border-b border-[#222] pb-6">
              <button onClick={() => setInteractionType("feature")} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest border transition-all ${interactionType === 'feature' ? 'bg-[#E60000] border-[#E60000] text-white' : 'bg-black border-[#222] text-[#555]'}`}>Request Verse</button>
              <button onClick={() => setInteractionType("booking")} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest border transition-all ${interactionType === 'booking' ? 'bg-[#E60000] border-[#E60000] text-white' : 'bg-black border-[#222] text-[#555]'}`}>Live Booking</button>
            </div>

            <div className="flex-1">
              {escrowStatus === "idle" && (
                <div className="bg-black border border-[#222] p-6 mb-auto group hover:border-[#E60000]/50 transition-all">
                  <h3 className="font-oswald text-lg uppercase tracking-widest text-[#E60000] mb-6 border-b border-[#222] pb-3 flex items-center gap-2">
                    <Lock size={16} /> Escrow Breakdown
                  </h3>
                  <div className="space-y-4 font-mono text-[10px]">
                    <div className="flex justify-between items-center text-[#888] uppercase"><span>Artist Rate</span><span className="text-white">${basePrice.toFixed(2)}</span></div>
                    <div className="flex justify-between items-center text-[#E60000] uppercase"><span>Broker Fee (15%)</span><span>${platformFee.toFixed(2)}</span></div>
                    <div className="pt-4 mt-4 border-t border-[#222] flex justify-between items-end">
                      <span className="text-[#555] uppercase tracking-widest">Total Escrow Lock</span>
                      <span className="text-3xl font-oswald font-bold text-white tracking-widest">${(basePrice + platformFee).toFixed(2)}</span>
                    </div>
                  </div>
                  <button onClick={handleInitiateEscrow} className="w-full mt-8 bg-white text-black py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all">Lock Funds in Escrow</button>
                </div>
              )}

              {escrowStatus === "processing" && (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
                  <Zap size={48} className="text-[#E60000] animate-pulse mb-6" />
                  <p className="font-oswald text-2xl uppercase tracking-widest font-bold text-white">Generating Contract...</p>
                </div>
              )}

              {escrowStatus === "locked" && (
                <div className="flex-1 flex flex-col items-center justify-center text-center animate-in zoom-in py-10">
                  <ShieldCheck size={64} className="text-green-500 mb-6 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full" />
                  <h3 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white mb-2">Request Transmitted</h3>
                  <p className="font-mono text-xs text-green-500 uppercase tracking-widest mb-6">Funds locked in secure escrow.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}