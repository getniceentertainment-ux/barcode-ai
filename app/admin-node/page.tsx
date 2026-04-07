"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ShieldAlert, Activity, DollarSign, Users, Radio, 
  Ban, CheckCircle2, AlertTriangle, Terminal, Database, Server,
  Play, Pause, XCircle, BarChart, Clock, Music, UploadCloud, Loader2,
  FileText, MessageSquare, CreditCard, RefreshCw 
} from "lucide-react";

import { supabase } from "../../lib/supabase";

export default function AdminNode() {
  const router = useRouter();
  const CREATOR_ID = process.env.NEXT_PUBLIC_CREATOR_ID;

  // AUTHORIZATION GUARD
  const [isAuthorized, setIsAuthorized] = useState(false);

  // NAVIGATION STATE
  const [activeTab, setActiveTab] = useState<"telemetry" | "anr" | "users" | "contracts" | "transactions" | "messages">("telemetry");
  
  // GLOBAL LIVE DATA STATES
  const [isLoading, setIsLoading] = useState(true);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  
  // LIVE TELEMETRY AGGREGATIONS
  const [telemetry, setTelemetry] = useState({
    totalRevenue: 0,
    computeCosts: 0,
    activeNodes: 0,
    vaultTracks: 0,
    gpuStatus: "OPTIMAL",
    networkLoad: "LIVE"
  });

  const [playingId, setPlayingId] = useState<string | null>(null);

  // DIRECT INJECTION STATE
  const [extTitle, setExtTitle] = useState("");
  const [extScore, setExtScore] = useState(99);
  const [extFile, setExtFile] = useState<File | null>(null);
  const [isInjecting, setIsInjecting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- THE UNBREAKABLE BOUNCER ---
  useEffect(() => {
    const MASTER_ID = 'f7c05436-8294-4450-8c89-4dfbb70e44b6';

    // 1. Wait for the global store to load your session
    if (userSession === undefined) return;

    // 2. If there is no session, or the ID is wrong, kick to homepage
    if (!userSession || (userSession.id !== CREATOR_ID && userSession.id !== MASTER_ID)) {
      console.warn("UNAUTHORIZED. EJECTING.");
      window.location.replace('/'); 
      return;
    }

    // 3. You are the boss. Open the door.
    setIsAuthorized(true);
    fetchAllData();
    
  }, [userSession, CREATOR_ID]);

  // --- OMNI-FETCHER: EXACT TABLE MAPPING ---
  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      // Execute all queries concurrently. Using allSettled prevents a failure in one table from crashing the entire dashboard.
      const results = await Promise.allSettled([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('submissions').select('*').order('created_at', { ascending: false }),
        supabase.from('escrow_contracts').select('*').order('created_at', { ascending: false }),
        supabase.from('transactions').select('*').order('created_at', { ascending: false }),
        supabase.from('global_messages').select('*').order('created_at', { ascending: false })
      ]);

      const [usersRes, subsRes, contractsRes, transRes, msgsRes] = results;

      // 1. Process Users (profiles)
      let activeNodesCount = 0;
      if (usersRes.status === 'fulfilled' && !usersRes.value.error) {
        setUsers(usersRes.value.data || []);
        activeNodesCount = usersRes.value.data?.length || 0;
      }

      // 2. Process Submissions (submissions)
      let vaultTracksCount = 0;
      if (subsRes.status === 'fulfilled' && !subsRes.value.error) {
        setSubmissions(subsRes.value.data || []);
        vaultTracksCount = subsRes.value.data?.length || 0;
      }

      // 3. Process Contracts (escrow_contracts)
      if (contractsRes.status === 'fulfilled' && !contractsRes.value.error) {
        setContracts(contractsRes.value.data || []);
      }

      // 4. Process Transactions (transactions)
      let totalRev = 0;
      if (transRes.status === 'fulfilled' && !transRes.value.error) {
        const tData = transRes.value.data || [];
        setTransactions(tData);
        // Calculate Revenue: Only aggregate deposits and purchases
        totalRev = tData.filter(t => t.type === 'deposit' || t.type === 'purchase')
                        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      }

      // 5. Process Messages (global_messages)
      if (msgsRes.status === 'fulfilled' && !msgsRes.value.error) {
        setMessages(msgsRes.value.data || []);
      }

      // 6. Update Telemetry aggregations
      setTelemetry({
        totalRevenue: totalRev,
        computeCosts: totalRev * 0.15, // Approximate 15% compute cost overhead
        activeNodes: activeNodesCount,
        vaultTracks: vaultTracksCount,
        gpuStatus: "OPTIMAL",
        networkLoad: "LIVE"
      });

    } catch (err) {
      console.error("Global Ledger Sync Failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // --- ACTIONS ---
  
  // A&R Approval/Rejection Logic[cite: 14]
  const handleStatusUpdate = async (id: string, newStatus: 'approved' | 'rejected' | 'pending') => {

    try {
      const { error } = await supabase.from('submissions').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      // Optimistic UI update
      setSubmissions(prev => prev.map(sub => sub.id === id ? { ...sub, status: newStatus } : sub));
    } catch (err) {
      console.error(`Status update error:`, err);
      alert("Failed to update track status.");
    }
  };

  // Threat Mitigation / Ban Logic[cite: 14]
  const handleBanUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to permanently freeze this node's wallet and revoke access?")) return;
    try {
      // Optimistic UI Update: Set status to banned and zero the balance
      setUsers(users.map(u => u.id === userId ? { ...u, status: "banned", wallet_balance: 0 } : u));
      
      const { error } = await supabase.from('profiles').update({ status: 'banned', wallet_balance: 0 }).eq('id', userId);
      if (error) throw error;
    } catch (err) {
      console.error("Ban execution failed:", err);
      alert("Failed to execute ban protocol.");
      fetchAllData(); // Revert UI on failure
    }
  };

  // CEO Tool: Direct Radio Injection[cite: 14]
  const handleInjectExternal = async () => {
    if (!extFile || !extTitle) return alert("Missing title or file.");
    setIsInjecting(true);
    try {
      const fileName = `external/${Date.now()}_${extFile.name.replace(/\s+/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from('public_audio').upload(fileName, extFile, { contentType: extFile.type });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('public_audio').getPublicUrl(fileName);
      
      // Insert directly into submissions with 'approved' status
      const { error: dbError } = await supabase.from('submissions').insert([{
        user_id: CREATOR_ID,
        title: extTitle.toUpperCase(),
        audio_url: publicUrlData.publicUrl,
        hit_score: extScore,
        status: 'approved' 
      }]);

      if (dbError) throw dbError;
      alert("External Asset Injected!");
      
      // Reset Form
      setExtTitle(""); 
      setExtFile(null); 
      if (fileInputRef.current) fileInputRef.current.value = "";
      
      // Refresh UI
      fetchAllData(); 
    } catch (err: any) {
      alert(`Injection failed: ${err.message}`);
    } finally {
      setIsInjecting(false);
    }
  };

  // Audio Playback Handler for A&R Queue[cite: 14]
  const togglePlay = (id: string) => {
    const currentAudio = document.getElementById(`audio-${playingId}`) as HTMLAudioElement;
    const newAudio = document.getElementById(`audio-${id}`) as HTMLAudioElement;

    if (playingId === id) {
      currentAudio?.pause();
      setPlayingId(null);
    } else {
      if (currentAudio) currentAudio.pause();
      if (newAudio) {
        newAudio.currentTime = 0;
        newAudio.play();
      }
      setPlayingId(id);
    }
  };

  // --- RENDER ---

  // THE FIREWALL RENDER[cite: 14]
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center selection:bg-[#E60000]">
        <Loader2 className="animate-spin text-[#E60000]" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020202] text-white flex flex-col font-mono selection:bg-[#E60000]">
      
      <div className="bg-[#E60000] text-white p-2 text-center text-[10px] font-bold uppercase tracking-[0.4em] flex items-center justify-center gap-4 animate-pulse z-50">
        <ShieldAlert size={14} /> Authorized Personnel Only // God Mode Active <ShieldAlert size={14} />
      </div>

      <div className="p-8 border-b border-[#222] bg-[#050505] flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 sticky top-0 z-40">
        <div>
          <h1 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white flex items-center gap-4">
            <Terminal size={32} className="text-[#E60000]" /> Admin Gateway
          </h1>
          <p className="text-[10px] text-[#888] uppercase tracking-[0.3em] mt-2">
            Global Telemetry // Node Management // Contract Execution
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {[
            { id: "telemetry", icon: <Activity size={14}/>, label: "Telemetry" },
            { id: "anr", icon: <Radio size={14}/>, label: "A&R Queue" },
            { id: "users", icon: <Users size={14}/>, label: "Nodes" },
            { id: "contracts", icon: <FileText size={14}/>, label: "Contracts" },
            { id: "transactions", icon: <CreditCard size={14}/>, label: "Ledger" },
            { id: "messages", icon: <MessageSquare size={14}/>, label: "Comms" },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-[#E60000] border-[#E60000] text-white' : 'bg-black border-[#222] text-[#555] hover:border-[#E60000] hover:text-white'}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
          <button onClick={fetchAllData} className="ml-4 p-2 text-[#555] hover:text-white transition-colors" title="Refresh Data">
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </button>
          <Link href="/" className="flex items-center gap-2 bg-[#111] border border-[#333] px-6 py-2 font-oswald uppercase text-[10px] tracking-widest hover:bg-white hover:text-black transition-colors ml-auto">
            Exit
          </Link>
        </div>
      </div>

      <div className="flex-1 p-8 max-w-7xl mx-auto w-full">
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 opacity-50">
            <Loader2 className="animate-spin text-[#E60000] mb-4" size={32} />
            <p className="font-mono text-[10px] uppercase tracking-widest">Querying Blockchain Ledger...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: TELEMETRY */}
            {activeTab === "telemetry" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-black border border-[#222] p-6 flex items-center gap-4 shadow-lg">
                    <Database size={32} className="text-[#E60000]" />
                    <div>
                      <p className="text-[10px] text-[#555] uppercase tracking-widest">Active Nodes (Users)</p>
                      <p className="font-oswald text-2xl text-white tracking-widest">{telemetry.activeNodes}</p>
                    </div>
                  </div>
                  <div className="bg-black border border-[#222] p-6 flex items-center gap-4 shadow-lg">
                    <Server size={32} className="text-yellow-500" />
                    <div>
                      <p className="text-[10px] text-[#555] uppercase tracking-widest">Vault Tracks Encrypted</p>
                      <p className="font-oswald text-2xl text-white tracking-widest">{telemetry.vaultTracks}</p>
                    </div>
                  </div>
                  <div className="bg-black border border-[#222] p-6 flex items-center gap-4 shadow-lg">
                    <Activity size={32} className="text-green-500" />
                    <div>
                      <p className="text-[10px] text-[#555] uppercase tracking-widest">Global Status</p>
                      <p className="font-oswald text-2xl text-white tracking-widest">{telemetry.networkLoad}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#050505] border border-[#222] p-8 relative overflow-hidden shadow-2xl">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-[#E60000] opacity-5 blur-[100px] rounded-full pointer-events-none"></div>
                  <h3 className="font-oswald text-2xl uppercase tracking-widest text-white mb-8 border-b border-[#222] pb-4 flex items-center gap-3">
                    <DollarSign size={24} className="text-green-500" /> Global Treasury (Fiat)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div>
                      <p className="text-[10px] text-[#888] uppercase tracking-widest mb-2">Gross Platform Revenue</p>
                      <p className="font-oswald text-6xl font-bold text-green-500 tracking-tighter">${telemetry.totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                      <div className="flex gap-4 mt-4"><span className="text-[10px] bg-green-500/10 text-green-500 border border-green-500/20 px-3 py-1 uppercase tracking-widest">Live Ledger Sync</span></div>
                    </div>
                    <div className="space-y-6">
                      <div className="flex justify-between items-center border-b border-[#222] pb-4">
                        <span className="text-xs text-[#555] uppercase tracking-widest">Estimated Compute Costs (15%)</span>
                        <span className="text-lg font-oswald text-[#E60000]">-${telemetry.computeCosts.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-[#222] pb-4">
                        <span className="text-xs text-[#555] uppercase tracking-widest">Active B2B Escrows</span>
                        <span className="text-lg font-oswald text-yellow-500">{contracts.filter(c => c.status === 'funded').length} Escrows</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: A&R OVERRIDE (SUBMISSIONS) */}
            {activeTab === "anr" && (
              <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8">
                
                {/* INJECTION TOOL */}
                <div className="bg-[#110000] border border-[#E60000]/50 p-6 flex flex-col relative overflow-hidden shadow-lg">
                  <div className="absolute top-0 right-0 bg-[#E60000] text-white text-[8px] font-bold uppercase tracking-widest px-2 py-1">CEO Tool</div>
                  <h3 className="font-oswald text-xl uppercase tracking-widest text-[#E60000] mb-2 flex items-center gap-2">
                    <UploadCloud size={20} /> Direct Radio Injection
                  </h3>
                  
                  <div className="flex flex-col md:flex-row gap-4 items-end mt-4">
                    <div className="flex-1 w-full">
                      <label className="text-[10px] text-[#888] font-bold uppercase tracking-widest mb-1 block">Track Title</label>
                      <input type="text" value={extTitle} onChange={(e) => setExtTitle(e.target.value)} placeholder="E.g., PLATINUM SINGLE" className="w-full bg-black border border-[#333] p-3 text-xs text-white outline-none focus:border-[#E60000]" />
                    </div>
                    <div className="w-full md:w-32">
                      <label className="text-[10px] text-[#888] font-bold uppercase tracking-widest mb-1 block">Hit Score</label>
                      <input type="number" min="1" max="100" value={extScore} onChange={(e) => setExtScore(parseInt(e.target.value) || 99)} className="w-full bg-black border border-[#333] p-3 text-xs text-white outline-none focus:border-[#E60000]" />
                    </div>
                    <div className="flex-1 w-full relative">
                      <input type="file" accept="audio/*" ref={fileInputRef} onChange={(e) => setExtFile(e.target.files?.[0] || null)} className="hidden" id="ext-upload" />
                      <label htmlFor="ext-upload" className="w-full bg-black border border-[#333] p-3 text-xs text-white cursor-pointer hover:border-[#E60000] transition-colors block text-center truncate">
                        {extFile ? extFile.name : "Select Audio Asset"}
                      </label>
                    </div>
                    <button onClick={handleInjectExternal} disabled={isInjecting || !extFile || !extTitle} className="w-full md:w-auto bg-[#E60000] text-white px-8 py-3 text-xs font-bold uppercase tracking-widest hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                      {isInjecting ? <Loader2 size={14} className="animate-spin" /> : 'Inject'}
                    </button>
                  </div>
                </div>

                <div className="bg-black border border-[#222] p-8 shadow-lg">
                  <h3 className="font-oswald text-2xl uppercase tracking-widest text-white mb-6 border-b border-[#222] pb-4 flex items-center gap-3">
                    <Radio size={24} className="text-[#E60000]"/> Submissions Ledger
                  </h3>

                  {submissions.length === 0 ? (
                    <div className="text-center p-12 border border-dashed border-[#222]"><p className="text-[#555] text-xs font-mono uppercase tracking-widest">No artifacts found.</p></div>
                  ) : (
                    <div className="space-y-4">
                      {submissions.map(sub => (
                        <div key={sub.id} className={`bg-[#050505] border ${sub.status === 'pending' ? 'border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'border-[#111]'} p-4 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-[#333] transition-colors`}>
                          <audio id={`audio-${sub.id}`} src={sub.audio_url} onEnded={() => setPlayingId(null)} className="hidden" />
                          <div className="flex items-center gap-4 w-full md:w-auto">
                            <button onClick={() => togglePlay(sub.id)} className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center transition-all ${playingId === sub.id ? 'bg-[#E60000] text-white' : 'bg-[#111] text-[#E60000] hover:bg-white hover:text-black'}`}>
                              {playingId === sub.id ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
                            </button>
                            <div className="overflow-hidden">
                              <h3 className="font-oswald text-lg uppercase tracking-widest font-bold text-white truncate">{sub.title || 'UNTITLED'}</h3>
                              <p className="font-mono text-[9px] text-[#555] uppercase mt-1">NODE: {sub.user_id.substring(0, 8)} | STATUS: <span className={sub.status === 'approved' ? 'text-green-500' : sub.status === 'rejected' ? 'text-[#E60000]' : 'text-yellow-500'}>{sub.status}</span></p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-mono text-[#888] uppercase tracking-widest">Score: <span className="text-white font-bold text-lg ml-1">{sub.hit_score}</span></span>
                            {sub.status === 'pending' ? (
                              <div className="flex gap-2">
                                <button onClick={() => handleStatusUpdate(sub.id, 'approved')} className="bg-green-500/10 text-green-500 px-3 py-2 text-[9px] font-bold uppercase hover:bg-green-500 hover:text-black transition-colors border border-green-500/30">Approve</button>
                                <button onClick={() => handleStatusUpdate(sub.id, 'rejected')} className="bg-[#110000] text-[#E60000] px-3 py-2 text-[9px] font-bold uppercase hover:bg-[#E60000] hover:text-white transition-colors border border-[#E60000]/30">Reject</button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                {/* Allows reverting an approval/rejection */}
                                <button onClick={() => handleStatusUpdate(sub.id, 'pending')} className="bg-[#111] text-[#888] px-3 py-2 text-[9px] font-bold uppercase hover:text-white transition-colors border border-[#333]">Revert Status</button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: USERS (NODES) */}
            {activeTab === "users" && (
              <div className="animate-in fade-in slide-in-from-bottom-4 bg-black border border-[#222] p-8 shadow-lg">
                <h3 className="font-oswald text-2xl uppercase tracking-widest text-white mb-6 border-b border-[#222] pb-4 flex items-center gap-3">
                  <Users size={24} className="text-[#E60000]"/> Registered Nodes
                </h3>
                {users.length === 0 ? (
                  <div className="text-center p-12 border border-dashed border-[#222]"><p className="text-[#555] text-xs font-mono uppercase tracking-widest">No nodes found.</p></div>
                ) : (
                  <div className="space-y-3">
                    {users.map(user => (
                      <div key={user.id} className={`bg-[#050505] border p-4 flex items-center justify-between ${user.status === 'banned' ? 'border-[#330000] opacity-50' : 'border-[#111]'}`}>
                        <div>
                          <p className="font-oswald text-lg text-white tracking-widest uppercase">{user.stage_name || 'UNKNOWN NODE'}</p>
                          <p className="text-[9px] font-mono text-[#555] uppercase mt-1">ID: {user.id.substring(0,8)} | TIER: {user.tier || 'FREE LOADER'}</p>
                        </div>
                        <div className="flex items-center gap-6">
                          <p className="font-mono text-xs text-green-500">${Number(user.wallet_balance || 0).toFixed(2)}</p>
                          {user.status !== "banned" ? (
                            <button onClick={() => handleBanUser(user.id)} className="bg-black border border-[#333] text-[#E60000] px-4 py-2 text-[9px] font-bold uppercase hover:bg-[#E60000] hover:text-white transition-colors"><Ban size={12} className="inline mr-1"/> Freeze</button>
                          ) : (
                            <span className="text-[9px] text-[#E60000] font-bold uppercase px-4 py-2 border border-[#330000] bg-[#110000]">Banned</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: CONTRACTS (escrow_contracts) */}
            {activeTab === "contracts" && (
              <div className="animate-in fade-in slide-in-from-bottom-4 bg-black border border-[#222] p-8 shadow-lg">
                <h3 className="font-oswald text-2xl uppercase tracking-widest text-white mb-6 border-b border-[#222] pb-4 flex items-center gap-3">
                  <FileText size={24} className="text-[#E60000]"/> Smart Escrow Contracts
                </h3>
                {contracts.length === 0 ? (
                  <div className="text-center p-12 border border-dashed border-[#222]"><p className="text-[#555] text-xs font-mono uppercase tracking-widest">No active escrows found in ledger.</p></div>
                ) : (
                  <div className="space-y-3">
                    {contracts.map(contract => (
                      <div key={contract.id} className="bg-[#050505] border border-[#111] p-4 flex justify-between items-center">
                        <div>
                          <p className="font-mono text-[10px] text-[#888] uppercase tracking-widest">Contract ID: {contract.id.substring(0,12)}</p>
                          <p className="font-oswald text-sm text-white uppercase tracking-widest mt-1">
                            Type: {contract.interaction_type || "Booking"}
                          </p>
                          <p className="font-mono text-[8px] text-[#555] uppercase mt-1">
                            Buyer: {contract.user_id.substring(0,8)} | Artist: {contract.artist_id.substring(0,8)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-sm text-yellow-500 font-bold">${Number(contract.amount || 0).toFixed(2)}</p>
                          <p className={`font-mono text-[9px] uppercase tracking-widest mt-1 ${contract.status === 'delivered' ? 'text-green-500' : 'text-[#E60000]'}`}>{contract.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: TRANSACTIONS */}
            {activeTab === "transactions" && (
              <div className="animate-in fade-in slide-in-from-bottom-4 bg-black border border-[#222] p-8 shadow-lg">
                <h3 className="font-oswald text-2xl uppercase tracking-widest text-white mb-6 border-b border-[#222] pb-4 flex items-center gap-3">
                  <CreditCard size={24} className="text-[#E60000]"/> Fiat Transactions
                </h3>
                {transactions.length === 0 ? (
                  <div className="text-center p-12 border border-dashed border-[#222]"><p className="text-[#555] text-xs font-mono uppercase tracking-widest">No financial data found in ledger.</p></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-[10px] uppercase tracking-widest border-collapse">
                      <thead>
                        <tr className="border-b border-[#222] text-[#555]">
                          <th className="pb-3 font-normal">Date</th>
                          <th className="pb-3 font-normal">Node ID</th>
                          <th className="pb-3 font-normal">Type</th>
                          <th className="pb-3 font-normal">Description</th>
                          <th className="pb-3 text-right font-normal">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map(t => (
                          <tr key={t.id} className="border-b border-[#111] hover:bg-[#050505] transition-colors">
                            <td className="py-4 text-[#888]">{new Date(t.created_at).toLocaleDateString()}</td>
                            <td className="py-4 text-[#888]">{t.user_id.substring(0,8)}</td>
                            <td className="py-4">
                              <span className={`px-2 py-1 border ${
                                t.type === 'deposit' || t.type === 'purchase' ? 'text-green-500 border-green-500/30' : 
                                t.type === 'withdrawal' ? 'text-[#E60000] border-[#E60000]/30' : 
                                'text-blue-400 border-blue-400/30'
                              }`}>
                                {t.type || 'transfer'}
                              </span>
                            </td>
                            <td className="py-4 text-[#aaa] truncate max-w-[200px]">{t.description || '-'}</td>
                            <td className={`py-4 text-right font-bold text-sm ${Number(t.amount) > 0 ? 'text-green-500' : 'text-white'}`}>
                              ${Math.abs(Number(t.amount || 0)).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: MESSAGES (global_messages) */}
            {activeTab === "messages" && (
              <div className="animate-in fade-in slide-in-from-bottom-4 bg-black border border-[#222] p-8 shadow-lg">
                <h3 className="font-oswald text-2xl uppercase tracking-widest text-white mb-6 border-b border-[#222] pb-4 flex items-center gap-3">
                  <MessageSquare size={24} className="text-[#E60000]"/> Global Comms Relay
                </h3>
                {messages.length === 0 ? (
                  <div className="text-center p-12 border border-dashed border-[#222]"><p className="text-[#555] text-xs font-mono uppercase tracking-widest">Comms channel is silent.</p></div>
                ) : (
                  <div className="space-y-4">
                    {messages.map(msg => (
                      <div key={msg.id} className="bg-[#050505] border-l-2 border-[#E60000] p-4">
                        <div className="flex justify-between items-center mb-2">
                          <p className="font-mono text-[9px] text-[#888] uppercase tracking-widest">
                            NODE: {msg.stage_name || msg.user_id?.substring(0,8) || 'SYSTEM'}
                          </p>
                          <p className="font-mono text-[8px] text-[#444] uppercase">{new Date(msg.created_at).toLocaleString()}</p>
                        </div>
                        <p className="font-mono text-xs text-white leading-relaxed">{msg.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}