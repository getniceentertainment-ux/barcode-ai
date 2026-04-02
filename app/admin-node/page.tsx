"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ShieldAlert, Activity, DollarSign, Users, Radio, 
  Ban, CheckCircle2, AlertTriangle, Terminal, Database, Server,
  Play, Pause, XCircle, BarChart, Clock, Music, UploadCloud, Loader2
} from "lucide-react";

import { supabase } from "../../lib/supabase";

const TELEMETRY = {
  totalRevenue: 142500.00,
  computeCosts: 18450.25,
  activeNodes: 3402,
  vaultTracks: 842,
  gpuStatus: "OPTIMAL",
  networkLoad: "78%"
};

const PLATFORM_USERS = [
  { id: "USER_77X", alias: "Neon Blood", tier: "The Mogul", balance: 1450.00, status: "active" },
  { id: "USER_492", alias: "Ghost_Node", tier: "Free Loader", balance: 0.00, status: "active" },
  { id: "USER_881", alias: "Scam_Bot_01", tier: "The Artist", balance: 5000.00, status: "flagged" },
];

interface Submission {
  id: string;
  user_id: string;
  title: string;
  audio_url: string;
  hit_score: number;
  status: string;
  created_at: string;
}

export default function AdminNode() {
  const router = useRouter();
  const CREATOR_ID = process.env.NEXT_PUBLIC_CREATOR_ID;

  // NEW: Authorization State Guard
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [activeTab, setActiveTab] = useState<"telemetry" | "anr" | "users">("telemetry");
  
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  
  const [users, setUsers] = useState(PLATFORM_USERS);

  // DIRECT INJECTION STATE
  const [extTitle, setExtTitle] = useState("");
  const [extScore, setExtScore] = useState(99);
  const [extFile, setExtFile] = useState<File | null>(null);
  const [isInjecting, setIsInjecting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // THE BOUNCER LOGIC
  useEffect(() => {
    const verifyGodMode = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session || session.user.id !== CREATOR_ID) {
        console.warn("UNAUTHORIZED ACCESS ATTEMPT DETECTED. EJECTING NODE.");
        router.replace('/'); 
        return;
      }
      
      setIsAuthorized(true);
      fetchSubmissions();
    };

    verifyGodMode();
  }, [router, CREATOR_ID]);

  const fetchSubmissions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (err) {
      console.error("Error fetching submissions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('submissions')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      setSubmissions(prev => prev.filter(sub => sub.id !== id));
    } catch (err) {
      console.error(`Error updating status to ${newStatus}:`, err);
      alert("Failed to update track status.");
    }
  };

  const handleInjectExternal = async () => {
    if (!extFile || !extTitle) return alert("Missing title or file.");
    setIsInjecting(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Admin identity not found. Please log in.");

      // 1. Upload to Supabase Public Audio Bucket
      const fileName = `external/${Date.now()}_${extFile.name.replace(/\s+/g, '_')}`;
      const { error: uploadError } = await supabase.storage
        .from('public_audio')
        .upload(fileName, extFile, { contentType: extFile.type });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('public_audio').getPublicUrl(fileName);

      // 2. Force-Inject into Submissions table as 'approved'
      const { error: dbError } = await supabase.from('submissions').insert([{
        user_id: session.user.id, // Auth ID matches current admin
        title: extTitle.toUpperCase(),
        audio_url: publicUrlData.publicUrl,
        hit_score: extScore,
        status: 'approved' // Bypasses pending queue
      }]);

      if (dbError) throw dbError;

      alert("External Asset Injected! Track is now live on Global Radio.");
      setExtTitle("");
      setExtFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      
    } catch (err: any) {
      console.error(err);
      alert(`Injection failed: ${err.message}`);
    } finally {
      setIsInjecting(false);
    }
  };

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

  const handleBanUser = (userId: string) => {
    setUsers(users.map(u => u.id === userId ? { ...u, status: "banned", balance: 0 } : u));
  };

  // THE FIREWALL RENDER
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center selection:bg-[#E60000]">
        <Loader2 className="animate-spin text-[#E60000]" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020202] text-white flex flex-col font-mono selection:bg-[#E60000]">
      
      <div className="bg-[#E60000] text-white p-2 text-center text-[10px] font-bold uppercase tracking-[0.4em] flex items-center justify-center gap-4 animate-pulse">
        <ShieldAlert size={14} /> Authorized Personnel Only // God Mode Active <ShieldAlert size={14} />
      </div>

      <div className="p-8 border-b border-[#222] bg-[#050505] flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white flex items-center gap-4">
            <Terminal size={32} className="text-[#E60000]" /> Admin Gateway
          </h1>
          <p className="text-[10px] text-[#888] uppercase tracking-[0.3em] mt-2">
            Global Telemetry // A&R Override // Ledger Management
          </p>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <button onClick={() => setActiveTab("telemetry")} className={`px-6 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all ${activeTab === 'telemetry' ? 'bg-[#E60000] border-[#E60000] text-white' : 'bg-black border-[#222] text-[#555] hover:border-white hover:text-white'}`}>
            Network Telemetry
          </button>
          <button onClick={() => setActiveTab("anr")} className={`px-6 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all ${activeTab === 'anr' ? 'bg-[#E60000] border-[#E60000] text-white' : 'bg-black border-[#222] text-[#555] hover:border-white hover:text-white'}`}>
            A&R Override
          </button>
          <button onClick={() => setActiveTab("users")} className={`px-6 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all ${activeTab === 'users' ? 'bg-[#E60000] border-[#E60000] text-white' : 'bg-black border-[#222] text-[#555] hover:border-white hover:text-white'}`}>
            User Mitigation
          </button>
          <Link href="/" className="flex items-center gap-2 bg-[#111] border border-[#333] px-6 py-2 font-oswald uppercase text-sm tracking-widest hover:bg-white hover:text-black transition-colors ml-auto">
            Return to Matrix
          </Link>
        </div>
      </div>

      <div className="flex-1 p-8 max-w-7xl mx-auto w-full">
        
        {/* TAB 1: TELEMETRY */}
        {activeTab === "telemetry" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-black border border-[#222] p-6 flex items-center gap-4">
                <Server size={32} className="text-green-500" />
                <div>
                  <p className="text-[10px] text-[#555] uppercase tracking-widest">Worker 1 (GPU)</p>
                  <p className="font-oswald text-xl text-white tracking-widest">{TELEMETRY.gpuStatus}</p>
                </div>
              </div>
              <div className="bg-black border border-[#222] p-6 flex items-center gap-4">
                <Activity size={32} className="text-yellow-500" />
                <div>
                  <p className="text-[10px] text-[#555] uppercase tracking-widest">Network Load</p>
                  <p className="font-oswald text-xl text-white tracking-widest">{TELEMETRY.networkLoad}</p>
                </div>
              </div>
              <div className="bg-black border border-[#222] p-6 flex items-center gap-4">
                <Database size={32} className="text-[#E60000]" />
                <div>
                  <p className="text-[10px] text-[#555] uppercase tracking-widest">Active Nodes</p>
                  <p className="font-oswald text-xl text-white tracking-widest">{TELEMETRY.activeNodes}</p>
                </div>
              </div>
            </div>

            <div className="bg-[#050505] border border-[#222] p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#E60000] opacity-5 blur-[100px] rounded-full"></div>
              <h3 className="font-oswald text-2xl uppercase tracking-widest text-white mb-8 border-b border-[#222] pb-4 flex items-center gap-3">
                <DollarSign size={24} className="text-green-500" /> Global Treasury (Stripe)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div>
                  <p className="text-[10px] text-[#888] uppercase tracking-widest mb-2">Gross Platform Revenue</p>
                  <p className="font-oswald text-6xl font-bold text-green-500 tracking-tighter">${TELEMETRY.totalRevenue.toLocaleString()}</p>
                  <div className="flex gap-4 mt-4"><span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-1 uppercase">+12.4% vs Last Month</span></div>
                </div>
                <div className="space-y-6">
                  <div className="flex justify-between items-center border-b border-[#222] pb-4">
                     <span className="text-xs text-[#555] uppercase tracking-widest">RunPod / GPU Compute Costs</span>
                     <span className="text-lg font-oswald text-[#E60000]">-${TELEMETRY.computeCosts.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-[#222] pb-4">
                     <span className="text-xs text-[#555] uppercase tracking-widest">Sync Vault Royalty Escrow</span>
                     <span className="text-lg font-oswald text-white">$45,200.00</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                     <span className="text-xs text-[#E60000] uppercase tracking-widest font-bold">Net Treasury Margin</span>
                     <span className="text-2xl font-oswald text-white font-bold">76.4%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: A&R OVERRIDE & DIRECT RADIO INJECTION */}
        {activeTab === "anr" && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            
            {/* DIRECT INJECTION NODE (CEO SEEDING) */}
            <div className="bg-[#110000] border border-[#E60000]/50 p-6 mb-8 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#E60000] text-white text-[8px] font-bold uppercase tracking-widest px-2 py-1">CEO Tool</div>
              <h3 className="font-oswald text-xl uppercase tracking-widest text-[#E60000] mb-2 flex items-center gap-2">
                <UploadCloud size={20} /> Direct Radio Injection
              </h3>
              <p className="text-[10px] text-[#888] uppercase tracking-widest mb-6">Bypass Matrix protocols and force external MP3/WAV assets directly onto Global Radio.</p>
              
              <div className="flex flex-col md:flex-row gap-4 items-end">
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
                  <label htmlFor="ext-upload" className="w-full bg-black border border-[#333] p-3 text-xs text-white cursor-pointer hover:border-white transition-colors block text-center truncate">
                    {extFile ? extFile.name : "Select External Audio File"}
                  </label>
                </div>
                <button onClick={handleInjectExternal} disabled={isInjecting || !extFile || !extTitle} className="w-full md:w-auto bg-[#E60000] text-white px-8 py-3 text-xs font-bold uppercase tracking-widest hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {isInjecting ? <><Loader2 size={14} className="animate-spin" /> Injecting...</> : 'Force Inject'}
                </button>
              </div>
            </div>

            <div className="bg-black border border-[#222] p-8">
              <h3 className="font-oswald text-2xl uppercase tracking-widest text-[#E60000] mb-2 flex items-center gap-3">
                <Radio size={24} /> Live A&R Broadcast Queue
              </h3>
              <p className="text-[10px] text-[#888] uppercase tracking-widest mb-8 border-b border-[#222] pb-4">
                Review pending submissions generated by user nodes.
              </p>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64 opacity-50">
                  <div className="w-8 h-8 border-2 border-[#E60000] border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="font-mono text-[10px] uppercase tracking-widest">Querying Blockchain Ledger...</p>
                </div>
              ) : submissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 border border-dashed border-[#222] bg-[#0a0a0a]">
                  <Music size={48} className="text-[#333] mb-4" />
                  <p className="font-oswald text-xl uppercase tracking-widest text-[#555]">A&R Queue is Empty</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#444] mt-2">No pending tracks require review.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions.map(sub => (
                    <div key={sub.id} className="bg-[#050505] border border-[#111] p-6 flex flex-col md:flex-row items-center justify-between gap-6 group hover:border-[#333] transition-colors">
                      <audio id={`audio-${sub.id}`} src={sub.audio_url} onEnded={() => setPlayingId(null)} className="hidden" />
                      <div className="flex items-center gap-6 w-full md:w-auto">
                        <button onClick={() => togglePlay(sub.id)} className={`w-14 h-14 shrink-0 rounded-full flex items-center justify-center transition-all ${playingId === sub.id ? 'bg-[#E60000] text-white shadow-[0_0_20px_rgba(230,0,0,0.4)]' : 'bg-[#111] text-[#E60000] hover:bg-white hover:text-black'}`}>
                          {playingId === sub.id ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
                        </button>
                        <div className="overflow-hidden">
                          <h3 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white truncate">{sub.title}</h3>
                          <div className="flex items-center gap-4 mt-1 font-mono text-[10px] text-[#888] uppercase tracking-widest">
                            <span className="flex items-center gap-1"><Clock size={12} /> {new Date(sub.created_at).toLocaleDateString()}</span>
                            <span className="text-[#555]">ID: {sub.user_id.substring(0, 8)}...</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                        <div className="flex flex-col items-center justify-center px-6 border-x border-[#222]">
                          <span className="text-[9px] font-mono text-[#555] uppercase tracking-widest mb-1 flex items-center gap-1"><BarChart size={10} /> Hit Score</span>
                          <span className={`font-oswald text-2xl font-bold ${sub.hit_score >= 80 ? 'text-green-500' : sub.hit_score >= 65 ? 'text-yellow-500' : 'text-[#E60000]'}`}>{sub.hit_score}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => handleStatusUpdate(sub.id, 'rejected')} className="bg-[#110000] text-[#E60000] border border-[#E60000]/30 hover:bg-[#E60000] hover:text-white px-4 py-3 font-oswald text-sm uppercase tracking-widest font-bold transition-all flex items-center gap-2"><XCircle size={16} /> Reject</button>
                          <button onClick={() => handleStatusUpdate(sub.id, 'approved')} className="bg-green-500/10 text-green-500 border border-green-500/30 hover:bg-green-500 hover:text-black px-4 py-3 font-oswald text-sm uppercase tracking-widest font-bold transition-all flex items-center gap-2"><CheckCircle2 size={16} /> Approve</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: USER MITIGATION */}
        {activeTab === "users" && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-black border border-[#222] p-8">
              <h3 className="font-oswald text-2xl uppercase tracking-widest text-[#E60000] mb-2 flex items-center gap-3">
                <Ban size={24} /> Threat Mitigation // User Ledger
              </h3>
              <p className="text-[10px] text-[#888] uppercase tracking-widest mb-8 border-b border-[#222] pb-4">
                Freeze wallets, seize funds, and revoke Matrix access for TOS violations.
              </p>
              <div className="space-y-4">
                {users.map(user => (
                  <div key={user.id} className={`bg-[#050505] border p-4 flex items-center justify-between transition-colors ${user.status === 'banned' ? 'border-[#330000] opacity-50' : user.status === 'flagged' ? 'border-yellow-500/30' : 'border-[#111] hover:border-[#333]'}`}>
                    <div className="flex items-center gap-6">
                      <div className="w-10 h-10 bg-[#111] flex items-center justify-center border border-[#222]"><Users size={16} className={user.status === 'banned' ? 'text-red-500' : 'text-[#888]'} /></div>
                      <div>
                        <div className="flex items-center gap-3"><p className="font-oswald text-lg text-white tracking-widest uppercase">{user.alias}</p>{user.status === "flagged" && <AlertTriangle size={12} className="text-yellow-500" />}</div>
                        <p className="text-[10px] text-[#555] uppercase">ID: {user.id} // Tier: {user.tier}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-right hidden md:block">
                        <p className="text-[9px] text-[#888] uppercase tracking-widest">Ledger Balance</p>
                        <p className={`font-mono text-sm ${user.status === 'banned' ? 'text-[#555] line-through' : 'text-green-500'}`}>${user.balance.toFixed(2)}</p>
                      </div>
                      {user.status !== "banned" ? (
                        <button onClick={() => handleBanUser(user.id)} className="border border-[#333] text-[#E60000] px-6 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-colors flex items-center gap-2"><Ban size={12} /> Freeze & Ban</button>
                      ) : (
                        <span className="text-[10px] uppercase tracking-widest text-[#E60000] font-bold px-6 py-2 border border-[#330000] bg-[#110000]">Access Revoked</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}