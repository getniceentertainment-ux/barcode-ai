"use client";

import React, { useState, useEffect } from "react";
import { Mic2, Activity, CheckCircle2, BrainCircuit, Plus, Minus, ArrowRight } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { BlueprintSection } from "../../lib/types";

export default function Room02_BrainTrain() {
  const { setFlowDNA, setActiveRoom, audioData, blueprint, setBlueprint } = useMatrixStore();

  const [status, setStatus] = useState<"idle" | "analyzing" | "success">("idle");
  const [micStatus, setMicStatus] = useState<"idle" | "listening" | "recorded">("idle");
  const [textInput, setTextInput] = useState("");

  const handleRecordCadence = () => {
    setMicStatus("listening");
    setTimeout(() => setMicStatus("recorded"), 3000);
  };

  const handleSynthesize = () => {
    setStatus("analyzing");
    
    setTimeout(() => {
      setFlowDNA({
        tag: micStatus === "recorded" && textInput.trim() ? "Hybrid Flow DNA" : 
             micStatus === "recorded" ? "Audio Cadence DNA" : "Lyrical Text DNA",
        referenceText: textInput.trim() || "Focus on the struggle, the hustle, and survival.",
        syllableDensity: 3.5 
      });

      // AUTO-CALCULATE STRUCTURAL BLUEPRINT BASED ON TOTAL BARS
      if (audioData?.totalBars && blueprint.length <= 3) {
        let remaining = audioData.totalBars;
        const calc: BlueprintSection[] = [];
        
        if (remaining >= 4) { calc.push({ id: "intro", type: "INTRO", bars: 4 }); remaining -= 4; }
        if (remaining >= 4) { remaining -= 4; } // Save 4 for outro

        let idCounter = 1;
        while (remaining >= 24) {
          calc.push({ id: `hook_${idCounter}`, type: "HOOK", bars: 8 }); remaining -= 8;
          calc.push({ id: `verse_${idCounter}`, type: "VERSE", bars: 16 }); remaining -= 16;
          idCounter++;
        }
        
        if (remaining >= 8) { calc.push({ id: `hook_${idCounter}`, type: "HOOK", bars: 8 }); remaining -= 8; }
        calc.push({ id: "outro", type: "OUTRO", bars: remaining + 4 });

        setBlueprint(calc);
      }

      setStatus("success");
    }, 2500);
  };

  const updateBlueprintBar = (index: number, delta: number) => {
    const newBp = [...blueprint];
    newBp[index].bars = Math.max(1, newBp[index].bars + delta);
    setBlueprint(newBp);
  };

  const updateBlueprintType = (index: number, newType: any) => {
    const newBp = [...blueprint];
    newBp[index].type = newType;
    setBlueprint(newBp);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center max-w-5xl mx-auto animate-in fade-in duration-500 overflow-y-auto custom-scrollbar py-10">
      
      {status === "idle" && (
        <div className="w-full">
          <div className="text-center mb-12">
            <h2 className="font-oswald text-4xl uppercase tracking-widest mb-4 font-bold flex items-center justify-center gap-4 text-white">
              <BrainCircuit className="text-[#E60000]" size={40} /> Brain Train Matrix
            </h2>
            <p className="font-mono text-xs text-[#555] uppercase tracking-[0.2em]">Inject vocal cadence or lyrical structure to prime the TALON Engine.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mb-10">
            <div className={`bg-[#050505] border p-8 flex flex-col items-center text-center rounded-lg group transition-all duration-300 ${micStatus === 'listening' ? 'border-[#E60000] shadow-[0_0_20px_rgba(230,0,0,0.1)]' : 'border-[#222] hover:border-[#E60000]/50'}`}>
              <h3 className="font-oswald text-xl uppercase tracking-widest mb-8 font-bold text-white">1. Audio Cadence</h3>
              <button onClick={handleRecordCadence} disabled={micStatus !== 'idle'} className={`w-24 h-24 rounded-full border-2 flex items-center justify-center mb-8 transition-all duration-300 ${micStatus === 'listening' ? 'bg-[#110000] border-[#E60000] animate-pulse text-[#E60000]' : micStatus === 'recorded' ? 'bg-[#E60000]/10 border-green-500 text-green-500' : 'bg-black border-[#222] text-[#444] group-hover:text-white group-hover:border-white'}`}>
                {micStatus === 'recorded' ? <CheckCircle2 size={40} /> : <Mic2 size={40} />}
              </button>
            </div>

            <div className="bg-[#050505] border border-[#222] p-8 flex flex-col rounded-lg group hover:border-[#E60000]/50 transition-all duration-300">
              <h3 className="font-oswald text-xl uppercase tracking-widest mb-6 font-bold text-white">2. Lyrical DNA</h3>
              <p className="text-[9px] font-mono text-[#555] uppercase mb-4 tracking-widest">Paste previous bars for rhyme & syllable extraction</p>
              <textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="I see the vision, I'm making a killing..." className="flex-1 bg-black border border-[#111] p-4 text-white font-mono text-xs outline-none focus:border-[#E60000] h-40 custom-scrollbar resize-none transition-colors" />
            </div>
          </div>
          <button disabled={micStatus === 'idle' && textInput.trim() === ""} onClick={handleSynthesize} className="w-full bg-[#E60000] disabled:opacity-20 disabled:cursor-not-allowed text-white py-6 font-oswald text-lg font-bold uppercase tracking-[0.4em] rounded transition-all hover:bg-red-700">
            Synthesize Flow DNA
          </button>
        </div>
      )}

      {status === "analyzing" && (
        <div className="flex flex-col items-center">
          <Activity size={80} className="text-[#E60000] animate-spin mb-8" />
          <h2 className="font-oswald text-4xl uppercase tracking-widest mb-4 font-bold text-white">Extracting DNA</h2>
        </div>
      )}

      {status === "success" && (
        <div className="w-full animate-in zoom-in duration-500">
          <div className="text-center mb-8 border-b border-[#222] pb-8">
            <CheckCircle2 size={64} className="text-green-500 mx-auto mb-4 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full" />
            <h2 className="font-oswald text-3xl uppercase tracking-widest mb-2 font-bold text-white">DNA & Blueprint Locked</h2>
          </div>

          {/* THE NEW STRUCTURAL MATH EDITOR */}
          <div className="bg-black border border-[#222] p-8 max-w-3xl mx-auto mb-8 shadow-lg">
             <div className="flex justify-between items-center mb-6 border-b border-[#111] pb-4">
               <h3 className="text-xl text-[#E60000] font-oswald uppercase tracking-widest font-bold">DSP Structural Blueprint</h3>
               <div className="font-mono text-[10px] text-[#888] uppercase tracking-widest flex gap-6">
                 <span>Detected Key: <span className="text-white">{audioData?.key}</span></span>
                 <span>Total DSP Bars: <span className="text-white">{audioData?.totalBars || 0}</span></span>
               </div>
             </div>

             <div className="space-y-3">
               {blueprint.map((block, index) => (
                 <div key={block.id} className="flex items-center gap-4 bg-[#0a0a0a] border border-[#222] p-3">
                   <span className="font-oswald text-[#555] w-6">{(index + 1).toString().padStart(2, '0')}</span>
                   
                   <select 
                     value={block.type} onChange={(e) => updateBlueprintType(index, e.target.value)}
                     className="bg-black border border-[#333] text-white font-oswald uppercase tracking-widest p-2 text-sm outline-none focus:border-[#E60000]"
                   >
                     <option value="INTRO">Intro</option><option value="HOOK">Hook</option><option value="VERSE">Verse</option><option value="BRIDGE">Bridge</option><option value="OUTRO">Outro</option>
                   </select>

                   <div className="ml-auto flex items-center gap-4">
                     <button onClick={() => updateBlueprintBar(index, -1)} className="text-[#888] hover:text-[#E60000]"><Minus size={16} /></button>
                     <span className="font-mono text-sm w-12 text-center text-white">{block.bars} <span className="text-[9px] text-[#555]">BARS</span></span>
                     <button onClick={() => updateBlueprintBar(index, 1)} className="text-[#888] hover:text-green-500"><Plus size={16} /></button>
                   </div>
                 </div>
               ))}
             </div>
             <div className="mt-4 flex justify-between font-mono text-[10px] uppercase text-[#555]">
                <span>Allocated Bars: {blueprint.reduce((a, b) => a + b.bars, 0)}</span>
                <span className={blueprint.reduce((a, b) => a + b.bars, 0) !== audioData?.totalBars ? "text-yellow-500" : "text-green-500"}>
                  {blueprint.reduce((a, b) => a + b.bars, 0) === audioData?.totalBars ? "Perfect Math Alignment" : "Math Mismatch (Will still generate)"}
                </span>
             </div>
          </div>
          
          <button onClick={() => setActiveRoom("03")} className="flex items-center justify-center gap-3 w-full max-w-3xl mx-auto bg-white text-black py-5 font-oswald font-bold text-lg uppercase tracking-[0.2em] hover:bg-[#E60000] hover:text-white transition-colors">
            Transmit Blueprint to Ghostwriter <ArrowRight size={20} />
          </button>
        </div>
      )}

    </div>
  );
}