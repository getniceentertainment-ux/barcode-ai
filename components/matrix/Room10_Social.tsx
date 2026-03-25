"use client";

import React, { useState, useEffect, useRef } from "react";
import { Users, ShieldCheck, Zap, Handshake, Lock, Search, ArrowRight, Mic2, Calendar, DollarSign, Disc3, RefreshCw, MessageSquare, Send, ExternalLink, User, Terminal, Loader2, Star, BadgeCheck } from "lucide-react";
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
  tier: string;
}

export default function Room10_Social() {
  const { userSession, addToast } = useMatrixStore();
  
  const [activeTab, setActiveTab] = useState<"brokerage" | "chat">("brokerage");
  const [searchQuery, setSearchQuery] = useState("");
  const [roster, setRoster] = useState<RosterNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<RosterNode | null>(null);
  
  const [interactionType, setInteractionType] = useState<"feature" | "booking">("feature");
  const [escrowStatus, setEscrowStatus] = useState<"idle" | "processing" | "locked">("idle");

  // --- REALTIME CHAT STATE ---
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from('global_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);
      
      if (data) setMessages(data);
      if (!error) setIsConnected(true);
    };

    fetchHistory();

    const channel = supabase
      .channel('public:global_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'global_messages' }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (activeTab === "chat") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  const fetchLeaderboard = async () => {
    try {
      // --- HARDENED SUPABASE QUERY ---
      // 1. Pulling Stage Name, Mogul Score, and Tier
      // 2. We filter for any tier that IS NOT exactly 'Free Loader'
      // 3. We order by mogul_score DESC (Highest first)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, stage_name, avatar_url, mogul_score, total_referrals, tier')
        .neq('tier', 'Free Loader') 
        .order('mogul_score', { ascending: false, nullsFirst: false })
        .limit(50);

      if (error) {
        console.error("Supabase Query Error:", error.message);
        throw error;
      }

      console.log("Syndicate Roster Data Received:", data?.length, "nodes found.");
      setRoster(data || []);
      
    } catch (err) {
      console.error("Syndicate Load Failure:", err);
      if (addToast) addToast("Failed to sync with global hierarchy.", "error");
    } finally {
      setIsLoading(false);
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
    setIsSending(true);
    try {
      const { error } = await supabase.from('global_messages').insert([{
        user_id: userSession.id,
        stage_name: userSession.stageName || `NODE_${userSession.id.substring(0,6)}`,
        content: chatInput.trim(),
      }]);
      if (error) throw error;
      setChatInput("");
    } catch (err) {
      console.error("Message failed to send:", err);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (ts: string) => {
    if (!ts) return "";
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const basePrice = selectedNode ? Math.max(100, Math.floor(selectedNode.mogul_score / 2)) : 0;
  const platformFee = basePrice * 0.15;

  const filteredRoster = roster.filter(node => 
    (node.stage_name || node.id).toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <div className="flex justify-between items-center mb-2 border-b border-[#111] pb-2">
             <p className="text-[10px] text-[#555] font-mono uppercase tracking-widest">Global Leaderboard // Realtime Ratings</p>
             <Link href="/studio?upgrade=true" className="text-[9px] text-yellow-500 font-bold uppercase hover:text-white transition-colors flex items-center gap-1">
               <Zap size={10} /> Upgrade Tier
             </Link>
          </div>
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 opacity-30">
               <Disc3 size={32} className="animate-spin text-[#E60000] mb-4" />
               <p className="font-mono text-[9px] uppercase tracking-widest">Syncing Matrix Hierarchy...</p>
            </div>
          ) : filteredRoster.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 opacity-20 text-center">
               <ShieldCheck size={48} className="mb-4 text-[#444]" />
               <p className="font-mono text-xs uppercase tracking-widest">No Qualified Nodes Found.<br/>Only Moguls & Artists Appear Here.</p>
               <p className="font-mono text-[8px] text-[#333] mt-4 uppercase">Ensure RLS Policies permit Public Read on Profiles.</p>
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
                  <div className={`font-oswald text-xl font-bold w-6 text-center ${index < 3 ? 'text-[#E60000]' : 'text-[#444]'}`}>
                    #{index + 1}
                  </div>
                  
                  <div className="w-10 h-10 bg-[#111] border border-[#333] overflow-hidden shrink-0">
                    {node.avatar_url ? (
                      <img src={node.avatar_url} alt="Avatar" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#555]"><User size={16} /></div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-oswald text-lg uppercase tracking-widest text-white group-hover:text-[#E60000] transition-colors truncate max-w-[120px] flex items-center gap-2">
                      {node.stage_name || `NODE_${node.id.substring(0, 4)}`}
                      {node.tier?.includes("Mogul") && <Star size={12} className="text-yellow-500 fill-yellow-500" />}
                    </h3>
                    
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded-sm border font-bold
                        ${node.tier?.includes('Mogul') ? 'border-yellow-600/50 bg-yellow-600/10 text-yellow-500' : 
                          'border-blue-600/50 bg-blue-600/10 text-blue-400'}`}>
                        {node.tier?.toUpperCase() || 'NODE'}
                      </span>
                      <span className="text-[8px] font-mono text-[#444] uppercase tracking-widest">Recruits: {node.total_referrals}</span>
                    </div>
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
        <div className="flex border-b border-[#222] bg-black shrink-0">
          <button onClick={() => setActiveTab("brokerage")} className={`flex-1 py-4 font-oswald text-sm uppercase tracking-widest font-bold border-b-2 transition-colors flex justify-center items-center gap-2 ${activeTab === 'brokerage' ? 'border-[#E60000] text-[#E60000]' : 'border-transparent text-[#555] hover:text-white'}`}>
            <Handshake size={16} /> GetNice Brokerage
          </button>
          <button onClick={() => setActiveTab("chat")} className={`flex-1 py-4 font-oswald text-sm uppercase tracking-widest font-bold border-b-2 transition-colors flex justify-center items-center gap-2 ${activeTab === 'chat' ? 'border-[#E60000] text-[#E60000]' : 'border-transparent text-[#555] hover:text-white'}`}>
            <MessageSquare size={16} /> Global Comms
          </button>
        </div>

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
                      <ShieldCheck size={12} /> {selectedNode.tier?.includes('Mogul') ? 'MOGUL ARCHITECT' : 'SYNDICATE ARTIST'}
                    </div>
                    <h2 className="font-oswald text-3xl md:text-4xl uppercase tracking-widest font-bold text-white">
                      {selectedNode.stage_name || `NODE_${selectedNode.id.substring(0, 8)}`}
                    </h2>
                  </div>
                  <Link href={`/${encodeURIComponent(selectedNode.stage_name || selectedNode.id)}`} target="_blank" className="bg-[#111] border border-[#333] text-white px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-colors flex items-center justify-center gap-2 shrink-0">
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
                      <h3 className="font-oswald text-lg uppercase tracking-widest text-[#E60000] mb-6 border-b border-[#222] pb-3 flex items-center gap-2"><Lock size={16} /> Escrow Breakdown</h3>
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
                      <Zap size={48} className="text-[#E60000] animate-pulse mb-6" /><p className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-2">Generating Contract...</p><p className="font-mono text-[10px] text-[#E60000] uppercase tracking-widest">Awaiting Stripe Handshake</p>
                    </div>
                  )}
                  {escrowStatus === "locked" && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center animate-in zoom-in">
                      <ShieldCheck size={64} className="text-green-500 mb-6 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full" /><h3 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white mb-2">Funds Secured</h3><p className="font-mono text-xs text-green-500 uppercase tracking-widest mb-6">Request sent to {selectedNode.stage_name}.</p><p className="font-mono text-[9px] text-[#888] uppercase leading-relaxed max-w-xs mx-auto border border-[#222] bg-[#111] p-4 mb-6">If the artist fails to deliver the verse/performance within 14 days, the contract voids and funds return to your wallet.</p><button onClick={() => { setSelectedNode(null); setEscrowStatus("idle"); }} className="border border-[#333] text-white px-6 py-3 font-oswald text-sm uppercase tracking-widest hover:bg-white hover:text-black transition-colors flex items-center gap-2"><RefreshCw size={14} /> Return to Network</button>
                    </div>
                  )}
                </div>
                <div className="mt-6 pt-4 border-t border-[#111] flex items-start gap-3"><DollarSign size={14} className="text-[#555] shrink-0 mt-0.5" /><p className="text-[8px] font-mono uppercase tracking-widest text-[#555] leading-relaxed">GetNice Records acts strictly as the broker and escrow agent. The 15% agency fee is deducted at the time of contract execution to maintain platform infrastructure.</p></div>
              </div>
            )}
          </div>
        )}

        {activeTab === "chat" && (
          <div className="flex-1 flex flex-col animate-in slide-in-from-left-8 h-full bg-[#020202]">
            <div className="p-6 border-b border-[#111] flex items-center justify-between shadow-md shrink-0">
              <div><h3 className="font-oswald text-xl uppercase tracking-widest font-bold text-white flex items-center gap-2"><MessageSquare size={18} className="text-[#E60000]" /> Global Comms</h3><p className="font-mono text-[9px] text-[#555] uppercase tracking-widest mt-1">Encrypted Node-to-Node Chat</p></div>
              <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div><span className={`font-mono text-[9px] uppercase tracking-widest font-bold ${isConnected ? 'text-green-500' : 'text-yellow-500'}`}>{isConnected ? 'Online' : 'Connecting...'}</span></div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {messages.length === 0 ? (<div className="h-full flex flex-col items-center justify-center opacity-30 text-white"><Terminal size={48} className="mb-4" /><p className="font-mono text-xs uppercase tracking-widest">Syndicate Log Empty.</p></div>) : messages.map((msg, i) => { const isMe = msg.user_id === userSession?.id; return (<div key={msg.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}><div className="flex items-baseline gap-2 mb-1"><span className="font-mono text-[9px] text-[#555] uppercase">{formatTime(msg.created_at)}</span><span className={`font-oswald text-xs uppercase font-bold tracking-widest ${isMe ? 'text-[#E60000]' : 'text-white'}`}>{msg.stage_name}</span></div><div className={`max-w-[80%] p-4 text-sm font-mono ${isMe ? 'bg-[#E60000]/10 border border-[#E60000]/30 text-white rounded-tl-lg rounded-bl-lg rounded-br-lg' : 'bg-black border border-[#333] text-gray-300 rounded-tr-lg rounded-bl-lg rounded-br-lg'}`}>{msg.content}</div></div>); })}
              <div ref={chatEndRef} />
            </div>
            <div className="p-4 bg-black border-t border-[#222] shrink-0">
              <form onSubmit={handleSendMessage} className="relative flex gap-2"><input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder={isConnected ? "Broadcast to global syndicate..." : "Establishing connection..."} disabled={!isConnected} className="flex-1 bg-[#111] border border-[#333] px-4 py-4 text-xs text-white outline-none focus:border-[#E60000] font-mono transition-colors disabled:opacity-50" /><button type="submit" disabled={!chatInput.trim() || isSending || !isConnected} className="bg-[#E60000] text-white px-6 hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center shadow-[0_0_15px_rgba(230,0,0,0.2)]">{isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}</button></form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}