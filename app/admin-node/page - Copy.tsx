"use client";

import React, { useState } from "react";
import { 
  ShieldAlert, Activity, DollarSign, Users, Radio, 
  Ban, CheckCircle2, AlertTriangle, Terminal, Database, Server
} from "lucide-react";

// Mock Data for Admin Dashboard
const TELEMETRY = {
  totalRevenue: 142500.00,
  computeCosts: 18450.25,
  activeNodes: 3402,
  vaultTracks: 842,
  gpuStatus: "OPTIMAL",
  networkLoad: "78%"
};

const PENDING_TRACKS = [
  { id: "TRK_992", title: "MATRIX INFILTRATION", user: "USER_77X", score: 92, status: "pending" },
  { id: "TRK_841", title: "CHROME HEARTS", user: "AURA_SYNTH", score: 88, status: "pending" },
  { id: "TRK_773", title: "BLOCK RUNNER", user: "BASE_GOD", score: 65, status: "pending" },
];

const PLATFORM_USERS = [
  { id: "USER_77X", alias: "Neon Blood", tier: "The Mogul", balance: 1450.00, status: "active" },
  { id: "USER_492", alias: "Ghost_Node", tier: "Free Node", balance: 0.00, status: "active" },
  { id: "USER_881", alias: "Scam_Bot_01", tier: "The Artist", balance: 5000.00, status: "flagged" },
];

