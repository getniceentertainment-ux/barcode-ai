"use client";

import React, { useState, useRef, useEffect } from "react";
import { PenTool, Activity, CheckCircle2, ArrowRight, Plus, Minus, Trash2, Zap, Loader2, Lock, FileText, Sparkles, Info } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export default function Room03_Ghostwriter() {
  const { 
    audioData, flowDNA, blueprint, setBlueprint, 
    generatedLyrics, setGeneratedLyrics, 
    userSession, addToast, setActiveRoom 
  } = useMatrixStore();

  const [customPrompt, setCustomPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<"idle" | "analyzing" | "success">(generatedLyrics ? "success" : "idle");

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // --- MONETIZATION: DYNAMIC COST CALCULATION ---
  const CREATOR_ID = process.env.NEXT_PUBLIC_CREATOR_ID;
  const isCreator = userSession?.id && userSession.id === CREATOR_ID;
  const isMogul = userSession?.tier === "The Mogul";

  // Rule: 1 Credit covers up to 2 blocks (e.g., 1 Hook + 1 Verse). 
  // 3-4 blocks = 2 Credits, 5-6 blocks = 3 Credits, etc.
  const currentCost = isMogul ? 0 : Math.max(1, Math.ceil(blueprint.length / 2));

  const hasEnoughCredits = isCreator || isMogul || 
    (userSession?.creditsRemaining && (userSession.creditsRemaining === "UNLIMITED" || userSession.creditsRemaining >= currentCost));

  // --- BLUEPRINT EDITING ---
  const handleAddBlock = () => {
    const newId = `block_${Date.now()}`;
    setBlueprint([...blueprint, { id: newId, type: "VERSE", bars: 16 }]);
  };

  const handleRemoveBlock = (index: number) => {
    if (blueprint.length <= 1) return; // Must have at least one block
    const newBp = [...blueprint];
    newBp.splice(index, 1);
    setBlueprint(newBp);
  };

  const updateBlockType = (index: number, newType: string) => {
    const newBp = [...blueprint];
    newBp[index].type = newType;
    setBlueprint(newBp);
  };

  const updateBlockBars = (index: number, delta: number) => {
    const newBp = [...blueprint];
    newBp[index].bars = Math.max(1, newBp[index].bars + delta);
    setBlueprint(newBp);
  };

  // --- GENERATION EXECUTION ---
  const handleGenerate = async () => {
    if (!hasEnoughCredits) {
      if(addToast) addToast(`Insufficient Credits. You need ${currentCost} CRD for this structure.`, "error");
      return;
    }

    setIsGenerating(true);
    setStatus("analyzing");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // 1. Hit the secure API endpoint (which deducts the dynamic cost)
      const res = await fetch('/api/ghostwriter', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ 
          prompt: customPrompt || flowDNA?.referenceText || "Write a track focused on ambition and survival.",
          title: audioData?.fileName || "Untitled Track",
          bpm: audioData?.bpm,
          key: audioData?.key,
          tag: flowDNA?.tag || "GetNice Hybrid",
          blueprint: blueprint
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ghostwriter API Failed");

      // 2. Simulate Polling/Generation Delay for the UI (Replace with actual Runpod Polling if implemented)
      await delay(4000);
      if (!isMounted.current) return;

      // Mock output formatting based on blueprint
      let mockLyrics = `[PRODUCED BY TALON ENGINE]\n[STYLE: ${flowDNA?.tag || "GetNice Hybrid"}]\n\n`;
      blueprint.forEach(block => {
        mockLyrics += `[${block.type} - ${block.bars} BARS]\n`;
        if (block.type === "HOOK") mockLyrics += "Yeah, we locked in the Matrix, never going back\nI got the code, I got the vision, stay focused on the track\n(Repeat)\n\n";
        else mockLyrics += "Step in the room, the energy shift\nI don't need luck, I'm working the gift\nRunning the numbers, checking the stats\nThey want the formula, I got the maps\n\n";
      });

      setGeneratedLyrics(mockLyrics);
      setStatus("success");
      if(addToast) addToast(`Ghostwriter synthesized. ${currentCost} CRD deducted.`, "success");

    } catch (err: any) {
      if(addToast) addToast(err.message, "error");
      setStatus("idle");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center max-w-5xl mx-auto animate-in fade-in py-10 overflow-y-auto custom-scrollbar">
      
      {status === "idle" && (
        <div className="w-full">
          <div className="text-center mb-12">
            <h2 className="font-oswald text-4xl uppercase tracking-widest mb-4 font-bold flex items-center justify-center gap-4 text-white">
              <PenTool className="text-[#E60000]" size={40} /> Ghostwriter Suite
            </h2>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Zap size={14} className={hasEnoughCredits ? "text-yellow-500" : "text-[#555]"} />
              <span className={`text-[10px] font-mono uppercase font-bold tracking-widest ${hasEnoughCredits ? 'text-white' : 'text-[#E60000]'}`}>
                {hasEnoughCredits ? "TALON Engine Ready" : `Credits Depleted - Requires ${currentCost} CRD`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full mb-8">
            
            {/* Left Col: Dynamic Blueprint Editor */}
            <div className="bg-[#050505] border border-[#222] p-8 flex flex-col rounded-lg relative">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-oswald text-xl uppercase tracking-widest font-bold text-white">Structural Mapping</h3>
                
                {/* DYNAMIC COST INDICATOR */}
                {!isMogul && (
                  <div className={`text-[10px] font-mono uppercase px-3 py-1 font-bold flex items-center gap-1 ${hasEnoughCredits ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/30' : 'bg-red-500/10 text-red-500 border border-red-500/30'}`}>
                    Cost: {currentCost} CRD
                  </div>
                )}
              </div>

              {!isMogul && (
                <div className="flex items-start gap-2 mb-6 p-3 bg-[#111] border border-[#333]">
                  <Info size={14} className="text-[#888] shrink-0 mt-0.5" />
                  <p className="text-[9px] font-mono text-[#888] uppercase tracking-widest leading-relaxed">
                    1 Credit synthesizes up to 2 blocks (e.g., 1 Hook & 1 Verse). Adding more blocks will dynamically increase the credit cost.
                  </p>
                </div>
              )}

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3 max-h-[300px]">
                {blueprint.map((block, index) => (
                  <div key={block.id} className="flex items-center gap-3 bg-[#0a0a0a] border border-[#222] p-3 group hover:border-[#E60000]/50 transition-colors">
                    <span className="font-oswald text-[#555] text-xs w-4">{(index + 1)}</span>
                    
                    <select 
                      value={block.type} 
                      onChange={(e) => updateBlockType(index, e.target.value)} 
                      className="bg-black text-white font-oswald uppercase p-1.5 text-xs outline-none border border-[#333] focus:border-[#E60000]"
                    >
                      <option value="INTRO">Intro</option>
                      <option value="HOOK">Hook</option>
                      <option value="VERSE">Verse</option>
                      <option value="BRIDGE">Bridge</option>
                      <option value="OUTRO">Outro</option>
                    </select>
                    
                    <div className="flex items-center gap-2 font-mono text-xs mx-auto">
                      <button onClick={() => updateBlockBars(index, -1)} className="text-[#888] hover:text-[#E60000] p-1"><Minus size={12} /></button>
                      <span className="w-12 text-center text-white">{block.bars} <span className="text-[8px] text-[#555]">BARS</span></span>
                      <button onClick={() => updateBlockBars(index, 1)} className="text-[#888] hover:text-green-500 p-1"><Plus size={12} /></button>
                    </div>

                    <button 
                      onClick={() => handleRemoveBlock(index)} 
                      disabled={blueprint.length <= 1}
                      className="text-[#333] hover:text-[#E60000] disabled:opacity-20 p-2"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button 
                onClick={handleAddBlock}
                className="mt-4 w-full border border-dashed border-[#333] text-[#555] py-3 text-[10px] font-mono uppercase tracking-widest hover:border-white hover:text-white transition-colors flex justify-center items-center gap-2"
              >
                <Plus size={14} /> Add Structural Block
              </button>
            </div>

            {/* Right Col: Thematic Priming */}
            <div className="bg-[#050505] border border-[#222] p-8 flex flex-col rounded-lg">
              <h3 className="font-oswald text-xl uppercase tracking-widest mb-6 font-bold text-white flex items-center gap-2">
                <Sparkles size={18} className="text-[#E60000]" /> Context / Topic
              </h3>
              
              <div className="mb-6 p-4 bg-[#110000] border border-[#330000]">
                <p className="font-oswald text-xs text-[#E60000] uppercase tracking-widest mb-1">Active DNA Profile</p>
                <p className="font-mono text-xs text-white">{flowDNA?.tag || "GetNice Default"}</p>
              </div>

              <textarea 
                value={customPrompt} 
                onChange={(e) => setCustomPrompt(e.target.value)} 
                placeholder="What is this track about? (e.g., 'Late night drives, reflecting on the past, feeling untouchable')" 
                className="flex-1 bg-black border border-[#111] p-4 text-white font-mono text-xs outline-none h-40 resize-none focus:border-[#E60000] transition-colors"
              />
            </div>
          </div>

          {/* GENERATE BUTTON */}
          <div className="relative group">
            {!hasEnoughCredits && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center border border-[#E60000]/20 rounded">
                <Lock size={24} className="text-[#E60000] mb-2" />
                <p className="text-[10px] uppercase font-bold text-white tracking-widest">Requires {currentCost} Credits</p>
              </div>
            )}
            <button
              disabled={!hasEnoughCredits || isGenerating}
              onClick={handleGenerate}
              className="w-full bg-[#E60000] text-white py-6 font-oswald text-lg font-bold uppercase tracking-[0.4em] hover:bg-red-700 transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(230,0,0,0.15)] disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="animate-spin" /> : "Synthesize Ghostwriter Lyrics"}
              {!isGenerating && <PenTool size={18} />}
            </button>
          </div>
        </div>
      )}

      {status === "analyzing" && (
        <div className="flex flex-col items-center">
          <Activity size={80} className="text-[#E60000] animate-spin mb-8" />
          <h2 className="font-oswald text-4xl uppercase tracking-widest mb-4 font-bold text-white">Connecting to TALON</h2>
          <p className="font-mono text-[10px] text-[#E60000] uppercase animate-pulse">Running advanced linguistic models...</p>
        </div>
      )}

      {status === "success" && (
        <div className="w-full animate-in zoom-in max-w-4xl mx-auto flex flex-col h-full py-4">
          <div className="flex justify-between items-end mb-6 border-b border-[#222] pb-4 shrink-0">
             <div>
               <h2 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white flex items-center gap-3">
                 <CheckCircle2 className="text-green-500" size={28} /> Manuscript Ready
               </h2>
               <p className="font-mono text-[10px] text-[#888] uppercase tracking-widest mt-2">
                 Editable Lyrical Output // Formatted for Teleprompter
               </p>
             </div>
          </div>

          <textarea 
            value={generatedLyrics || ""}
            onChange={(e) => setGeneratedLyrics(e.target.value)}
            className="flex-1 w-full bg-[#050505] border border-[#222] p-8 text-white font-mono text-sm outline-none focus:border-[#E60000] resize-none custom-scrollbar mb-6 shadow-inner leading-loose"
          />

          <button 
            onClick={() => setActiveRoom("04")} 
            className="w-full shrink-0 bg-white text-black py-5 font-oswald font-bold text-lg uppercase tracking-[0.2em] hover:bg-[#E60000] hover:text-white transition-colors flex items-center justify-center gap-3"
          >
            Enter Vocal Booth <ArrowRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}