"use client";

import React, { useState, useEffect } from "react";
import { Terminal, Key, ShieldCheck, Zap, Copy, ExternalLink, Activity, Server, CreditCard, CheckCircle2, Loader2 } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function B2BDeveloperPortal() {
  const { userSession } = useMatrixStore();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [usageStats, setUsageStats] = useState({ calls: 0, cost: 0 });
  
  // New state for the portal loading button
  const [isPortalLoading, setIsPortalLoading] = useState(false);

  // Fetch existing key on mount
  useEffect(() => {
    if (!userSession?.id) return;
    const fetchApiState = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('b2b_api_key, api_calls_this_month')
        .eq('id', userSession.id)
        .single();
      
      if (data?.b2b_api_key) {
        setApiKey(data.b2b_api_key);
        setUsageStats({ 
          calls: data.api_calls_this_month || 0, 
          cost: (data.api_calls_this_month || 0) * 0.15 
        });
      }
    };
    fetchApiState();
  }, [userSession]);

  const generateNewKey = async () => {
    setIsGenerating(true);
    // Generate a secure, pseudo-random key prefixing with 'getnice_'
    const newKey = `getnice_${crypto.randomUUID().replace(/-/g, '')}_v1`;
    
    try {
      await supabase
        .from('profiles')
        .update({ b2b_api_key: newKey })
        .eq('id', userSession?.id);
      
      setApiKey(newKey);
    } catch (error) {
      console.error("Failed to generate key");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // The function that calls our new Stripe Portal backend route
  const handleManageBilling = async () => {
    if (!userSession?.id) return;
    setIsPortalLoading(true);
    
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userSession.id })
      });
      
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url; // Bounces them securely to Stripe
      } else {
        alert(data.error || "Failed to load billing portal.");
      }
    } catch (err) {
      console.error("Portal error:", err);
      alert("A network error occurred.");
    } finally {
      setIsPortalLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] p-6 lg:p-12 flex items-center justify-center animate-in fade-in">
      <div className="max-w-4xl w-full flex flex-col md:flex-row border border-[#222] bg-black shadow-2xl">
        
        {/* LEFT: Branding & Docs */}
        <div className="w-full md:w-1/3 bg-[#020202] border-r border-[#222] p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#E60000] to-black"></div>
          <div>
            <h1 className="font-oswald text-3xl uppercase font-bold text-white tracking-widest mb-2 flex items-center gap-3">
              <Terminal size={24} className="text-[#E60000]" /> TALON API
            </h1>
            <p className="font-mono text-[10px] text-[#888] uppercase tracking-[0.2em] mb-8">B2B Developer Portal</p>
            
            <p className="font-mono text-xs text-gray-400 leading-relaxed mb-6">
              Integrate the GetNice Ghostwriter engine directly into your DAW, mobile app, or platform. 
            </p>

            <div className="space-y-4 font-mono text-[10px] uppercase tracking-widest text-[#555]">
              <div className="flex items-center gap-3"><Server size={14} className="text-[#E60000]" /> Dedicated GPU Cluster</div>
              <div className="flex items-center gap-3"><Zap size={14} className="text-[#E60000]" /> <span className="text-white">$0.15 / Successful Generation</span></div>
              <div className="flex items-center gap-3"><Activity size={14} className="text-[#E60000]" /> 99.9% Matrix Uptime</div>
            </div>
          </div>
          
          <button className="mt-12 flex items-center gap-2 text-[10px] font-bold font-mono text-[#888] hover:text-white uppercase tracking-widest transition-colors">
            View Documentation <ExternalLink size={14} />
          </button>
        </div>

        {/* RIGHT: Keys & Billing */}
        <div className="flex-1 p-8 lg:p-12 flex flex-col">
          <div className="mb-10">
             <h2 className="font-oswald text-xl uppercase tracking-widest text-white mb-6 flex items-center gap-2 border-b border-[#222] pb-3">
               <Key size={18} className="text-[#E60000]" /> Secret Access Key
             </h2>
             
             {apiKey ? (
               <div className="bg-[#0a0a0a] border border-[#333] p-4 flex items-center justify-between group">
                 <span className="font-mono text-sm text-green-500 blur-[3px] group-hover:blur-none transition-all duration-300">
                   {apiKey}
                 </span>
                 <button onClick={copyToClipboard} className="text-[#555] hover:text-white transition-colors">
                   {copied ? <CheckCircle2 size={18} className="text-green-500" /> : <Copy size={18} />}
                 </button>
               </div>
             ) : (
               <div className="bg-[#110000] border border-[#330000] p-6 text-center">
                 <ShieldCheck size={32} className="text-[#E60000] mx-auto mb-4" />
                 <p className="font-mono text-xs text-[#E60000] uppercase tracking-widest mb-4">No API key detected for this node.</p>
                 <button 
                   onClick={generateNewKey}
                   disabled={isGenerating}
                   className="bg-[#E60000] text-white px-8 py-3 font-oswald text-sm font-bold uppercase tracking-widest hover:bg-red-700 transition-colors flex items-center justify-center gap-2 mx-auto"
                 >
                   {isGenerating ? <><Loader2 size={16} className="animate-spin" /> Generating...</> : "Generate Production Key"}
                 </button>
               </div>
             )}
             <p className="text-[9px] font-mono text-[#555] mt-3 uppercase tracking-widest">
               Do not expose this key in client-side code. Route all requests through your backend.
             </p>
          </div>

          <div className="mt-auto">
            <h2 className="font-oswald text-xl uppercase tracking-widest text-white mb-6 flex items-center gap-2 border-b border-[#222] pb-3">
              <CreditCard size={18} className="text-[#E60000]" /> Current Billing Cycle
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0a0a0a] border border-[#222] p-6">
                <span className="text-[10px] font-mono text-[#555] uppercase tracking-widest block mb-2">API Calls (This Month)</span>
                <span className="font-oswald text-3xl font-bold text-white">{usageStats.calls}</span>
              </div>
              <div className="bg-[#0a0a0a] border border-[#222] p-6">
                <span className="text-[10px] font-mono text-[#555] uppercase tracking-widest block mb-2">Accrued Cost</span>
                <span className="font-oswald text-3xl font-bold text-[#E60000]">${usageStats.cost.toFixed(2)}</span>
              </div>
            </div>
            
            {/* The newly wired billing portal button */}
            <button 
              onClick={handleManageBilling}
              disabled={isPortalLoading}
              className="w-full mt-4 border border-[#333] text-[#888] py-4 font-oswald text-sm font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isPortalLoading ? <><Loader2 size={16} className="animate-spin" /> Securing Portal...</> : "Manage Stripe Payment Method"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}