export default function AdminNode() {
  const [activeTab, setActiveTab] = useState<"telemetry" | "anr" | "users">("telemetry");
  
  // Local state for actions to show UI updates
  const [tracks, setTracks] = useState(PENDING_TRACKS);
  const [users, setUsers] = useState(PLATFORM_USERS);

  const handleForceBroadcast = (trackId: string) => {
    setTracks(tracks.map(t => t.id === trackId ? { ...t, status: "broadcasted" } : t));
  };

  const handleRejectTrack = (trackId: string) => {
    setTracks(tracks.map(t => t.id === trackId ? { ...t, status: "rejected" } : t));
  };

  const handleBanUser = (userId: string) => {
    setUsers(users.map(u => u.id === userId ? { ...u, status: "banned", balance: 0 } : u));
  };

  return (
    <div className="min-h-screen bg-[#020202] text-white flex flex-col font-mono selection:bg-[#E60000]">
      
      {/* GOD MODE HEADER */}
      <div className="bg-[#E60000] text-white p-2 text-center text-[10px] font-bold uppercase tracking-[0.4em] flex items-center justify-center gap-4 animate-pulse">
        <ShieldAlert size={14} /> Authorized Personnel Only // God Mode Active <ShieldAlert size={14} />
      </div>

      <div className="p-8 border-b border-[#222] bg-[#050505] flex justify-between items-end">
        <div>
          <h1 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white flex items-center gap-4">
            <Terminal size={32} className="text-[#E60000]" /> Admin Gateway
          </h1>
          <p className="text-[10px] text-[#888] uppercase tracking-[0.3em] mt-2">
            Global Telemetry // A&R Override // Ledger Management
          </p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setActiveTab("telemetry")}
            className={`px-6 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all ${activeTab === 'telemetry' ? 'bg-[#E60000] border-[#E60000] text-white' : 'bg-black border-[#222] text-[#555] hover:border-white hover:text-white'}`}
          >
            Network Telemetry
          </button>
          <button 
            onClick={() => setActiveTab("anr")}
            className={`px-6 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all ${activeTab === 'anr' ? 'bg-[#E60000] border-[#E60000] text-white' : 'bg-black border-[#222] text-[#555] hover:border-white hover:text-white'}`}
          >
            A&R Override
          </button>
          <button 
            onClick={() => setActiveTab("users")}
            className={`px-6 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all ${activeTab === 'users' ? 'bg-[#E60000] border-[#E60000] text-white' : 'bg-black border-[#222] text-[#555] hover:border-white hover:text-white'}`}
          >
            User Mitigation
          </button>
        </div>
      </div>

      <div className="flex-1 p-8 max-w-7xl mx-auto w-full">
        
        {/* TAB 1: TELEMETRY & TREASURY */}
        {activeTab === "telemetry" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            
            {/* Server Status */}
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

            {/* Financial Ledger */}
            <div className="bg-[#050505] border border-[#222] p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#E60000] opacity-5 blur-[100px] rounded-full"></div>
              
              <h3 className="font-oswald text-2xl uppercase tracking-widest text-white mb-8 border-b border-[#222] pb-4 flex items-center gap-3">
                <DollarSign size={24} className="text-green-500" /> Global Treasury (Stripe)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div>
                  <p className="text-[10px] text-[#888] uppercase tracking-widest mb-2">Gross Platform Revenue</p>
                  <p className="font-oswald text-6xl font-bold text-green-500 tracking-tighter">
                    ${TELEMETRY.totalRevenue.toLocaleString()}
                  </p>
                  <div className="flex gap-4 mt-4">
                    <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-1 uppercase">+12.4% vs Last Month</span>
                  </div>
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

        {/* TAB 2: A&R OVERRIDE */}
        {activeTab === "anr" && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-black border border-[#222] p-8">
              <h3 className="font-oswald text-2xl uppercase tracking-widest text-[#E60000] mb-2 flex items-center gap-3">
                <Radio size={24} /> A&R Broadcast Override
              </h3>
              <p className="text-[10px] text-[#888] uppercase tracking-widest mb-8 border-b border-[#222] pb-4">
                Manually push high-scoring tracks to the GetNice Nation FM Stream or Vault.
              </p>

              <div className="space-y-4">
                {tracks.map(track => (
                  <div key={track.id} className="bg-[#050505] border border-[#111] p-4 flex items-center justify-between group hover:border-[#333] transition-colors">
                    <div className="flex items-center gap-6">
                      <div className={`w-12 h-12 flex items-center justify-center font-oswald text-xl font-bold ${track.score >= 85 ? 'bg-green-500/10 text-green-500 border border-green-500/30' : 'bg-[#111] text-[#888]'}`}>
                        {track.score}
                      </div>
                      <div>
                        <p className="font-oswald text-lg text-white tracking-widest uppercase">{track.title}</p>
                        <p className="text-[10px] text-[#555] uppercase">Node: {track.user} // ID: {track.id}</p>
                      </div>
                    </div>

                    {track.status === "pending" ? (
                      <div className="flex gap-3">
                        <button onClick={() => handleForceBroadcast(track.id)} className="bg-white text-black px-6 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-green-500 hover:text-white transition-colors flex items-center gap-2">
                          <Radio size={12} /> Force Broadcast
                        </button>
                        <button onClick={() => handleRejectTrack(track.id)} className="border border-[#333] text-[#555] px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:border-[#E60000] hover:text-[#E60000] transition-colors">
                          Reject
                        </button>
                      </div>
                    ) : track.status === "broadcasted" ? (
                      <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-green-500 font-bold bg-green-500/10 px-4 py-2">
                        <CheckCircle2 size={14} /> Live on FM
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-widest text-[#555] font-bold px-4 py-2 border border-[#222]">
                        Rejected
                      </span>
                    )}
                  </div>
                ))}
              </div>
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
                  <div key={user.id} className={`bg-[#050505] border p-4 flex items-center justify-between transition-colors
                    ${user.status === 'banned' ? 'border-[#330000] opacity-50' : user.status === 'flagged' ? 'border-yellow-500/30' : 'border-[#111] hover:border-[#333]'}`}>
                    
                    <div className="flex items-center gap-6">
                      <div className="w-10 h-10 bg-[#111] flex items-center justify-center border border-[#222]">
                        <Users size={16} className={user.status === 'banned' ? 'text-red-500' : 'text-[#888]'} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <p className="font-oswald text-lg text-white tracking-widest uppercase">{user.alias}</p>
                          {user.status === "flagged" && <AlertTriangle size={12} className="text-yellow-500" />}
                        </div>
                        <p className="text-[10px] text-[#555] uppercase">ID: {user.id} // Tier: {user.tier}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="text-right hidden md:block">
                        <p className="text-[9px] text-[#888] uppercase tracking-widest">Ledger Balance</p>
                        <p className={`font-mono text-sm ${user.status === 'banned' ? 'text-[#555] line-through' : 'text-green-500'}`}>
                          ${user.balance.toFixed(2)}
                        </p>
                      </div>
                      
                      {user.status !== "banned" ? (
                        <button 
                          onClick={() => handleBanUser(user.id)} 
                          className="border border-[#333] text-[#E60000] px-6 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-colors flex items-center gap-2"
                        >
                          <Ban size={12} /> Freeze & Ban
                        </button>
                      ) : (
                        <span className="text-[10px] uppercase tracking-widest text-[#E60000] font-bold px-6 py-2 border border-[#330000] bg-[#110000]">
                          Access Revoked
                        </span>
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