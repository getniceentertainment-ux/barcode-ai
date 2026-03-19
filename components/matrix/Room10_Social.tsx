"use client";

import React, { useState, useEffect, useRef } from "react";
import { Users, ShieldCheck, Zap, Handshake, Lock, Search, ArrowRight, Mic2, Calendar, DollarSign, Disc3, RefreshCw, MessageSquare, Send, ExternalLink, User, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";
import CreditHustle from "./CreditHustle";

interface RosterNode {
  id: string;
  stage_name: string;
  avatar_url: string | null;
  mogul_score: number;
  total_referrals: number;
}

interface ChatMessage {
  id: string;
  stage_name: string;
  message: string;
  is_platform: boolean;
  created_at: string;
}

export default function Room10_Social() {
  // Pull the new setter from the store
  const { userSession, addToast, setIsUpgrading } = useMatrixStore();
  
  // Rules Gateway State
  const [hasAcceptedRules, setHasAcceptedRules] = useState(false);
  const [rulesChecked, setRulesChecked] = useState(false);

  // Layout & Roster State
  const [activeTab, setActiveTab] = useState<"brokerage" | "chat">("brokerage");
  const [searchQuery, setSearchQuery] = useState("");
  const [roster, setRoster] = useState<RosterNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<RosterNode | null>(null);
  
  // Escrow State
  const [interactionType, setInteractionType] = useState<"feature" | "booking">("feature");
  const [escrowStatus, setEscrowStatus] = useState<"idle" | "processing" | "locked">("idle");

  // Persistent Chat State
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize Matrix Data ONLY after rules are accepted
  useEffect(() => {
    if (!hasAcceptedRules) return;

    fetchLeaderboard();
    fetchChatHistory();

    // The Persistent Realtime Subscription
    const channel = supabase
      .channel('public:global_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'global_messages' }, (payload) => {
        setChat((prev) => [...prev, payload.new as ChatMessage]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hasAcceptedRules]);

  // Auto-scroll chat to bottom on new message
  useEffect(() => {
    if (activeTab === "chat") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chat, activeTab]);

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, stage_name, avatar_url, mogul_score, total_referrals')
        // Commenting this out for now until the DB is seeded with Moguls
        // .eq('tier', 'The Mogul') 
        .order('mogul_score', { ascending: false })
        .limit(20);

      if (error) throw error;
      setRoster(data || []);
    } catch (err) {
      console.error("Syndicate Load Failure:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchChatHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('global_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      if (data) {
        // Reverse array so the oldest is at the top, newest at the bottom
        setChat(data.reverse() as ChatMessage[]);
      }
    } catch (err) {
      console.error("Failed to load chat history:", err);
    }
  };

  const handleInitiateEscrow = () => {
    if (!selectedNode) return;
    setEscrowStatus("processing");
    setTimeout(() => setEscrowStatus("locked"), 2500);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !userSession?.id) return;
    
    const messageText = chatInput.trim();
    setChatInput(""); // Clear input optimistically

    try {
      const { error } = await supabase.from('global_messages').insert({
        user_id: userSession.id,
        stage_name: userSession.stageName || "GUEST_NODE",
        message: messageText,
        is_platform: false
      });

      if (error) throw error;
    } catch (err) {
      console.error("Failed to broadcast message:", err);
      if (addToast) addToast("Transmission failed.", "error");
    }
  };

  const basePrice = selectedNode ? Math.max(100, Math.floor(selectedNode.mogul_score / 2)) : 0;
  const platformFee = basePrice * 0.15;

  const filteredRoster = roster.filter(node => 
    (node.stage_name || node.id).toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- THE RULES GATEWAY INTERCEPTOR ---
  if (!hasAcceptedRules) {
    return (
      <div className="h-full flex items-center justify-center bg-[#050505] p-6 animate-in zoom-in duration-500">
        <div className="max-w-2xl w-full bg-black border border-[#330000] shadow-[0_0_50px_rgba(230,0,0,0.15)] flex flex-col">
          <div className="p-8 border-b border-[#222] flex items-center gap-4">
            <ShieldAlert size={40} className="text-[#E60000]" />
            <div>
              <h2 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white">Syndicate Clearance Required</h2>
              <p className="font-mono text-[10px] text-[#E60000] uppercase tracking-[0.2em] mt-1">End-to-End Comms Monitoring Active</p>
            </div>
          </div>
          
          <div className="p-8 space-y-6 font-mono text-[10px] text-[#888] uppercase tracking-widest leading-relaxed">
            <p>Access to the Global Syndicate and Brokerage Matrix is a privilege reserved for verified nodes. By entering Room 10, you are accessing the internal GetNice Records network.</p>
            <ul className="space-y-3 border-l-2 border-[#E60000] pl-4 text-gray-300">
              <li>1. No unauthorized solicitation of un-cleared instrumental leases.</li>
              <li>2. Fraudulent escrow requests will result in an immediate hardware ban.</li>
              <li>3. All communications are logged to the persistent ledger for security audits.</li>
              <li>4. Maintain professional operational standards. Disrespect to the syndicate is prohibited.</li>
            </ul>
          </div>

          <div className="p-8 bg-[#0a0a0a] border-t border-[#222] flex flex-col gap-6">
            <label className="flex items-start gap-4 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={rulesChecked} 
                onChange={(e) => setRulesChecked(e.target.checked)} 
                className="accent-[#E60000] w-5 h-5 shrink-0 mt-1 cursor-pointer" 
              />
              <span className="font-oswald text-sm text-[#555] uppercase tracking-widest group-hover:text-white transition-colors">
                I cryptographically sign and agree to the GetNice Records network operational standards.
              </span>
            </label>
            
            <button 
              onClick={() => setHasAcceptedRules(true)}
              disabled={!rulesChecked}
              className="w-full bg-[#E60000] disabled:opacity-20 disabled:cursor-not-allowed text-white py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex justify-center items-center gap-3 shadow-[0_0_20px_rgba(230,0,0,0.2)]"
            >
              Unlock Network Matrix <Lock size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- STANDARD ROOM 10 MATRIX ---
  return (
    <div className="h-full flex flex-col md:flex-row bg-[#050505] animate-in fade-in duration-500 overflow-hidden">
      
      {/* LEFT COL: LEADERBOARD */}
      <div className="w-full md:w-1/2 lg:w-5/12 border-r border-[#222] flex flex-col relative h-full shrink-0">
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
          
          {/* THE UPSELL BANNER */}
          {userSession?.tier !== "The Mogul" && (
            <div 
              onClick={() => setActiveRoom("EntryGateway")} 
              className="bg-[#110000] border border-[#E60000]/50 p-4 mb-4 flex items-center justify-between group cursor-pointer hover:bg-[#E60000] transition-colors"
            >
              <div>
                <p className="font-oswald text-sm text-[#E60000] group-hover:text-white uppercase tracking-widest font-bold">Not on the Roster?</p>
                <p className="font-mono text-[9px] text-[#888] group-hover:text-red-200 uppercase tracking-widest mt-1">Upgrade to Mogul to list your services.</p>
              </div>
              <ArrowRight size={16} className="text-[#E60000] group-hover:text-white" />
            </div>
          )}
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 opacity-30">
               <Disc3 size={32} className="animate-spin text-[#E60000] mb-4" />
               <p className="font-mono text-[9px] uppercase tracking-widest">Syncing Matrix Hierarchy...</p>
            </div>
          ) : filteredRoster.map((node, index) => (
            <div 
              key={node.id} 
              onClick={() => { setSelectedNode(node); setEscrowStatus("idle"); setActiveTab("brokerage"); }}
              className={`bg-black border p-4 cursor-pointer transition-all group hover:border-[#E60000]/50
                ${selectedNode?.id === node.id ? 'border-[#E60000] shadow-[0_0_15px_rgba(230,0,0,0.2)] bg-[#0a0a0a]' : 'border-[#111]'}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-4">
                  <div className={`font-oswald text-xl font-bold w-6 text-center ${index < 3 ? 'text-yellow-500' : 'text-[#444]'}`}>
                    #{index + 1}
                  </div>
                  
                  {/* Dynamic Avatar */}
                  <div className="w-10 h-10 bg-[#111] border border-[#333] overflow-hidden shrink-0">
                    {node.avatar_url ? (
                      <img src={node.avatar_url} alt="Avatar" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#555]"><User size={16} /></div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-oswald text-lg uppercase tracking-widest text-white group-hover:text-[#E60000] transition-colors truncate max-w-[120px]">
                      {node.stage_name || `NODE_${node.id.substring(0, 4)}`}
                    </h3>
                    <p className="font-mono text-[9px] text-[#555] uppercase tracking-widest">Recruits: {node.total_referrals}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-mono text-[#E60000] uppercase tracking-widest mb-1">Mogul Score</span>
                  <div className="text-xl font-oswald font-bold text-white tracking-tighter">{node.mogul_score}</div>
                </div>
              </div>
              <div className="flex gap-4 mt-2 pt-3 border-t border-[#111]">
                 <span className="text-[9px] font-mono text-[#444] uppercase tracking-widest">EST. FEATURE: <span className="text-white">${Math.max(100, Math.floor(node.mogul_score / 2))}</span></span>
                 <div className="ml-auto flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-[8px] font-mono uppercase text-[#444]">Active</span>
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT COL: DYNAMIC TABS */}
      <div className="flex-1 bg-[#0a0a0a] flex flex-col h-full overflow-hidden relative">
        
        {/* Right Col Navigation */}
        <div className="flex border-b border-[#222] bg-black shrink-0">
          <button 
            onClick={() => setActiveTab("brokerage")}
            className={`flex-1 py-4 font-oswald text-sm uppercase tracking-widest font-bold border-b-2 transition-colors flex justify-center items-center gap-2
              ${activeTab === 'brokerage' ? 'border-[#E60000] text-[#E60000]' : 'border-transparent text-[#555] hover:text-white'}`}
          >
            <Handshake size={16} /> GetNice Brokerage
          </button>
          <button 
            onClick={() => setActiveTab("chat")}
            className={`flex-1 py-4 font-oswald text-sm uppercase tracking-widest font-bold border-b-2 transition-colors flex justify-center items-center gap-2
              ${activeTab === 'chat' ? 'border-[#E60000] text-[#E60000]' : 'border-transparent text-[#555] hover:text-white'}`}
          >
            <MessageSquare size={16} /> Global Comms
          </button>
        </div>

        {/* TAB CONTENT: BROKERAGE & ESCROW */}
        {activeTab === "brokerage" && (
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
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
                
                <div className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-[#222] pb-6">
                  <div>
                    <div className="inline-flex items-center gap-2 bg-[#110000] text-[#E60000] border border-[#330000] px-3 py-1 text-[9px] uppercase font-bold tracking-widest mb-4">
                      <ShieldCheck size={12} /> Syndicate Artist
                    </div>
                    <h2 className="font-oswald text-3xl md:text-4xl uppercase tracking-widest font-bold text-white">
                      {selectedNode.stage_name || `NODE_${selectedNode.id.substring(0, 8)}`}
                    </h2>
                  </div>
                  
                  <Link 
                    href={`/${encodeURIComponent(selectedNode.stage_name || selectedNode.id)}`}
                    target="_blank"
                    className="bg-[#111] border border-[#333] text-white px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-colors flex items-center justify-center gap-2 shrink-0"
                  >
                    View Public Profile <ExternalLink size={14} />
                  </Link>
                </div>

                <div className="flex gap-2 mb-8">
                  <button onClick={() => setInteractionType("feature")} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest border transition-all ${interactionType === 'feature' ? 'bg-[#E60000] border-[#E60000] text-white' : 'bg-black border-[#222] text-[#555] hover:text-white hover:border-white'}`}>Request Verse</button>
                  <button onClick={() => setInteractionType("booking")} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest border transition-all ${interactionType === 'booking' ? 'bg-[#E60000] border-[#E60000] text-white' : 'bg-black border-[#222] text-[#555] hover:text-white hover:border-white'}`}>Live Booking</button>
                </div>

                <div className="flex-1 flex flex-col">
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
                          <span className="text-3xl font-oswald font-bold text-white tracking-tighter">${(basePrice + platformFee).toFixed(2)}</span>
                        </div>
                      </div>
                      <button onClick={handleInitiateEscrow} className="w-full mt-8 bg-white text-black py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all">Lock Funds in Escrow</button>
                    </div>
                  )}

                  {escrowStatus === "processing" && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                      <Zap size={48} className="text-[#E60000] animate-pulse mb-6" />
                      <p className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-2">Generating Contract...</p>
                      <p className="font-mono text-[10px] text-[#E60000] uppercase tracking-widest">Awaiting Stripe Handshake</p>
                    </div>
                  )}

                  {escrowStatus === "locked" && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center animate-in zoom-in">
                      <ShieldCheck size={64} className="text-green-500 mb-6 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full" />
                      <h3 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white mb-2">Funds Secured</h3>
                      <p className="font-mono text-xs text-green-500 uppercase tracking-widest mb-6">Request sent to {selectedNode.stage_name}.</p>
                      <p className="font-mono text-[9px] text-[#888] uppercase leading-relaxed max-w-xs mx-auto border border-[#222] bg-[#111] p-4 mb-6">
                        If the artist fails to deliver the verse/performance within 14 days, the contract voids and funds return to your wallet.
                      </p>
                      <button onClick={() => { setSelectedNode(null); setEscrowStatus("idle"); }} className="border border-[#333] text-white px-6 py-3 font-oswald text-sm uppercase tracking-widest hover:bg-white hover:text-black transition-colors flex items-center gap-2">
                        <RefreshCw size={14} /> Return to Network
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="mt-6 pt-4 border-t border-[#111] flex items-start gap-3">
                  <DollarSign size={14} className="text-[#555] shrink-0 mt-0.5" />
                  <p className="text-[8px] font-mono uppercase tracking-widest text-[#555] leading-relaxed">
                    GetNice Records acts strictly as the broker and escrow agent. The 15% agency fee is deducted at the time of contract execution to maintain platform infrastructure.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB CONTENT: GLOBAL COMMS (PERSISTENT DB CHAT) */}
        {activeTab === "chat" && (
          <div className="flex-1 flex flex-col animate-in slide-in-from-left-8 h-full bg-[#020202]">
            <div className="p-6 border-b border-[#111] flex items-center justify-between shadow-md shrink-0">
              <div>
                <h3 className="font-oswald text-xl uppercase tracking-widest font-bold text-white flex items-center gap-2">
                  <MessageSquare size={18} className="text-[#E60000]" /> Global Comms
                </h3>
                <p className="font-mono text-[9px] text-[#555] uppercase tracking-widest mt-1">Encrypted Node-to-Node Ledger</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="font-mono text-[9px] text-green-500 uppercase tracking-widest font-bold">Live DB Sync</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {chat.map((c) => (
                <div key={c.id} className={`text-sm font-mono leading-relaxed ${c.is_platform ? 'bg-[#110000] border border-[#330000] p-4 rounded-sm shadow-sm' : 'bg-black border border-[#111] p-3 rounded-sm'}`}>
                  <span className={`font-bold mr-3 tracking-widest text-[10px] uppercase ${c.is_platform ? 'text-[#E60000]' : c.stage_name === userSession?.stageName ? 'text-green-500' : 'text-[#888]'}`}>
                    {c.stage_name}:
                  </span>
                  <span className={c.is_platform ? 'text-[#E60000] font-bold' : 'text-gray-300'}>{c.message}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="p-4 bg-black border-t border-[#222] shrink-0">
              <form onSubmit={handleSendMessage} className="relative flex gap-2">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Commit to permanent global ledger..." 
                  className="flex-1 bg-[#111] border border-[#333] px-4 py-4 text-xs text-white outline-none focus:border-[#E60000] font-mono transition-colors"
                />
                <button 
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="bg-[#E60000] text-white px-6 hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center shadow-[0_0_15px_rgba(230,0,0,0.2)]"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}