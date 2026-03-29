"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, ShieldCheck, Lock, RefreshCw, Mail, Share2, Server, UserCog, Calendar, CheckCircle2, Play, Terminal, Cpu, ArrowRight, Zap } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function Room11_Exec() {
  const { userSession, addToast, setActiveRoom } = useMatrixStore();
  
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<any>(null);
  const [isPollingLedger, setIsPollingLedger] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [executingDay, setExecutingDay] = useState<number | null>(null);
  const [execLogs, setExecLogs] = useState<string[]>([]);
  
  useEffect(() => {
    if (!userSession?.id) return;
    const params = new URLSearchParams(window.location.search);
    const rolloutPurchased = params.get('rollout_purchased');
    const trackId = params.get('track_id') || params.get('trackId');

    if (rolloutPurchased === 'true' && trackId) {
      setIsPollingLedger(true);
      const poll = setInterval(async () => {
        // SURGICAL FIX: Polling the new exec_bypass trump card
        const { data } = await supabase.from('submissions').select('upstream_deal_signed, exec_bypass').eq('id', trackId).single();
        if (data?.upstream_deal_signed || data?.exec_bypass) {
          clearInterval(poll); setIsPollingLedger(false);
          window.history.replaceState({}, document.title, window.location.pathname);
          fetchActiveCampaign();
        }
      }, 2000);
      setTimeout(() => { clearInterval(poll); setIsPollingLedger(false); fetchActiveCampaign(); }, 15000);
      return () => clearInterval(poll);
    }
    fetchActiveCampaign();
  }, [userSession]);

  const fetchActiveCampaign = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('submissions').select('*').eq('user_id', userSession?.id).order('created_at', { ascending: false }).limit(1).single();
      setCampaign(data);
      if (data?.campaign_day) setSelectedDay(data.campaign_day);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    // SURGICAL FIX: The Trump Card bypasses the lockout and forces the AI to populate campaign_data
    if (campaign && (campaign.upstream_deal_signed || campaign.exec_bypass || campaign.rollout_purchased)) {
        const hasData = campaign.campaign_data?.daily_schedule && campaign.campaign_data.daily_schedule.length > 0;
        if (!hasData && !isSynthesizing) triggerSelfHealing(campaign.id);
    }
  }, [campaign]);

  const triggerSelfHealing = async (trackId: string) => {
    setIsSynthesizing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/campaign/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ trackId })
      });
      await fetchActiveCampaign();
      if (addToast) addToast("AI Strategy Synthesis Complete.", "success");
    } finally { setIsSynthesizing(false); }
  };

  const handleExecuteDay = async (day: number, taskData: any) => {
    if (!campaign) return;
    setExecutingDay(day);
    setExecLogs([`[SYSTEM] Initializing Node Directive for Day ${day}...`]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/campaign/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ trackId: campaign.id, taskData, day })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExecLogs(prev => [...prev, ...data.logs]);
      fetchActiveCampaign();
    } catch (err: any) { setExecLogs(prev => [...prev, `[ERROR] ${err.message}`]); }
    finally { setTimeout(() => setExecutingDay(null), 5000); }
  };

  if (isPollingLedger) return <div className="h-full flex flex-col items-center justify-center bg-[#0a0a0a]"><Loader2 size={64} className="text-[#E60000] animate-spin mb-6" /><h2 className="text-white font-oswald text-3xl uppercase">Syncing Ledger...</h2></div>;
  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-[#E60000]" size={48} /></div>;
  
  // THE MASTER LOCK: Only allows entry if deal is signed OR bypass is true
  if (!campaign || (!campaign.upstream_deal_signed && !campaign.exec_bypass && !campaign.rollout_purchased)) return (
    <div className="h-full flex flex-col items-center justify-center opacity-40">
      <Lock size={64} className="mb-6" /><h3 className="text-white font-oswald text-3xl uppercase">Locked</h3>
      <button onClick={() => setActiveRoom("07")} className="bg-white text-black px-8 py-3 mt-4 text-[10px] font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white">Unlock in Room 07</button>
    </div>
  );

  const hasData = campaign.campaign_data?.daily_schedule && campaign.campaign_data.daily_schedule.length > 0;
  if (isSynthesizing || !hasData) return <div className="h-full flex flex-col items-center justify-center text-center"><Cpu size={64} className="text-[#E60000] animate-pulse mb-6" /><h3 className="text-white font-oswald text-3xl uppercase">Synthesizing Strategy...</h3><p className="font-mono text-[10px] text-[#888] uppercase mt-2">Populating Campaign Data</p></div>;

  const schedule = campaign.campaign_data.daily_schedule || [];
  const currentDay = campaign.campaign_day || 1;
  const activeTask = schedule[selectedDay - 1] || schedule[0];

  return (
    <div className="h-full flex flex-col max-w-6xl mx-auto animate-in fade-in duration-500">
       <div className="flex justify-between items-end mb-8 border-b border-[#222] pb-6">
         <div><h2 className="font-oswald text-4xl uppercase text-white font-bold flex items-center gap-3"><Terminal size={32} className="text-[#E60000]" /> Command Center</h2><p className="font-mono text-[10px] text-[#888] uppercase mt-2">The Exec // {campaign.upstream_deal_signed ? 'Partner' : 'Independent Bypass'}</p></div>
         <div className="text-right"><p className="text-white font-oswald text-2xl">DAY {currentDay} / 30</p></div>
       </div>
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 pb-8">
          <div className="lg:col-span-1 bg-black border border-[#222] flex flex-col overflow-hidden">
             <div className="p-4 bg-black border-b border-[#222] flex items-center gap-2"><Calendar size={16} className="text-[#E60000]" /><span className="font-oswald text-sm uppercase text-[#888]">Timeline</span></div>
             <div className="flex-1 overflow-y-auto p-2 space-y-1">{schedule.map((task: any) => (
               <button key={task.day} onClick={() => setSelectedDay(task.day)} className={`w-full text-left p-3 flex items-center gap-3 border transition-colors ${task.day === selectedDay ? 'bg-[#110000] border-[#E60000]' : 'bg-black border-transparent'}`}>
                 <div className={`w-6 h-6 flex items-center justify-center border ${task.day < currentDay ? 'text-green-500 border-green-500' : task.day === currentDay ? 'bg-[#E60000] text-white border-[#E60000]' : 'text-[#444] border-[#333]'}`}>{task.day < currentDay ? <CheckCircle2 size={12}/> : task.day}</div>
                 <p className={`font-oswald text-xs uppercase ${task.day === selectedDay ? 'text-white' : 'text-[#888]'}`}>{task.objective}</p>
               </button>
             ))}</div>
          </div>
          <div className="lg:col-span-2 bg-[#050505] border border-[#222] flex flex-col overflow-hidden relative p-8 space-y-6">
             <div><span className="text-[#E60000] font-oswald text-3xl font-bold">DAY {activeTask.day}</span><h3 className="font-oswald text-xl text-white uppercase tracking-widest">{activeTask.objective}</h3></div>
             <div className="bg-black border border-[#222] p-5"><p className="text-[10px] text-[#888] uppercase font-bold mb-2">Directive</p><p className="text-sm font-mono text-gray-300">{activeTask.action_item}</p></div>
             <div className="bg-black border border-[#222] p-5"><p className="text-[10px] text-[#888] uppercase font-bold mb-2">Asset Copy</p><p className="text-xs font-mono text-[#E60000] border-l-2 border-[#E60000] pl-3 italic">"{activeTask.generated_copy}"</p></div>
             {executingDay === activeTask.day && <div className="bg-black border border-[#333] p-4 font-mono text-[10px] text-gray-400 h-40 overflow-y-auto">{execLogs.map((log, i) => <div key={i} className={log.includes('ERROR') ? 'text-red-500' : ''}>{'>'} {log}</div>)}</div>}
             <div className="mt-auto pt-6 border-t border-[#222]">
               {activeTask.day === currentDay ? <button onClick={() => handleExecuteDay(activeTask.day, activeTask)} disabled={executingDay !== null} className="w-full bg-[#E60000] text-white py-5 font-oswald text-lg font-bold uppercase hover:bg-red-700 transition-all flex justify-center items-center gap-3 disabled:opacity-50">{executingDay !== null ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} />} Execute Directive</button> : <div className="text-center font-mono text-[10px] uppercase text-[#555] py-4">{activeTask.day < currentDay ? "Executed" : "Locked"}</div>}
             </div>
          </div>
       </div>
    </div>
  );
}