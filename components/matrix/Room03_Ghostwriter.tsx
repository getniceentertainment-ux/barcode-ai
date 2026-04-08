"use client";

import React, { useState, useEffect } from "react";
import { 
  PenTool, Play, RefreshCw, Zap, AlignLeft, Edit3, 
  Loader2, Layout, ShieldCheck, Cpu, Activity, 
  ArrowRight, Lock, Plus, Minus
} from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

// --- THE 100% PROPRIETARY GETNICE MACRO-RHYTHMIC VAULT ---
const FLOW_VAULT: Record<string, {array: number[], name: string, desc: string}[]> = {
  "getnice_hybrid": [
    { array: [4, 2, 2, 3, 1, 4, 2, 2, 2, 2, 4, 4], name: "Chain-Link Pivot", desc: "Long massive hold on the 1-count, followed by 2 standard syllables, then a long stretch, a rapid snap, and another massive hold. Very dynamic push-and-pull." },
    { array: [3, 1, 2, 2], name: "Platinum Bounce", desc: "1 long stretched syllable, 1 very fast rapid syllable, and 2 standard medium syllables. Repeat this bounce." },
    { array: [6, 2, 4, 2, 2], name: "Late Drop", desc: "Leave the 1-count totally empty (a pickup/rest), then drop a massive hold on the 2-count followed by standard syllables." }
  ],
  "chopper": [
    { array: [1, 1, 1, 1], name: "Machine Gun", desc: "Every single 16th note gets a syllable. No air. Relentless." },
    { array: [2, 1, 1, 1, 1, 2], name: "Stutter Step", desc: "Medium hold, rapid fire 16ths, then another medium hold to catch breath." }
  ],
  "heartbeat": [
    { array: [2, 2, 2, 2], name: "Classic 8th", desc: "Standard boom-bap rhythm. 8th notes perfectly aligned to the kick and snare." },
    { array: [4, 2, 2, 4, 4], name: "G-Funk Stroll", desc: "Heavy emphasis on the downbeat (4), two quick steps, then riding the snare." }
  ],
  "triplet": [
    { array: [3, 3, 2], name: "Trap Roll", desc: "Standard 8th note triplets followed by a quick reset." },
    { array: [2, 2, 2, 3, 3, 4], name: "Migos Flip", desc: "Standard 8ths transitioning abruptly into a triplet pocket before landing heavy." }
  ],
  "lazy": [
    { array: [4, 2, 2], name: "Behind the Beat", desc: "Extremely loose, dragging syllables across multiple grid spaces." },
    { array: [6, 2, 8], name: "The Drifter", desc: "Massive pauses and dragged-out vowels." }
  ]
};

