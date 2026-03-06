"use client";

import React, { useState } from "react";
import { Users, ShieldCheck, Zap, Handshake, Lock, Search, ArrowRight, Mic2, Calendar, DollarSign } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import CreditHustle from "./CreditHustle";

// Mock database of active artists on the platform
const NETWORK_NODES = [
  { id: "USER_77X", alias: "Neon Blood", tag: "UK Drill / Dark", score: 92, featurePrice: 500, bookingPrice: 1500, available: true },
  { id: "GHOST_99", alias: "System Failure", tag: "Trap / Souf", score: 88, featurePrice: 250, bookingPrice: 800, available: true },
  { id: "AURA_SYNTH", alias: "Chrome Hearts", tag: "Melodic / RNB", score: 85, featurePrice: 300, bookingPrice: 1200, available: false },
  { id: "BASE_GOD", alias: "808 Mafia Clone", tag: "Boom Bap", score: 76, featurePrice: 100, bookingPrice: 500, available: true },
];

export default function Room10_Social() {
  const { userSession } = useMatrixStore();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<typeof NETWORK_NODES[0] | null>(null);
  const [interactionType, setInteractionType] = useState<"feature" | "booking">("feature");
  const [escrowStatus, setEscrowStatus] = useState<"idle" | "processing" | "locked">("idle");

  const platformFeePercentage = 15; // The GetNice Broker Fee

  const handleInitiateEscrow = () => {
    if (!selectedNode) return;
    setEscrowStatus("processing");

    // Simulate smart contract escrow locking funds
    setTimeout(() => {
      setEscrowStatus("locked");
    }, 2500);
  };

  const calculateTotal = (basePrice: number) => {
    const fee = basePrice * (platformFeePercentage / 100);
    return { base: basePrice, fee: fee, total: basePrice + fee };
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-[#050505] animate-in fade-in duration-500 overflow-hidden">
      
      {/* LEFT COL: THE NETWORK FEED */}
      <div className="w-full md:w-1/2 lg:w-7/12 border-r border-[#222] flex flex-col relative h-full">
        
        {/* Header & Search */}
        <div className="p-6 border-b border-[#222] bg-black z-10">
          <h2 className="font-oswald text-3xl uppercase tracking-widest font-bold text-[#E60000] flex items-center gap-3 mb-4">
            <Users size={28} /> Network Syndicate
          </h2>
          
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search active nodes, producers, or vocalists..." 
              className="w-full bg-[#111] border border-[#333] pl-12 pr-4 py-3 text-xs text-white outline-none focus:border-[#E60000] font-mono transition-colors"
            />
          </div>
        </div>

        {/* Global Roster */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          <p className="text-[10px] text-[#555] font-mono uppercase tracking-widest mb-2 border-b border-[#111] pb-2">Active Roster // Top Hit Scores</p>
          
          {NETWORK_NODES.map((node) => (
            <div 
              key={node.id} 
              onClick={() => { setSelectedNode(node); setEscrowStatus("idle"); }}
              className={`bg-black border p-4 cursor-pointer transition-all group
                ${selectedNode?.id === node.id ? 'border-[#E60000] shadow-[0_0_15px_rgba(230,0,0,0.2)]' : 'border-[#222] hover:border-[#555]'}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-oswald text-xl uppercase tracking-widest text-white group-hover:text-[#E60000] transition-colors">{node.alias}</h3>
                  <p className="font-mono text-[10px] text-[#888]">{node.id} // {node.tag}</p>
                </div>
                <div className={`text-xl font-oswald font-bold ${node.score >= 85 ? 'text-green-500' : 'text-yellow-500'}`}>
                  {node.score} <span className="text-[10px] text-[#555]">/100</span>
                </div>
              </div>
              
              <div className="flex gap-4 mt-4 pt-4 border-t border-[#111]">
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#888]">
                  Feature: <span className="text-white">${node.featurePrice}</span>
                </div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#888]">
                  Booking: <span className="text-white">${node.bookingPrice}</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${node.available ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                  <span className="text-[9px] font-mono uppercase text-[#555]">{node.available ? 'Accepting Requests' : 'Booked'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT COL: GETNICE ESCROW / BROKERAGE */}
      <div className="flex-1 bg-[#0a0a0a] flex flex-col h-full overflow-y-auto custom-scrollbar">
        {!selectedNode ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10">
            {/* The Default Empty State */}
            <div className="flex flex-col items-center text-center opacity-30 mb-12">
              <Handshake size={64} className="mb-6" />
              <h3 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white mb-2">GetNice Brokerage</h3>
              <p className="font-mono text-[10px] text-white uppercase tracking-[0.3em]">Select a node to initiate an escrow contract</p>
            </div>
            
            {/* NEW: The Credit Hustle Dashboard injected right here! */}
            {userSession?.id && (
              <div className="w-full max-w-md mx-auto">
                <CreditHustle userId={userSession.id} />
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 flex flex-col h-full animate-in slide-in-from-right-8">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 bg-[#110000] text-[#E60000] border border-[#330000] px-3 py-1 text-[9px] uppercase font-bold tracking-widest mb-4">
                <ShieldCheck size={12} /> Verified Syndicate Member
              </div>
              <h2 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white">{selectedNode.alias}</h2>
              <p className="font-mono text-[10px] text-[#555] uppercase tracking-widest mt-1">Routing ID: {selectedNode.id}</p>
            </div>

            {/* Interaction Toggle */}
            <div className="flex gap-2 mb-8 border-b border-[#222] pb-6">
              <button 
                onClick={() => setInteractionType("feature")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-bold uppercase tracking-widest border transition-all
                  ${interactionType === 'feature' ? 'bg-[#E60000] border-[#E60000] text-white' : 'bg-black border-[#222] text-[#555] hover:border-white hover:text-white'}`}
              >
                <Mic2 size={14} /> Request Verse
              </button>
              <button 
                onClick={() => setInteractionType("booking")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-bold uppercase tracking-widest border transition-all
                  ${interactionType === 'booking' ? 'bg-[#E60000] border-[#E60000] text-white' : 'bg-black border-[#222] text-[#555] hover:border-white hover:text-white'}`}
              >
                <Calendar size={14} /> Live Booking
              </button>
            </div>

            {/* Escrow Contract Terminal */}
            <div className="flex-1 flex flex-col">
              {escrowStatus === "idle" && (
                <div className="bg-black border border-[#222] p-6 mb-auto relative group hover:border-[#E60000]/50 transition-all">
                  <h3 className="font-oswald text-lg uppercase tracking-widest text-[#E60000] mb-6 flex items-center gap-2 border-b border-[#222] pb-3">
                    <Lock size={16} /> Escrow Breakdown
                  </h3>
                  
                  {(() => {
                    const pricing = calculateTotal(interactionType === 'feature' ? selectedNode.featurePrice : selectedNode.bookingPrice);
                    return (
                      <div className="space-y-4 font-mono">
                        <div className="flex justify-between items-center text-xs text-[#888] uppercase">
                          <span>Artist Rate ({interactionType})</span>
                          <span className="text-white">${pricing.base.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-[#E60000] uppercase">
                          <span>GetNice Agency Fee ({platformFeePercentage}%)</span>
                          <span>${pricing.fee.toFixed(2)}</span>
                        </div>
                        <div className="pt-4 mt-4 border-t border-[#222] flex justify-between items-end">
                          <span className="text-[10px] text-[#555] uppercase tracking-widest">Total Lockup (CRD)</span>
                          <span className="text-3xl font-oswald font-bold text-white tracking-widest">${pricing.total.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })()}

                  <button 
                    onClick={handleInitiateEscrow}
                    disabled={!selectedNode.available}
                    className="w-full mt-8 bg-white text-black py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all disabled:opacity-20 flex justify-center items-center gap-2"
                  >
                    Lock Funds in Escrow <ArrowRight size={18} />
                  </button>
                </div>
              )}

              {escrowStatus === "processing" && (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <Zap size={48} className="text-[#E60000] animate-pulse mb-6" />
                  <p className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-2">Generating Smart Contract</p>
                  <p className="font-mono text-[10px] text-[#E60000] uppercase tracking-widest">Securing Ledger Funds...</p>
                </div>
              )}

              {escrowStatus === "locked" && (
                <div className="flex-1 flex flex-col items-center justify-center text-center animate-in zoom-in">
                  <ShieldCheck size={64} className="text-green-500 mb-6 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full" />
                  <h3 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white mb-2">Funds Secured</h3>
                  <p className="font-mono text-xs text-green-500 uppercase tracking-widest mb-6">
                    Request sent to {selectedNode.alias}. Funds are locked in GetNice Escrow.
                  </p>
                  <p className="font-mono text-[9px] text-[#555] uppercase leading-relaxed max-w-xs mx-auto border border-[#222] p-4">
                    If the artist fails to deliver the verse/performance within 14 days, the contract voids and funds return to your wallet (minus a 2% routing fee).
                  </p>
                </div>
              )}
            </div>

            {/* Legal / Lore Footer */}
            <div className="mt-6 pt-4 border-t border-[#111] flex items-start gap-3">
              <DollarSign size={14} className="text-[#555] shrink-0 mt-0.5" />
              <p className="text-[8px] font-mono uppercase tracking-widest text-[#555] leading-relaxed">
                GetNice Records acts strictly as the broker and escrow agent. The {platformFeePercentage}% agency fee is deducted at the time of contract execution to maintain platform infrastructure.
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}