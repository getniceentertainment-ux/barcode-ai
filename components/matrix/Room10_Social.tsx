"use client";

import React, { useState, useEffect, useRef } from "react";
import { Users, ShieldCheck, Zap, Handshake, Lock, Search, ArrowRight, Mic2, Calendar, DollarSign, Disc3, RefreshCw, MessageSquare, Send, ExternalLink, User, Terminal, Loader2, Star, BadgeCheck, TrendingUp, Heart } from "lucide-react";
import Link from "next/link";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

interface RosterNode {
  id: string;
  stage_name: string;
  avatar_url: string | null;
  mogul_score: number;
  total_referrals: number;
  tier: string;
  total_fans: number;
  getnice_signed: boolean;
}

export default function Room10_Social() {
  const { userSession, addToast } = useMatrixStore();
  
  const [activeTab, setActiveTab] = useState<"Promoter" | "chat">("Promotor");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"score" | "fans">("score");
  const [roster, setRoster] = useState<RosterNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<RosterNode | null>(null);
  
  const [interactionType, setInteractionType] = useState<"feature" | "booking">("feature");
  const [escrowStatus, setEscrowStatus] = useState<"idle" | "processing" | "locked">("idle");

  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isFreeLoader = userSession?.tier === "Free Loader";

  useEffect(() => {
    fetchLeaderboard();
    
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('escrow_success') === 'true') {
        window.history.replaceState({}, document.title, window.location.pathname);
        setEscrowStatus("locked");
        if (addToast) addToast("Escrow Funds Captured & Secured in Ledger.", "success");
      }
    }
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

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (activeTab === "chat") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, stage_name, avatar_url, mogul_score, total_referrals, tier, total_fans, getnice_signed')
        .neq('tier', 'Free Loader') 
        .limit(100);

      if (error) throw error;
      setRoster(data || []);
    } catch (err) {
      console.error("Syndicate Load Failure:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getDynamicPricing = (node: RosterNode | null, type: "feature" | "booking") => {
    if (!node) return { base: 0, fee: 0, total: 0 };
    const score = node.mogul_score || 0;
    const tierMultiplier = node.tier?.includes("Mogul") ? 2.5 : 1.0;
    let base = type === "feature" ? Math.max(150, (score * 0.75) * tierMultiplier) : Math.max(500, (score * 2.25) * tierMultiplier);
    const fee = base * 0.15;
    return { base: Math.floor(base), fee: Math.floor(fee), total: Math.floor(base + fee) };
  };

  const handleInitiateEscrow = async () => {
    if (!selectedNode || !userSession?.id) return;
    
    setEscrowStatus("processing");
    const pricing = getDynamicPricing(selectedNode, interactionType);

    try {
      const res = await fetch('/api/stripe/escrow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerId: userSession.id,
          targetNodeId: selectedNode.id,
          amount: pricing.total,
          type: interactionType,
          stageName: selectedNode.stage_name || 'Active Node'
        })
      });

      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Escrow Link Generation Failed");
      }
    } catch (err: any) {
      console.error("Escrow Error:", err);
      if (addToast) addToast("Financial Node Offline: " + err.message, "error");
      setEscrowStatus("idle");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !userSession?.id || isFreeLoader) return;
    setIsSending(true);
    try {
      await supabase.from('global_messages').insert([{
        user_id: userSession.id,
        stage_name: userSession.stageName || `NODE_${userSession.id.substring(0,6)}`,
        content: chatInput.trim(),
      }]);
      setChatInput("");
    } catch (err) { console.error(err); } finally { setIsSending(false); }
  };

  const formatTime = (ts: string) => {
    if (!ts) return "";
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const pricing = getDynamicPricing(selectedNode, interactionType);
  
  // Sort Logic for Dual Tier Leaderboard
  const sortedRoster = [...roster].sort((a, b) => {
    if (sortMode === "fans") return (b.total_fans || 0) - (a.total_fans || 0);
    return (b.mogul_score || 0) - (a.mogul_score || 0);
  });

  const filteredRoster = sortedRoster.filter(node => (node.stage_name || node.id).toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="h-full flex flex-col md:flex-row bg-[#050505] animate-in fade-in duration-500 overflow-hidden border border-[#222]">
      
      {/* LEADERBOARD COL */}
      <div className="w-full md:w-1/2 lg:w-5/12 border-r border-[#222] flex flex-col relative h-full shrink-0">
        <div className="p-6 border-b border-[#222] bg-black z-10">
          <h2 className="font-oswald text-3xl uppercase tracking-widest font-bold text-[#E60000] flex items-center gap-3 mb-4">
            <Users size={28} /> The Underground
          </h2>
          <div className="relative mb-4">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" />
            <input 
              type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search active nodes..." 
              className="w-full bg-[#111] border border-[#333] pl-12 pr-4 py-3 text-xs text-white outline-none focus:border-[#E60000] font-mono"
            />
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setSortMode("score")} 
              className={`flex-1 py-2 text-[9px] font-mono uppercase tracking-widest font-bold border transition-colors flex items-center justify-center gap-2 ${sortMode === "score" ? 'bg-[#E60000] border-[#E60000] text-white' : 'bg-black border-[#333] text-[#888] hover:text-white'}`}
            >
              <TrendingUp size={12} /> Local Rapport
            </button>
            <button 
              onClick={() => setSortMode("fans")} 
              className={`flex-1 py-2 text-[9px] font-mono uppercase tracking-widest font-bold border transition-colors flex items-center justify-center gap-2 ${sortMode === "fans" ? 'bg-[#E60000] border-[#E60000] text-white' : 'bg-black border-[#333] text-[#888] hover:text-white'}`}
            >
              <Heart size={12} /> Global Rapport
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-[#020202]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 opacity-30"><Disc3 size={32} className="animate-spin text-[#E60000] mb-4" /></div>
          ) : filteredRoster.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 opacity-20 text-center"><ShieldCheck size={48} className="mb-4 text-[#444]" /><p className="font-mono text-xs uppercase tracking-widest">No Qualified Nodes Found.</p></div>
          ) : filteredRoster.map((node, index) => (
            <div 
              key={node.id} 
              onClick={() => { setSelectedNode(node); setEscrowStatus("idle"); setActiveTab("Bookings"); }}
              className={`bg-black border p-4 cursor-pointer transition-all group hover:border-[#E60000]/50 ${selectedNode?.id === node.id ? 'border-[#E60000] bg-[#0a0a0a]' : 'border-[#111]'}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-4">
                  <div className={`font-oswald text-xl font-bold w-6 text-center ${index < 3 ? 'text-[#E60000]' : 'text-[#444]'}`}>#{index + 1}</div>
                  <div className="w-10 h-10 bg-[#111] border border-[#333] overflow-hidden shrink-0">
                    {node.avatar_url ? <img src={node.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[#555]"><User size={16} /></div>}
                  </div>
                  <div>
                    <h3 className="font-oswald text-lg uppercase tracking-widest text-white flex items-center gap-2">
                      {node.stage_name || `NODE_${node.id.substring(0, 4)}`}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {node.getnice_signed ? (
                        <span className="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded-sm border border-red-600/50 bg-red-600/10 text-[#E60000] font-bold flex items-center gap-1"><ShieldCheck size={8}/> GetNice Records</span>
                      ) : (
                        <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded-sm border font-bold ${node.tier?.includes('Mogul') ? 'border-yellow-600/50 bg-yellow-600/10 text-yellow-500' : 'border-blue-600/50 bg-blue-600/10 text-blue-400'}`}>{node.tier?.toUpperCase()}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {sortMode === "score" ? (
                    <><span className="text-[8px] font-mono text-[#E60000] uppercase block mb-1">Score</span><div className="text-xl font-oswald font-bold text-white">{node.mogul_score || 0}</div></>
                  ) : (
                    <><span className="text-[8px] font-mono text-[#E60000] uppercase block mb-1">Fans</span><div className="text-xl font-oswald font-bold text-white">{node.total_fans || 0}</div></>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DYNAMIC DASHBOARD */}
      <div className="flex-1 bg-[#0a0a0a] flex flex-col h-full overflow-hidden relative">
        <div className="flex border-b border-[#222] bg-black shrink-0">
          <button onClick={() => setActiveTab("brokerage")} className={`flex-1 py-4 font-oswald text-sm uppercase tracking-widest font-bold border-b-2 transition-colors flex justify-center items-center gap-2 ${activeTab === 'brokerage' ? 'border-[#E60000] text-[#E60000]' : 'border-transparent text-[#555] hover:text-white'}`}><Handshake size={16} /> Brokerage</button>
          <button onClick={() => setActiveTab("chat")} className={`flex-1 py-4 font-oswald text-sm uppercase tracking-widest font-bold border-b-2 transition-colors flex justify-center items-center gap-2 ${activeTab === 'chat' ? 'border-[#E60000] text-[#E60000]' : 'border-transparent text-[#555] hover:text-white'}`}><MessageSquare size={16} /> Comms</button>
        </div>

        {activeTab === "brokerage" && (
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
            {!selectedNode ? (
              <div className="flex-1 flex flex-col items-center justify-center p-10 opacity-30 text-center"><Handshake size={64} className="mb-6" /><h3 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white">Select a Node</h3><p className="font-mono text-[10px] text-white uppercase tracking-[0.3em]">Initiate Secure Escrow</p></div>
            ) : (
              <div className="p-8 flex flex-col h-full animate-in slide-in-from-right-8">
                <div className="mb-8 flex justify-between items-start border-b border-[#222] pb-6">
                  <div>
                    <div className="inline-flex items-center gap-2 bg-[#110000] text-[#E60000] border border-[#330000] px-3 py-1 text-[9px] uppercase font-bold tracking-widest mb-4">
                      <ShieldCheck size={12} /> {selectedNode.getnice_signed ? 'GETNICE RECORDS ROSTER' : (selectedNode.tier === 'The Mogul' ? 'MOGUL ARCHITECT' : 'SYNDICATE ARTIST')}
                    </div>
                    <h2 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white">{selectedNode.stage_name || `NODE_${selectedNode.id.substring(0, 8)}`}</h2>
                  </div>
                  <Link href={`/${encodeURIComponent(selectedNode.stage_name || selectedNode.id)}`} target="_blank" className="bg-[#111] border border-[#333] text-white px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-colors flex items-center gap-2">View Profile <ExternalLink size={14} /></Link>
                </div>

                <div className="flex gap-2 mb-8">
                  <button onClick={() => setInteractionType("feature")} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest border transition-all ${interactionType === 'feature' ? 'bg-[#E60000] border-[#E60000] text-white' : 'bg-black border-[#222] text-[#555] hover:text-white hover:border-white'}`}>Request Verse</button>
                  <button onClick={() => setInteractionType("booking")} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest border transition-all ${interactionType === 'booking' ? 'bg-[#E60000] border-[#E60000] text-white' : 'bg-black border-[#222] text-[#555] hover:text-white hover:border-white'}`}>Live Booking</button>
                </div>

                <div className="flex-1 flex flex-col">
                  {escrowStatus === "idle" && (
                    <div className="bg-black border border-[#222] p-6 group hover:border-[#E60000]/50 transition-all">
                      <h3 className="font-oswald text-lg uppercase tracking-widest text-[#E60000] mb-6 border-b border-[#222] pb-3 flex items-center gap-2"><Lock size={16} /> Escrow Breakdown</h3>
                      <div className="space-y-4 font-mono text-[10px]">
                        <div className="flex justify-between items-center text-[#888] uppercase"><span>{interactionType === "feature" ? "Verse" : "Performance"} Rate</span><span className="text-white">${pricing.base.toFixed(2)}</span></div>
                        <div className="flex justify-between items-center text-[#E60000] uppercase"><span>Broker Fee (15%)</span><span>${pricing.fee.toFixed(2)}</span></div>
                        <div className="pt-4 mt-4 border-t border-[#222] flex justify-between items-end"><span className="text-[#555] uppercase tracking-widest">Total Escrow Lock</span><span className="text-3xl font-oswald font-bold text-white tracking-tighter">${pricing.total.toFixed(2)}</span></div>
                      </div>
                      <button onClick={handleInitiateEscrow} className="w-full mt-8 bg-[#E60000] text-white py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(230,0,0,0.2)]">Lock Funds in Escrow <ArrowRight size={18} /></button>
                    </div>
                  )}
                  {escrowStatus === "processing" && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center"><Zap size={48} className="text-[#E60000] animate-pulse mb-6" /><p className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-2">Routing to Stripe Secure...</p><p className="font-mono text-[10px] text-[#E60000] uppercase tracking-widest">Awaiting Financial Handshake</p></div>
                  )}
                  {escrowStatus === "locked" && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center animate-in zoom-in"><ShieldCheck size={64} className="text-green-500 mb-6 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full" /><h3 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white mb-2">Funds Secured</h3><p className="font-mono text-xs text-green-500 uppercase tracking-widest mb-6">Contract Live. Recipient Notified via Neural Ping.</p><button onClick={() => { setSelectedNode(null); setEscrowStatus("idle"); }} className="border border-[#333] text-white px-6 py-3 font-oswald text-sm uppercase tracking-widest hover:bg-white hover:text-black transition-colors flex items-center gap-2"><RefreshCw size={14} /> Return to Network</button></div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CHAT TAB WITH FREE LOADER LOCK */}
        {activeTab === "chat" && (
          <div className="flex-1 flex flex-col animate-in slide-in-from-left-8 h-full bg-[#020202]">
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {messages.map((msg, i) => { const isMe = msg.user_id === userSession?.id; return (<div key={msg.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}><div className="flex items-baseline gap-2 mb-1"><span className="font-mono text-[9px] text-[#555] uppercase">{formatTime(msg.created_at)}</span><span className={`font-oswald text-xs uppercase font-bold tracking-widest ${isMe ? 'text-[#E60000]' : 'text-white'}`}>{msg.stage_name}</span></div><div className={`max-w-[80%] p-4 text-sm font-mono ${isMe ? 'bg-[#E60000]/10 border border-[#E60000]/30 text-white rounded-tl-lg rounded-bl-lg rounded-br-lg' : 'bg-black border border-[#333] text-gray-300 rounded-tr-lg rounded-bl-lg rounded-br-lg'}`}>{msg.content}</div></div>); })}
              <div ref={chatEndRef} />
            </div>
            <div className="p-4 bg-black border-t border-[#222] shrink-0">
              <form onSubmit={handleSendMessage} className="relative flex gap-2">
                <input 
                  type="text" 
                  value={chatInput} 
                  onChange={(e) => setChatInput(e.target.value)} 
                  placeholder={isFreeLoader ? "Chat locked. Upgrade to an Artist Node." : "Broadcast to syndicate..."} 
                  disabled={!isConnected || isFreeLoader} 
                  className="flex-1 bg-[#111] border border-[#333] px-4 py-4 text-xs text-white outline-none focus:border-[#E60000] font-mono transition-colors disabled:opacity-50" 
                />
                <button 
                  type="submit" 
                  disabled={!chatInput.trim() || isSending || !isConnected || isFreeLoader} 
                  className="bg-[#E60000] text-white px-6 transition-colors flex items-center justify-center disabled:opacity-50 disabled:bg-[#333]"
                >
                  {isSending ? <Loader2 size={18} className="animate-spin" /> : (isFreeLoader ? <Lock size={18} /> : <Send size={18} />)}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}