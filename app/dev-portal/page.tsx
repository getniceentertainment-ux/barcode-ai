"use client";

import React, { useState, useEffect } from "react";
import { Code, Key, Zap, ShieldCheck, CreditCard, Activity, Copy, CheckCircle2, Loader2, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function DevPortal() {
  const { userSession, addToast } = useMatrixStore();
  
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  // Real Metering State
  const [apiCalls, setApiCalls] = useState(0);
  const [usageCost, setUsageCost] = useState(0);

  // --- SYNC WITH REAL PRODUCTION LEDGER ---
  useEffect(() => {
    if (!userSession?.id) return;
    
    const fetchDevProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('b2b_api_key, api_calls_this_month') 
          .eq('id', userSession.id)
          .single();

        if (error) throw error;

        if (data) {
          if (data.b2b_api_key) setApiKey(data.b2b_api_key);
          if (data.api_calls_this_month) {
            setApiCalls(data.api_calls_this_month);
            // Blended average calculation for visual cost projection ($0.10/avg)
            setUsageCost(data.api_calls_this_month * 0.10);
          }
        }
      } catch (err) {
        console.error("Failed to sync dev profile:", err);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchDevProfile();
  }, [userSession?.id]);

  // --- REAL CRYPTOGRAPHIC GENERATION ---
  const handleGenerateKey = async () => {
    if (!userSession?.id) return;
    
    setIsGenerating(true);
    try {
      const res = await fetch('/api/dev/generate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userSession.id })
      });

      const data = await res.json();
      
      if (data.apiKey) {
        setApiKey(data.apiKey);
        if (addToast) addToast("Production Key Generated & Secured.", "success");
      } else {
        throw new Error(data.error || "Key rotation failed.");
      }
    } catch (err: any) {
      if (addToast) addToast(err.message, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (apiKey) {
      // Compatibility fallback for environments where navigator.clipboard might be restricted
      const textArea = document.createElement("textarea");
      textArea.value = apiKey;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      document.body.removeChild(textArea);
    }
  };

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="text-[#E60000] animate-spin" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8 md:p-16 animate-in fade-in duration-500 overflow-y-auto custom-scrollbar">
      <div className="max-w-5xl mx-auto">
        
        <div className="mb-12 border-b border-[#222] pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <Link href="/" className="text-[#E60000] font-oswald font-bold uppercase tracking-widest text-xs mb-4 inline-flex items-center gap-2 hover:text-white transition-colors group">
              <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Return to Matrix
            </Link>
            <h1 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white flex items-center gap-4">
              <Code size={36} className="text-[#E60000]" /> Enterprise API Portal
            </h1>
            <p className="font-mono text-[10px] text-[#555] uppercase tracking-[0.3em] mt-3">
              Operator Node // NODE_{userSession?.id?.substring(0,8).toUpperCase()}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* API ACCESS PANEL */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-black border border-[#222] p-8 relative overflow-hidden group hover:border-[#E60000]/50 transition-all">
              <h2 className="font-oswald text-xl uppercase tracking-widest font-bold text-white mb-6 flex items-center gap-3">
                <Key size={18} className="text-[#E60000]"/> API Authentication
              </h2>
              
              {!apiKey ? (
                <div className="bg-[#0a0000] border border-[#330000] p-10 text-center rounded-sm">
                  <ShieldCheck size={40} className="mx-auto text-[#E60000] mb-6 opacity-50" />
                  <p className="font-mono text-xs text-[#888] uppercase tracking-widest mb-8 leading-relaxed">
                    Generate a secure B2B sequence to interface with <br/> 
                    the Talon Lyric Engine and Brain Train DSP via external applications.
                  </p>
                  <button 
                    onClick={handleGenerateKey} 
                    disabled={isGenerating} 
                    className="bg-[#E60000] text-white px-10 py-4 font-oswald text-sm font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-3 mx-auto shadow-[0_0_20px_rgba(230,0,0,0.2)] disabled:opacity-50"
                  >
                    {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                    {isGenerating ? "Encrypting Sequence..." : "Generate Production Key"}
                  </button>
                </div>
              ) : (
                <div className="space-y-6 animate-in slide-in-from-bottom-4">
                  <div className="flex justify-between items-end">
                    <p className="font-mono text-[10px] text-green-500 uppercase tracking-widest font-bold flex items-center gap-2">
                      <CheckCircle2 size={12} /> Key Active & Secure
                    </p>
                    <button 
                      onClick={handleGenerateKey} 
                      disabled={isGenerating}
                      className="text-[9px] font-mono text-[#555] uppercase hover:text-[#E60000] transition-colors"
                    >
                      {isGenerating ? "Rotating..." : "[ Rotate Key ]"}
                    </button>
                  </div>
                  <div className="flex bg-[#0a0a0a] border border-[#222] p-2 items-center group/key">
                    <code className="flex-1 font-mono text-xs text-white pl-4 truncate tracking-tight">{apiKey}</code>
                    <button 
                      onClick={copyToClipboard} 
                      className="bg-white text-black px-6 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                      {copied ? <CheckCircle2 size={12}/> : <Copy size={12}/>} {copied ? "Copied" : "Copy Sequence"}
                    </button>
                  </div>
                  <p className="text-[9px] font-mono text-[#444] uppercase leading-relaxed border-t border-[#111] pt-4">
                    Security Notice: This key grants full metered access to your billing account. 
                    Do not expose this credential in frontend client-side code.
                  </p>
                </div>
              )}
            </div>

            {/* ENDPOINTS LIST */}
            <div className="bg-black border border-[#222] p-8">
               <h2 className="font-oswald text-xl uppercase tracking-widest font-bold text-[#888] mb-8 flex items-center gap-3">
                 <Activity size={18} className="text-[#555]"/> B2B Neural Endpoints
               </h2>
               <div className="space-y-4">
                 <div className="flex justify-between items-center p-5 bg-[#050505] border border-[#111] hover:border-[#333] transition-colors">
                   <div>
                     <p className="font-oswald text-sm text-white uppercase tracking-widest">TALON Synthetic Ghostwriter</p>
                     <p className="font-mono text-[9px] text-[#555] uppercase mt-2">POST /api/v1/ghostwriter/synthesize</p>
                   </div>
                   <div className="text-right">
                     <span className="font-mono text-xs text-[#E60000] font-bold block">$0.15</span>
                     <span className="text-[8px] font-mono text-[#333] uppercase">per call</span>
                   </div>
                 </div>
                 <div className="flex justify-between items-center p-5 bg-[#050505] border border-[#111] hover:border-[#333] transition-colors">
                   <div>
                     <p className="font-oswald text-sm text-white uppercase tracking-widest">Brain Train Audio DSP</p>
                     <p className="font-mono text-[9px] text-[#555] uppercase mt-2">POST /api/v1/dsp/analyze</p>
                   </div>
                   <div className="text-right">
                     <span className="font-mono text-xs text-[#E60000] font-bold block">$0.05</span>
                     <span className="text-[8px] font-mono text-[#333] uppercase">per call</span>
                   </div>
                 </div>
               </div>
            </div>
          </div>

          {/* BILLING PANEL */}
          <div className="bg-[#050505] border border-[#222] p-8 flex flex-col h-fit sticky top-8">
             <h2 className="font-oswald text-lg uppercase tracking-widest font-bold text-[#E60000] mb-8 flex items-center gap-3">
               <CreditCard size={18} /> Metered Billing
             </h2>
             
             <div className="space-y-6 mb-10">
               <div className="flex justify-between border-b border-[#111] pb-3 text-[10px] uppercase font-mono">
                 <span className="text-[#555] font-bold">Current Cycle Cost</span> 
                 <span className="text-white font-bold tracking-widest">${usageCost.toFixed(2)}</span>
               </div>
               <div className="flex justify-between border-b border-[#111] pb-3 text-[10px] uppercase font-mono">
                 <span className="text-[#555] font-bold">API Requests (30d)</span> 
                 <span className="text-white font-bold tracking-widest">{apiCalls.toLocaleString()}</span>
               </div>
               <div className="flex justify-between border-b border-[#111] pb-3 text-[10px] uppercase font-mono">
                 <span className="text-[#555] font-bold">Billing Status</span> 
                 <span className="text-green-500 font-bold tracking-widest">Active</span>
               </div>
             </div>

             <button className="w-full bg-white text-black py-4 font-oswald text-xs font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all flex items-center justify-center gap-2 shadow-lg">
               Manage Stripe Billing <Zap size={14} />
             </button>
             <p className="font-mono text-[8px] text-[#555] uppercase text-center mt-6 leading-relaxed">
               Invoices are processed automatically via Stripe <br/> on the 1st of every month.
             </p>
          </div>

        </div>
      </div>
    </div>
  );
}