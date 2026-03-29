"use client";

import React, { useState, useEffect } from "react";
import { Activity, Calendar, ShieldCheck, Zap, ArrowRight, Loader2, FileText, Send, BrainCircuit, Target, CheckCircle2, ChevronRight, RefreshCw, Mail, Share2, UserCog, Server, Terminal } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function Room11_Contracts() {
  const { userSession, addToast, setActiveRoom } = useMatrixStore();
  
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [submission, setSubmission] = useState<any>(null);
  const [campaignData, setCampaignData] = useState<any>(null);
  const [currentDay, setCurrentDay] = useState<number>(0);
  const [totalStreams, setTotalStreams] = useState<number>(0);

  const [isExecuting, setIsExecuting] = useState(false);
  const [execLogs, setExecLogs] = useState<string[]>([]);

  useEffect(() => {
    fetchActiveCampaign();
  }, [userSession]);

  const fetchActiveCampaign = async () => {
    if (!userSession?.id) return;
    setLoading(true);
    try {
      const { data: subData } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', userSession.id)
        .eq('upstream_deal_signed', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subData) {
        setSubmission(subData);
        if (subData.campaign_data && Object.keys(subData.campaign_data).length > 0) {
          setCampaignData(subData.campaign_data);
          setCurrentDay(subData.campaign_day || 1);
          calculateStreams(subData.campaign_data, subData.campaign_day || 1);
        }
      }
    } catch (err) {
      console.error("Campaign fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStreams = (data: any, day: number) => {
    let spent = 0;
    if (data?.daily_schedule) {
      for (let i = 0; i < day; i++) {
        if (data.daily_schedule[i]) {
          spent += data.daily_schedule[i].auto_ad_spend || 0;
        }
      }
    }
    setTotalStreams(Math.floor(spent * 14.5) + (day * 125));
  };

  // --- SURGICAL FIX: Bulletproof Response Parsing ---
  const handleInitializeCampaign = async () => {
    if (!submission?.id) return;
    setInitializing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/campaign/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ trackId: submission.id })
      });

      // Trap Vercel HTML timeout pages securely
      const rawText = await res.text();
      let json;
      try {
        json = JSON.parse(rawText);
      } catch (parseErr) {
        throw new Error("Server Exception: The AI request timed out. Please try again.");
      }

      if (!res.ok) throw new Error(json.error || "Initialization failed");

      setCampaignData(json.data);
      setCurrentDay(1);
      calculateStreams(json.data, 1);
      if(addToast) addToast("The Exec has mapped your 30-Day Campaign.", "success");
    } catch (err: any) {
      if(addToast) addToast(err.message, "error");
    } finally {
      setInitializing(false);
    }
  };

  // --- SURGICAL FIX: Bulletproof Response Parsing ---
  const handleRegenerate = async () => {
    if (!submission?.id) return;
    if (!confirm("This will wipe your current timeline and regenerate a fresh framework. Proceed?")) return;
    
    setInitializing(true);
    try {
      await supabase.from('submissions').update({ campaign_data: {}, campaign_day: 0 }).eq('id', submission.id);
      
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/campaign/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ trackId: submission.id })
      });

      // Trap Vercel HTML timeout pages securely
      const rawText = await res.text();
      let json;
      try {
        json = JSON.parse(rawText);
      } catch (parseErr) {
        throw new Error("Server Exception: The AI request timed out. Please try again.");
      }

      if (!res.ok) throw new Error(json.error || "Initialization failed");

      setCampaignData(json.data);
      setCurrentDay(1);
      calculateStreams(json.data, 1);
      if(addToast) addToast("Campaign Regenerated with newest Neural framework.", "success");
    } catch(err: any) {
      if(addToast) addToast(err.message, "error");
    } finally {
      setInitializing(false);
    }
  };

  const handleAdvanceDay = async () => {
    if (!submission?.id || currentDay >= 30) return;
    
    const todayData = campaignData?.daily_schedule?.[currentDay - 1];
    const nextDay = currentDay + 1;

    if (!todayData) return;

    setIsExecuting(true);
    setExecLogs(["[SYSTEM] Initiating Agentic Execution Sequence..."]);
    
    const addLog = (msg: string) => setExecLogs(prev => [...prev, msg]);
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    try {
      const execType = todayData.execution_type || "manual_action";
      
      await sleep(800);
      addLog(`[NODE] Reading Day ${currentDay} Directives...`);
      await sleep(1000);

      addLog(`[SYSTEM] Authenticating secure API connection...`);
      const { data: { session } } = await supabase.auth.getSession();
      
      const execRes = await fetch('/api/campaign/execute', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ 
          trackId: submission.id,
          taskData: todayData,
          day: currentDay
        })
      });

      const execData = await execRes.json();
      
      if (!execRes.ok) {
        throw new Error(execData.error || "Backend Execution Failed.");
      }

      if (execData.logs && Array.isArray(execData.logs)) {
        for (const log of execData.logs) {
          addLog(log);
          await sleep(800);
        }
      }

      await sleep(1000);
      addLog("[SYSTEM] Synchronizing ledger...");
      await sleep(800);

      const updatedCampaign = JSON.parse(JSON.stringify(campaignData));
      if (updatedCampaign?.daily_schedule && Array.isArray(updatedCampaign.daily_schedule)) {
        if (updatedCampaign.daily_schedule[currentDay - 1]) {
           updatedCampaign.daily_schedule[currentDay - 1].status = "completed";
        }
      }

      const { error: updateErr } = await supabase
        .from('submissions')
        .update({ 
          campaign_day: nextDay,
          campaign_data: updatedCampaign 
        })
        .eq('id', submission.id);

      if (updateErr) throw new Error(updateErr.message);

      addLog("[SYSTEM] Operations Concluded. Advancing Timeline.");
      await sleep(1500); 
      
      setCampaignData(updatedCampaign);
      setCurrentDay(nextDay);
      calculateStreams(updatedCampaign, nextDay);
      
      if (todayData.auto_ad_spend > 0) {
         useMatrixStore.setState((state) => ({ 
           userSession: state.userSession ? { 
             ...state.userSession, 
             marketingCredits: (state.userSession as any).marketingCredits - todayData.auto_ad_spend 
           } as any : null 
         }));
      }

    } catch (err: any) {
      console.error("Advance Day Error:", err);
      addLog(`[FATAL] Execution Failed: ${err.message}`);
      if (addToast) addToast(`System Failed: ${err.message}`, "error");
      await sleep(3000);
    } finally {
      setIsExecuting(false);
      setExecLogs([]);
    }
  };

  const renderNoDeal = () => (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center border border-dashed border-[#333] opacity-60">
      <ShieldCheck size={64} className="text-[#555] mb-6" />
      <h2 className="font-oswald text-3xl uppercase tracking-widest text-white mb-2">No Active Operations</h2>
      <p className="font-mono text-xs text-[#888] uppercase tracking-widest leading-relaxed max-w-lg mb-8">
        The AI Label Manager requires an active Upstream Deal. Score 90+ in Distribution and execute the contract in The Bank to unlock automated campaign execution.
      </p>
      <button onClick={() => setActiveRoom("08")} className="bg-[#111] border border-[#333] text-white px-8 py-3 text-[10px] font-bold uppercase tracking-widest hover:border-white transition-all">
        Check Vault Eligibility
      </button>
    </div>
  );

  const getExecutionBadge = (type: string) => {
    switch(type) {
      case 'auto_email': return <span className="bg-blue-500/10 text-blue-500 border border-blue-500/30 px-3 py-1 text-[9px] uppercase font-bold tracking-widest flex items-center gap-2 w-fit"><Mail size={12}/> System: Auto-Email</span>;
      case 'social_post': return <span className="bg-purple-500/10 text-purple-500 border border-purple-500/30 px-3 py-1 text-[9px] uppercase font-bold tracking-widest flex items-center gap-2 w-fit"><Share2 size={12}/> System: Auto-Post</span>;
      case 'auto_ad_spend': return <span className="bg-green-500/10 text-green-500 border border-green-500/30 px-3 py-1 text-[9px] uppercase font-bold tracking-widest flex items-center gap-2 w-fit"><Server size={12}/> System: Ad Deploy</span>;
      case 'manual_action':
      default: return <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 px-3 py-1 text-[9px] uppercase font-bold tracking-widest flex items-center gap-2 w-fit"><UserCog size={12}/> Manual Action Required</span>;
    }
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-[#E60000]" size={48} /></div>;
  }

  if (!submission) return renderNoDeal();

  if (!campaignData) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[#0a0a0a] border border-[#E60000]/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#E60000]/10 via-transparent to-transparent pointer-events-none" />
        <BrainCircuit size={64} className="text-[#E60000] mb-6 animate-pulse" />
        <h2 className="font-oswald text-4xl uppercase tracking-widest text-white mb-4 font-bold relative z-10">Upstream Deal Detected</h2>
        <p className="font-mono text-[10px] text-[#aaa] uppercase tracking-widest leading-relaxed max-w-xl mb-10 relative z-10">
          Artifact: {submission.title} <br/><br/>
          Your track is secured. The Exec AI is ready to ingest your artifact and map out a strict 30-Day Marketing Framework. This will automate your $1,500 advance deployment and generate your daily deliverables.
        </p>
        <button 
          onClick={handleInitializeCampaign}
          disabled={initializing}
          className="bg-[#E60000] text-white px-12 py-5 font-oswald text-lg font-bold uppercase tracking-[0.2em] hover:bg-red-700 transition-all flex items-center justify-center gap-3 relative z-10 shadow-[0_0_30px_rgba(230,0,0,0.3)]"
        >
          {initializing ? <Loader2 size={24} className="animate-spin" /> : <><Zap size={24} /> Initialize AI Campaign Manager</>}
        </button>
      </div>
    );
  }

  const todayTask = campaignData?.daily_schedule?.[currentDay - 1];
  const phaseTitle = currentDay <= 10 ? campaignData.phases?.phase_1 : currentDay <= 20 ? campaignData.phases?.phase_2 : campaignData.phases?.phase_3;

  return (
    <div className="h-full flex flex-col bg-[#050505] animate-in fade-in duration-500 overflow-hidden border border-[#222] relative">
      
      {isExecuting && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-in fade-in">
          <div className="max-w-2xl w-full bg-[#050505] border border-[#333] p-8 shadow-[0_0_50px_rgba(230,0,0,0.15)] font-mono rounded-sm">
             <div className="flex items-center gap-3 mb-6 border-b border-[#222] pb-4">
               <Terminal size={20} className="text-[#E60000]" />
               <h3 className="text-white uppercase tracking-widest text-sm font-bold">Agentic Execution Terminal</h3>
               <Loader2 size={14} className="text-[#E60000] animate-spin ml-auto" />
             </div>
             <div className="space-y-4 min-h-[200px] flex flex-col justify-end">
               {execLogs.map((log, i) => (
                 <p key={i} className="text-xs text-green-500 tracking-widest animate-in slide-in-from-bottom-2 fade-in">
                   <span className="text-[#555] mr-2">{'>'}</span> {log}
                 </p>
               ))}
               <p className="text-xs text-green-500 tracking-widest animate-pulse mt-2">
                 <span className="text-[#555] mr-2">{'>'}</span> _
               </p>
             </div>
          </div>
        </div>
      )}

      {/* HEADER: COMMAND CENTER */}
      <div className="p-8 border-b border-[#222] bg-black flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative">
        <div className="absolute top-0 right-0 p-4 opacity-5"><BrainCircuit size={100} className="text-[#E60000]" /></div>
        <div className="relative z-10 flex flex-col items-start gap-4">
          <div className="flex items-center gap-3">
            <span className="bg-[#110000] border border-[#E60000]/50 text-[#E60000] px-3 py-1 text-[9px] uppercase font-bold tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-[#E60000] rounded-full animate-pulse"></div> Label Automation Active
            </span>
          </div>
          <div className="flex items-center gap-4">
            <h2 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white flex items-center gap-3">
               <Target className="text-[#E60000]" size={28} /> The Exec // Campaign Hub
            </h2>
            <button 
              onClick={handleRegenerate} 
              disabled={initializing || isExecuting}
              className="text-[9px] bg-[#111] border border-[#333] text-[#888] px-3 py-1.5 hover:text-white hover:border-[#555] transition-all uppercase tracking-widest flex items-center gap-2"
            >
              {initializing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Force Regenerate
            </button>
          </div>
          <p className="font-mono text-[10px] text-[#555] uppercase tracking-[0.3em]">
            Artifact: {submission.title}
          </p>
        </div>
        
        <div className="flex gap-4 relative z-10">
          <div className="bg-[#0a0a0a] border border-[#222] p-4 text-center min-w-[120px]">
            <p className="text-[8px] font-mono text-[#555] uppercase mb-1 font-bold">Campaign Timeline</p>
            <p className="text-3xl font-oswald font-bold text-[#E60000]">Day {currentDay}<span className="text-sm text-[#555]">/30</span></p>
          </div>
          <div className="bg-[#0a0a0a] border border-[#222] p-4 text-center min-w-[140px]">
            <p className="text-[8px] font-mono text-[#555] uppercase mb-1 font-bold">Projected Reach</p>
            <p className="text-3xl font-oswald font-bold text-white">{totalStreams.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* LEFT: TIMELINE OVERVIEW */}
        <div className="w-full lg:w-1/3 border-r border-[#222] bg-[#020202] flex flex-col overflow-y-auto custom-scrollbar">
          <div className="p-6 border-b border-[#111] sticky top-0 bg-black z-10">
            <h3 className="font-oswald text-sm uppercase tracking-widest text-[#888] flex items-center gap-2">
              <Calendar size={14} /> 30-Day Blueprint
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-2">
              {[...Array(30)].map((_, i) => {
                const dayNum = i + 1;
                const isPast = dayNum < currentDay;
                const isCurrent = dayNum === currentDay;
                const task = campaignData?.daily_schedule?.[i];
                
                return (
                  <div key={dayNum} className={`flex items-center gap-4 p-3 border transition-colors ${isCurrent ? 'bg-[#110000] border-[#E60000]/50' : isPast ? 'bg-[#050505] border-[#111] opacity-50' : 'bg-black border-[#222]'}`}>
                    <div className={`w-6 h-6 shrink-0 flex items-center justify-center rounded-full text-[9px] font-bold ${isCurrent ? 'bg-[#E60000] text-white shadow-[0_0_10px_rgba(230,0,0,0.5)]' : isPast ? 'bg-[#222] text-[#888]' : 'border border-[#333] text-[#555]'}`}>
                      {isPast ? <CheckCircle2 size={12} /> : dayNum}
                    </div>
                    <div className="flex-1 truncate">
                      <p className={`font-mono text-[10px] uppercase font-bold tracking-widest truncate ${isCurrent ? 'text-[#E60000]' : 'text-gray-400'}`}>
                        {task?.objective || "Scheduled Task"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: DAILY ACTION PORTAL */}
        <div className="flex-1 flex flex-col bg-black">
          {todayTask ? (
            <>
              <div className="p-8 md:p-12 flex-1 overflow-y-auto custom-scrollbar flex flex-col animate-in slide-in-from-right-8">
                
                <div className="mb-8">
                  <div className="flex flex-col gap-3 mb-4">
                    <span className="text-[10px] font-mono text-[#E60000] uppercase tracking-widest font-bold block border-l-2 border-[#E60000] pl-3">
                      Current Stage: {phaseTitle || "Execution"}
                    </span>
                    {getExecutionBadge(todayTask.execution_type)}
                  </div>
                  
                  <h3 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white mb-4">
                    Day {currentDay} Directive
                  </h3>
                  <p className="font-mono text-sm text-[#888] leading-relaxed uppercase">
                    {todayTask.objective}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-[#050505] border border-[#222] p-6 relative group hover:border-[#E60000]/50 transition-colors">
                    <Activity size={16} className="absolute top-6 right-6 text-[#E60000]" />
                    <p className="text-[9px] font-mono text-[#555] uppercase tracking-widest mb-3 font-bold">Action Item</p>
                    <p className="font-oswald text-lg text-white tracking-widest leading-relaxed">
                      {todayTask.action_item}
                    </p>
                  </div>
                  
                  {/* SURGICAL FIX: Re-Scoped Ad Spend Panel */}
                  <div className="bg-[#050505] border border-[#222] p-6 relative group hover:border-green-500/50 transition-colors">
                    <Zap size={16} className="absolute top-6 right-6 text-green-500" />
                    <p className="text-[9px] font-mono text-[#555] uppercase tracking-widest mb-3 font-bold">Algorithmic Network Push</p>
                    <p className="font-oswald text-4xl font-bold text-green-500 tracking-tighter">
                      ${todayTask.auto_ad_spend?.toFixed(2) || "0.00"}
                    </p>
                    <p className="text-[9px] font-mono text-[#555] uppercase mt-2">Deducted from $1,500 Advance</p>
                  </div>
                </div>

                <div className="bg-[#110000] border border-[#330000] p-6 flex-1 flex flex-col mb-8 relative shadow-[inset_0_0_30px_rgba(230,0,0,0.05)]">
                  <p className="text-[10px] font-mono text-[#E60000] uppercase tracking-widest mb-4 font-bold flex items-center gap-2">
                    <FileText size={14} /> Generated Deliverable / Copy
                  </p>
                  <div className="bg-black border border-[#222] p-6 flex-1 font-mono text-xs text-gray-300 leading-loose whitespace-pre-wrap">
                    {todayTask.generated_copy}
                  </div>
                </div>

              </div>

              {/* STICKY FOOTER ADVANCE BUTTON */}
              <div className="bg-[#0a0a0a] p-4 md:p-6 border-t border-[#222] flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 z-10">
                <p className="text-[9px] font-mono text-[#555] uppercase text-center sm:text-left leading-relaxed max-w-sm">
                  In production, this board advances and auto-executes tasks via Cron Job at 00:00 EST.
                </p>
                <button 
                  onClick={handleAdvanceDay}
                  disabled={currentDay >= 30 || isExecuting}
                  className="bg-white text-black px-6 py-3 font-oswald text-sm font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-30 w-full sm:w-auto shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                >
                  Execute & Advance Day <ChevronRight size={16} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-50">
              <CheckCircle2 size={64} className="text-green-500 mb-6" />
              <h3 className="font-oswald text-3xl uppercase tracking-widest text-white mb-2">Campaign Concluded</h3>
              <p className="font-mono text-xs text-[#888] uppercase tracking-widest">The 30-Day framework has been fully executed.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}