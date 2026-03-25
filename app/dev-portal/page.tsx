"use client";

import React, { useState, useEffect } from "react";
import { Code, Key, Zap, ShieldCheck, CreditCard, Activity, Copy, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useMatrixStore } from "../store/useMatrixStore";
import { supabase } from "../lib/supabase";

export default function DevPortal() {
  const { userSession, addToast } = useMatrixStore();
  
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Metering State
  const [apiCalls, setApiCalls] = useState(0);
  const [usageCost, setUsageCost] = useState(0);

  // Fetch existing Dev Data on mount
  useEffect(() => {
    if (!userSession?.id) return;
    
    const fetchDevProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('api_key, api_calls') 
        .eq('id', userSession.id)
        .single();

      if (data) {
        if (data.api_key) setApiKey(data.api_key);
        if (data.api_calls) {
          setApiCalls(data.api_calls);
          // Simple blended average calculation for display ($0.10 blended rate)
          setUsageCost(data.api_calls * 0.10);
        }
      }
      if (error) console.error("Error fetching dev profile:", error);
    };

    fetchDevProfile();
  }, [userSession?.id]);

  const handleGenerateKey = async () => {
    if (!userSession?.id) {
      if (addToast) addToast("Authentication required.", "error");
      return;
    }
    
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
        if (addToast) addToast("Production API Key Encrypted & Secured.", "success");
      } else {
        throw new Error(data.error || "Failed to generate key.");
      }
    } catch (err: any) {
      console.error("Key Generation Error:", err);
      if (addToast) addToast("Failed to assign secure key.", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8 md:p-16 animate-in fade-in duration-500">
      <div className="max-w-5xl mx-auto">
        
        <div className="mb-12 border-b border-[#222] pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <Link href="/" className="text-[#E60000] font-oswald font-bold uppercase tracking-widest text-sm mb-4 inline-block hover:text-white transition-colors">
              ← Return to Matrix
            </Link>
            <h1 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white flex items-center gap-4">
              <Code size={36} className="text-[#E60000]" /> Enterprise API Portal
            </h1>
            <p className="font-mono text-[10px] text-[#888] uppercase tracking-widest mt-2">
              B2B Developer Access // Metered Billing Pipeline
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* API Access Panel */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-black border border-[#222] p-8 relative overflow-hidden group hover:border-[#E60000] transition-colors">
              <h2 className="font-oswald text-xl uppercase tracking-widest font-bold text-white mb-6 flex items-center gap-2">
                <Key size={18} className="text-[#E60000]"/> API Authentication
              </h2>
              
              {!apiKey ? (
                <div className="bg-[#110000] border border-[#330000] p-6 text-center">
                  <ShieldCheck size={32} className="mx-auto text-[#E60000] mb-4" />
                  <p className="font-mono text-xs text-[#888] uppercase tracking-widest mb-6">Link a payment method to generate your live production key.</p>
                  <button onClick={handleGenerateKey} disabled={isGenerating} className="bg-[#E60000] text-white px-8 py-3 font-oswald text-sm font-bold uppercase tracking-widest hover:bg-red-700 transition-colors flex items-center justify-center gap-2 mx-auto">
                    {isGenerating ? <><Loader2 size={16} className="animate-spin" /> Encrypting Key...</> : "Generate Production Key"}
                  </button>
                </div>
              ) : (
                <div className="space-y-4 animate-in zoom-in duration-300">
                  <p className="font-mono text-[10px] text-green-500 uppercase tracking-widest font-bold">Key Active & Secured</p>
                  <div className="flex bg-[#111] border border-[#333] p-2 items-center">
                    <code className="flex-1 font-mono text-xs text-white pl-2">{apiKey}</code>
                    <button onClick={copyToClipboard} className="bg-white text-black px-4 py-2 text-[10px] uppercase font-bold tracking-widest hover:bg-[#E60000] hover:text-white transition-colors flex items-center gap-2">
                      {copied ? <CheckCircle2 size={12}/> : <Copy size={12}/>} {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-black border border-[#222] p-8">
               <h2 className="font-oswald text-xl uppercase tracking-widest font-bold text-white mb-6 flex items-center gap-2">
                 <Activity size={18} className="text-[#555]"/> Endpoints & Pricing
               </h2>
               <div className="space-y-4">
                 <div className="flex justify-between items-center p-4 bg-[#0a0a0a] border border-[#111]">
                   <div>
                     <p className="font-oswald text-sm text-white uppercase tracking-widest">TALON Lyric Engine</p>
                     <p className="font-mono text-[9px] text-[#555] uppercase mt-1">POST /api/v1/ghostwriter/synthesize</p>
                   </div>
                   <span className="font-mono text-xs text-[#E60000] font-bold">$0.15 / Call</span>
                 </div>
                 <div className="flex justify-between items-center p-4 bg-[#0a0a0a] border border-[#111]">
                   <div>
                     <p className="font-oswald text-sm text-white uppercase tracking-widest">Brain Train DSP Extraction</p>
                     <p className="font-mono text-[9px] text-[#555] uppercase mt-1">POST /api/v1/dsp/analyze</p>
                   </div>
                   <span className="font-mono text-xs text-[#E60000] font-bold">$0.05 / Call</span>
                 </div>
               </div>
            </div>
          </div>

          {/* Billing Panel */}
          <div className="bg-[#050505] border border-[#222] p-8 flex flex-col h-fit">
             <h2 className="font-oswald text-lg uppercase tracking-widest font-bold text-[#E60000] mb-6 flex items-center gap-2">
               <CreditCard size={18} /> Metered Billing
             </h2>
             
             <div className="space-y-4 mb-8">
               <div className="flex justify-between border-b border-[#222] pb-2 text-[10px] uppercase font-mono">
                 <span className="text-[#555]">Current Cycle Usage</span> 
                 <span className="text-white">${usageCost.toFixed(2)}</span>
               </div>
               <div className="flex justify-between border-b border-[#222] pb-2 text-[10px] uppercase font-mono">
                 <span className="text-[#555]">API Calls (30d)</span> 
                 <span className="text-white">{apiCalls.toLocaleString()}</span>
               </div>
             </div>

             <button className="w-full border border-[#333] text-white py-4 font-oswald text-xs font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-colors flex items-center justify-center gap-2">
               Manage Stripe Billing <Zap size={14} />
             </button>
             <p className="font-mono text-[8px] text-[#555] uppercase text-center mt-4">Invoices are processed automatically on the 1st of every month.</p>
          </div>

        </div>
      </div>
    </div>
  );
}