export default function Room03_Ghostwriter() {
  const { 
    gwPrompt, setGwPrompt, gwStyle, setGwStyle, gwPocket, setGwPocket,
    gwMotive, setGwMotive, gwStruggle, setGwStruggle, gwHustle, setGwHustle,
    gwGender, setGwGender, gwStrikeZone, setGwStrikeZone, gwHookType, setGwHookType,
    gwFlowEvolution, setGwFlowEvolution,
    blueprint, setBlueprint, generatedLyrics, setGeneratedLyrics, 
    audioData, setActiveRoom, userSession, addToast, pushToCloud 
  } = useMatrixStore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "INITIALIZING HERMES-2-PRO (8B)...",
    "LOADING GETNICE PROPRIETARY LORA...",
    "WAITING FOR PROMPT PARAMETERS..."
  ]);

  const [selectedLine, setSelectedLine] = useState("");
  const [refineInstruction, setRefineInstruction] = useState("");
  const [isRefining, setIsRefining] = useState(false);

  const [showAdvanced, setShowAdvanced] = useState(false);

  const isFreeLoader = (userSession?.tier as string)?.includes("Free Loader");
  const credits = Number((userSession as any)?.creditsRemaining || (userSession as any)?.credits || 0);

  const addLog = (msg: string) => {
    setTerminalLogs(prev => {
      const newLogs = [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`];
      return newLogs.length > 5 ? newLogs.slice(1) : newLogs;
    });
  };

  useEffect(() => {
    if (!jobId) return;
    let interval: NodeJS.Timeout;
    
    const checkStatus = async () => {
      try {
        setPollingAttempts(prev => prev + 1);
        const res = await fetch(`/api/runpod/status?id=${jobId}`);
        const data = await res.json();
        
        if (data.status === "COMPLETED" && data.output) {
          setGeneratedLyrics(data.output.lyrics);
          addLog("ARTIFACT SYNTHESIS COMPLETE. READY FOR THE BOOTH.");
          setJobId(null);
          setIsGenerating(false);
          setPollingAttempts(0);
          
          if(addToast) addToast("High-tier artifact synthesized.", "success");
          
          setTimeout(() => {
            pushToCloud();
          }, 1000);

          try {
            const { data: { session } } = await supabase.auth.getSession();
            await fetch('/api/ledger/consume', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
              body: JSON.stringify({ action: 'generate_lyrics', description: `Ghostwriter: Synthesized ${blueprint?.length || 0} Blocks` })
            });
            const newCredits = Math.max(0, credits - 100);
            useMatrixStore.setState({ userSession: { ...userSession, creditsRemaining: newCredits, credits: newCredits } as any });
          } catch(e) { console.error("Silent Ledger Error:", e) }

        } else if (data.status === "FAILED") {
          addLog("ERROR: RUNPOD NODE FAILED.");
          setJobId(null);
          setIsGenerating(false);
          if(addToast) addToast("AI Engine failed. Please retry.", "error");
        } else if (data.status === "IN_QUEUE" || data.status === "IN_PROGRESS") {
          if (pollingAttempts > 0 && pollingAttempts % 3 === 0) {
             const activeVariations = FLOW_VAULT[gwStyle] || FLOW_VAULT["getnice_hybrid"];
             const curPattern = activeVariations[0];
             addLog(`INJECTING MACRO-RHYTHMIC DNA: ${curPattern.name.toUpperCase()}...`);
             addLog(`APPLYING DYNAMIC CONTOUR: [${(audioData?.contour || "Neutral").toUpperCase()}]...`);
          }
        }
      } catch (e) {
        addLog("CONNECTION TO SECURE NODE LOST. RETRYING...");
      }
    };

    interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [jobId, pollingAttempts, setGeneratedLyrics, addToast, audioData, gwStyle, credits, userSession, pushToCloud, blueprint]);

  useEffect(() => {
    if (gwStyle === "lazy" && gwPocket === "cascade") {
       setGwPocket("syncopated");
       if (addToast) addToast("Style Override: 'Lazy' flow cannot support 'Cascade' pocket.", "info");
    }
    if (gwPocket === "pickup" && gwStrikeZone === "downbeat") {
       setGwStrikeZone("late");
       if (addToast) addToast("Grid Override: 'Pickup' pocket forces a 'Late' strike zone.", "info");
    }
  }, [gwStyle, gwPocket, gwStrikeZone, setGwPocket, setGwStrikeZone, addToast]);


  const handleGenerate = async () => {
    if (!audioData) {
      if(addToast) addToast("No DSP truth found. Run R01 Lab Analysis first.", "error");
      return;
    }
    if (isFreeLoader && credits < 100) {
      if(addToast) addToast("Insufficient Credits ($1.00 required). Top up in Bank.", "error");
      return;
    }
    if (!blueprint || blueprint.length === 0) {
      if(addToast) addToast("No structure defined in Brain Train (R02).", "error");
      return;
    }

    setIsGenerating(true);
    setTerminalLogs(["INITIATING SECURE HANDSHAKE WITH RUNPOD VLLM..."]);
    
    try {
      addLog("CALIBRATING LORA WEIGHTS FOR GETNICE POCKETS...");
      
      const payload = {
        blueprint: blueprint.map((bp, i) => {
          const activeVariations = FLOW_VAULT[gwStyle] || FLOW_VAULT["getnice_hybrid"];
          const variation = activeVariations[i % activeVariations.length];
          return {
            ...bp,
            patternName: variation.name,
            patternDesc: variation.desc,
            patternArray: variation.array
          };
        }),
        topic: gwPrompt || "A generic hustle anthem",
        motive: gwMotive, struggle: gwStruggle, hustle: gwHustle,
        gender: gwGender, pocket: gwPocket, strikeZone: gwStrikeZone, hookType: gwHookType, flowEvolution: gwFlowEvolution,
        dynamic_array: audioData.dynamic_array || [],
        contour: audioData.contour || "flat"
      };

      const res = await fetch('/api/ai/generate-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.jobId) {
        setJobId(data.jobId);
        addLog("REQUEST SENT. AWAITING ARTIFACT YIELD...");
      } else {
        throw new Error(data.error || "Failed to initiate.");
      }
    } catch (err: any) {
      addLog("ERROR: SECURE HANDSHAKE FAILED.");
      setIsGenerating(false);
      if(addToast) addToast("Synthesis Error: " + err.message, "error");
    }
  };

  const handleRefine = async () => {
    if (!selectedLine || !refineInstruction) return;
    setIsRefining(true);
    try {
      const res = await fetch('/api/ai/refine-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentLine: selectedLine, instruction: refineInstruction, context: generatedLyrics })
      });
      const data = await res.json();
      if (data.newLine) {
        // 🚨 SURGICAL FIX: (generatedLyrics || "") explicitly satisfies the TypeScript string | null requirement
        setGeneratedLyrics((generatedLyrics || "").replace(selectedLine, data.newLine));
        setSelectedLine("");
        setRefineInstruction("");
        if(addToast) addToast("Micro-Refinement Applied.", "success");
      }
    } catch (err) {
      if(addToast) addToast("Refinement failed.", "error");
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <div className="flex h-full bg-[#050505] border border-[#222] rounded-lg overflow-hidden animate-in fade-in duration-500 relative flex-col">
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT PANEL: CONFIGURATION */}
        <div className="w-1/2 lg:w-4/12 border-r border-[#222] bg-[#020202] flex flex-col relative shadow-[inset_-10px_0_30px_rgba(0,0,0,0.5)]">
          <div className="p-8 pb-4 border-b border-[#111] flex justify-between items-center relative">
             <h2 className="font-oswald text-xl uppercase tracking-widest font-bold text-[#555] flex items-center gap-2">
                <PenTool size={20} /> GHOSTWRITER
             </h2>
             <span className="font-mono text-[9px] uppercase tracking-widest text-[#E60000] border border-[#E60000]/30 px-2 py-1 bg-[#110000] rounded animate-pulse shadow-[0_0_10px_rgba(230,0,0,0.2)] flex items-center gap-1.5"><ShieldCheck size={10} /> Proprietary LORA</span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-4">
             
             {/* THE CORE PROMPT */}
             <div className="mb-6">
               <label className="block text-[10px] font-mono text-[#E60000] mb-2 uppercase tracking-widest font-bold flex items-center gap-2"><AlignLeft size={12}/> The Artifact Seed</label>
               <textarea 
                 value={gwPrompt} onChange={(e) => setGwPrompt(e.target.value)}
                 className="w-full bg-[#0a0a0a] border border-[#222] text-white p-4 font-mono text-xs focus:border-[#E60000] outline-none h-24 custom-scrollbar shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
                 placeholder="Describe the vibe... (e.g., Late night drive through Baltimore, talking about loyalty.)"
               />
               <p className="text-[9px] text-[#555] font-mono mt-1 text-right uppercase tracking-widest">Feed the algorithm</p>
             </div>

             <button onClick={() => setShowAdvanced(!showAdvanced)} className="w-full flex items-center justify-between text-[#888] hover:text-white border-b border-[#222] pb-2 mb-4">
               <span className="font-oswald text-xs uppercase tracking-widest font-bold flex items-center gap-2"><Layout size={14} /> Advanced Parameters</span>
               {showAdvanced ? <Minus size={14} /> : <Plus size={14} />}
             </button>

             {showAdvanced && (
               <div className="space-y-6 animate-in slide-in-from-top-2 duration-200">
                 
                 {/* NARRATIVE LORA */}
                 <div>
                   <label className="block text-[10px] font-mono text-[#888] mb-2 uppercase tracking-widest border-b border-[#222] pb-1">Narrative Persona [LORA]</label>
                   <div className="grid grid-cols-2 gap-3 mb-3">
                     <div>
                       <span className="text-[8px] font-mono text-[#555] block mb-1 uppercase">Motive</span>
                       <select value={gwMotive} onChange={(e) => setGwMotive(e.target.value)} className="w-full bg-[#111] border border-[#333] text-[10px] text-white p-2 font-mono outline-none focus:border-[#E60000]">
                         <option value="Survival">Survival</option><option value="Dominance">Dominance</option><option value="Luxury">Luxury</option><option value="Paranoia">Paranoia</option><option value="Heartbreak">Heartbreak</option>
                       </select>
                     </div>
                     <div>
                       <span className="text-[8px] font-mono text-[#555] block mb-1 uppercase">Struggle</span>
                       <select value={gwStruggle} onChange={(e) => setGwStruggle(e.target.value)} className="w-full bg-[#111] border border-[#333] text-[10px] text-white p-2 font-mono outline-none focus:border-[#E60000]">
                         <option value="Betrayal">Betrayal</option><option value="Poverty">Poverty</option><option value="The System">The System</option><option value="Internal Demons">Internal Demons</option><option value="Addiction">Addiction</option>
                       </select>
                     </div>
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                     <div>
                       <span className="text-[8px] font-mono text-[#555] block mb-1 uppercase">Hustle Environment</span>
                       <select value={gwHustle} onChange={(e) => setGwHustle(e.target.value)} className="w-full bg-[#111] border border-[#333] text-[10px] text-white p-2 font-mono outline-none focus:border-[#E60000]">
                         <option value="Street">Street Corner / Trap</option><option value="Corporate">Boardroom / Tech</option><option value="Creative">Studio / Art Scene</option><option value="Nightlife">Club / VIP</option>
                       </select>
                     </div>
                     <div>
                       <span className="text-[8px] font-mono text-[#555] block mb-1 uppercase">Vocal Delivery / Vibe</span>
                       <select value={gwGender} onChange={(e) => setGwGender(e.target.value)} className="w-full bg-[#111] border border-[#333] text-[10px] text-white p-2 font-mono outline-none focus:border-[#E60000]">
                         <option value="male">Male (Gruff / Aggressive)</option><option value="female">Female (Smooth / Sharp)</option><option value="androgynous">Androgynous (Alien / Ethereal)</option>
                       </select>
                     </div>
                   </div>
                 </div>

                 {/* RHYTHMIC DNA */}
                 <div>
                   <label className="block text-[10px] font-mono text-[#888] mb-2 uppercase tracking-widest border-b border-[#222] pb-1">Rhythmic Constraints</label>
                   <div className="grid grid-cols-2 gap-3 mb-3">
                     <div>
                       <span className="text-[8px] font-mono text-[#555] block mb-1 uppercase">Macro-Flow</span>
                       <select value={gwStyle} onChange={(e) => setGwStyle(e.target.value)} className="w-full bg-[#111] border border-[#333] text-[10px] text-white p-2 font-mono outline-none focus:border-[#E60000]">
                         <option value="getnice_hybrid">GetNice Hybrid</option><option value="chopper">Chopper</option><option value="heartbeat">Heartbeat</option><option value="triplet">Triplet / Migos</option><option value="lazy">Lazy / Dragged</option>
                       </select>
                     </div>
                     <div>
                       <span className="text-[8px] font-mono text-[#555] block mb-1 uppercase">Micro-Pocket</span>
                       <select value={gwPocket} onChange={(e) => setGwPocket(e.target.value)} className="w-full bg-[#111] border border-[#333] text-[10px] text-white p-2 font-mono outline-none focus:border-[#E60000]">
                         <option value="syncopated">Syncopated (Off-beat)</option><option value="straight">Straight (On-grid)</option><option value="pickup">Pickup (Starts late)</option><option value="cascade">Cascade (Rapid fall)</option>
                       </select>
                     </div>
                   </div>
                   <div className="grid grid-cols-2 gap-3 mb-3">
                     <div>
                       <span className="text-[8px] font-mono text-[#555] block mb-1 uppercase">Strike Zone</span>
                       <select value={gwStrikeZone} onChange={(e) => setGwStrikeZone(e.target.value)} className="w-full bg-[#111] border border-[#333] text-[10px] text-white p-2 font-mono outline-none focus:border-[#E60000]">
                         <option value="downbeat">Heavy Downbeat (1 & 3)</option><option value="snare">Snare Focus (2 & 4)</option><option value="late">Late (Behind the beat)</option><option value="anticipatory">Anticipatory (Before the beat)</option>
                       </select>
                     </div>
                     <div>
                       <span className="text-[8px] font-mono text-[#555] block mb-1 uppercase">Hook Dynamics</span>
                       <select value={gwHookType} onChange={(e) => setGwHookType(e.target.value)} className="w-full bg-[#111] border border-[#333] text-[10px] text-white p-2 font-mono outline-none focus:border-[#E60000]">
                         <option value="anthemic">Anthemic (Long Vowels)</option><option value="chant">Chant (Short, Staccato)</option><option value="melodic">Melodic (Pitch variation)</option><option value="bouncy">Bouncy (High density)</option>
                       </select>
                     </div>
                   </div>
                   <div className="w-full">
                       <span className="text-[8px] font-mono text-[#555] block mb-1 uppercase">Flow Evolution</span>
                       <select value={gwFlowEvolution} onChange={(e) => setGwFlowEvolution(e.target.value)} className="w-full bg-[#111] border border-[#333] text-[10px] text-white p-2 font-mono outline-none focus:border-[#E60000]">
                         <option value="static">Static (Consistent pocket)</option><option value="building">Building (Starts slow, gets faster)</option><option value="unpredictable">Unpredictable (Constant switches)</option>
                       </select>
                   </div>
                 </div>

               </div>
             )}

             {/* GENERATE BUTTON */}
             <div className="mt-8">
               <button 
                 onClick={handleGenerate} 
                 disabled={isGenerating || !audioData || blueprint.length === 0 || (isFreeLoader && credits < 100)}
                 className="w-full bg-[#E60000] text-white py-4 font-oswald text-lg font-bold uppercase tracking-[0.2em] hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.3)] hover:shadow-[0_0_30px_rgba(230,0,0,0.5)] flex justify-center items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 {isGenerating ? <><Loader2 size={20} className="animate-spin" /> Synthesizing...</> : <><Zap size={20} /> Generate Artifact</>}
               </button>
               {isFreeLoader && (
                 <p className="text-center text-[10px] font-mono text-[#888] mt-2 uppercase tracking-widest">- 100 Credits ($1.00) -</p>
               )}
               {(!audioData || blueprint.length === 0) && !isGenerating && (
                 <p className="text-center text-[10px] font-mono text-red-500 mt-2 uppercase tracking-widest border border-red-500/30 p-1 bg-red-950/30">
                   {!audioData ? "Requires R01 Analysis" : "Requires R02 Structure"}
                 </p>
               )}
             </div>

          </div>
        </div>

        {/* RIGHT PANEL: TERMINAL & LYRICS OUTPUT */}
        <div className="w-1/2 lg:w-8/12 flex flex-col relative bg-black">
          
          {/* TERMINAL HEADER */}
          <div className="h-40 border-b border-[#222] bg-[#050505] p-6 relative overflow-hidden flex flex-col justify-end">
             <div className="absolute top-6 left-6 text-[#333] opacity-20"><Activity size={64} /></div>
             <div className="relative z-10 flex flex-col gap-1">
               {terminalLogs.map((log, i) => (
                 <div key={i} className="font-mono text-[10px] text-green-500 uppercase tracking-wider opacity-80">{log}</div>
               ))}
             </div>
             {isGenerating && <div className="absolute top-0 left-0 w-full h-1 bg-[#E60000] animate-pulse"></div>}
          </div>

          {/* LYRICS EDITOR / VIEWER */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-10 relative">
             {!generatedLyrics && !isGenerating && (
                <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30">
                   <Layout size={64} className="mb-4 text-[#888]" />
                   <p className="font-oswald text-2xl uppercase tracking-widest text-[#555]">Awaiting Synthesis</p>
                </div>
             )}

             {isGenerating && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                   <div className="w-32 h-32 border border-[#E60000]/30 rounded-full flex items-center justify-center relative animate-spin-slow">
                     <div className="w-2 h-2 bg-[#E60000] rounded-full absolute top-0 shadow-[0_0_10px_#E60000]"></div>
                     <Cpu size={32} className="text-[#E60000] opacity-50" />
                   </div>
                   <p className="mt-8 font-mono text-xs uppercase tracking-widest text-[#E60000] animate-pulse">Running Neural Inference...</p>
                </div>
             )}

             {generatedLyrics && !isGenerating && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-2xl mx-auto pb-32">
                   {generatedLyrics.split('\n').map((line, i) => {
                     const isHeader = line.startsWith('[');
                     return (
                       <div 
                         key={i} 
                         onClick={() => !isHeader && setSelectedLine(line.trim())}
                         className={`
                           group relative transition-all duration-200 
                           ${isHeader ? 'mt-8 mb-4' : 'mb-2 cursor-pointer hover:-translate-x-2'}
                         `}
                       >
                         {isHeader ? (
                           <span className="font-oswald text-[#E60000] text-sm uppercase tracking-[0.2em] font-bold border-b border-[#E60000]/30 pb-1">{line}</span>
                         ) : (
                           <p className={`font-mono text-sm leading-relaxed ${selectedLine === line.trim() ? 'text-white font-bold bg-[#E60000]/10 p-2 border-l-2 border-[#E60000]' : 'text-gray-400 group-hover:text-white'}`}>
                             {line}
                             <span className="opacity-0 group-hover:opacity-100 absolute right-full mr-4 top-1/2 -translate-y-1/2 text-[#E60000] text-[9px] uppercase tracking-widest flex items-center gap-1">
                               <Edit3 size={10}/> Refine
                             </span>
                           </p>
                         )}
                       </div>
                     )
                   })}
                </div>
             )}
          </div>

          {/* NEXT ROOM ACTION */}
          <div className="h-16 bg-black border-t border-[#222] flex items-center justify-between px-10 z-20">
             <div className="flex items-center gap-3">
               <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
               <span className="font-mono text-[9px] uppercase tracking-widest text-[#555]">Matrix Idle</span>
             </div>
             <button 
               onClick={() => setActiveRoom("04")}
               disabled={!generatedLyrics || isGenerating}
               className="flex items-center gap-3 bg-white text-black px-8 py-2 font-oswald font-bold uppercase tracking-widest text-xs hover:bg-[#E60000] hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
             >
               Enter The Booth <ArrowRight size={16} />
             </button>
          </div>

        </div>

        {/* MICRO-REFINEMENT OVERLAY */}
        <div className={`absolute bottom-16 right-0 w-1/2 lg:w-8/12 bg-[#0a0a0a] border-t border-l border-[#E60000]/30 p-6 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] transition-transform duration-300 z-30 ${selectedLine ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="flex justify-between items-center mb-4">
             <h4 className="font-oswald text-sm text-[#E60000] uppercase tracking-widest font-bold flex items-center gap-2"><Edit3 size={14} /> Micro-Refinement</h4>
             <button onClick={() => setSelectedLine("")} className="text-[#555] hover:text-white text-[10px] font-mono uppercase tracking-widest">Close [X]</button>
          </div>
          <p className="text-xs font-mono text-gray-400 mb-4 bg-[#111] p-3 border border-[#333] italic">"{selectedLine}"</p>
          <div className="flex gap-3">
             <input 
               type="text" value={refineInstruction} onChange={(e) => setRefineInstruction(e.target.value)}
               placeholder="E.g., Make it rhyme with 'cash'..." 
               className="flex-1 bg-[#111] border border-[#333] p-3 text-xs text-white font-mono outline-none focus:border-[#E60000]"
             />
             <button 
               onClick={handleRefine} disabled={isRefining || !refineInstruction}
               className="bg-[#E60000] text-white px-8 font-oswald text-sm font-bold uppercase tracking-widest hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
             >
               {isRefining ? <Loader2 size={14} className="animate-spin" /> : "Execute"}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}