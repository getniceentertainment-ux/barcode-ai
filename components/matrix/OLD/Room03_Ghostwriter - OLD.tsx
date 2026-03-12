"use client";

import React, { useState } from "react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { PenTool, Loader2, Sparkles, RefreshCw, ArrowRight, Trash2, Plus, BrainCircuit } from "lucide-react";
import { BlueprintSection } from "../../lib/types";

export default function Room03_Ghostwriter() {
  const { audioData, flowDNA, setActiveRoom, userSession, blueprint, setBlueprint } = useMatrixStore();
  
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [flowStyle, setFlowStyle] = useState("drill");
  const [gender, setGender] = useState("male");
  const [useSlang, setUseSlang] = useState(true);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [lyrics, setLyrics] = useState("");
  
  const [selectedLine, setSelectedLine] = useState<{index: number, text: string} | null>(null);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [isRefining, setIsRefining] = useState(false);

  // --- BLUEPRINT EDITING CONTROLS ---
  const updateBlock = (index: number, key: keyof BlueprintSection, value: any) => {
    const newBlueprint = [...blueprint];
    newBlueprint[index] = { ...newBlueprint[index], [key]: value };
    setBlueprint(newBlueprint);
  };

  const removeBlock = (index: number) => {
    const newBlueprint = [...blueprint];
    newBlueprint.splice(index, 1);
    setBlueprint(newBlueprint);
  };

  const addBlock = () => {
    const newBlueprint = [...blueprint, { id: String(Date.now()), type: "VERSE", bars: 8 } as BlueprintSection];
    setBlueprint(newBlueprint);
  };

  const handleGenerate = async () => {
    if (!userSession?.id) {
      alert("Authentication error: You must be logged in.");
      return;
    }

    setIsGenerating(true);
    setLyrics("");

    try {
      const res = await fetch('/api/ghostwriter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: userSession.id,
          title: title, // Passing the title!
          prompt, 
          bpm: audioData?.bpm || 140, 
          tag: flowDNA?.tag || "Trap", 
          style: flowStyle, 
          gender, 
          useSlang, 
          blueprint: blueprint.map(b => ({ type: b.type, bars: b.bars }))
        })
      });

      const rawText = await res.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        throw new Error(`Server Error: ${rawText.substring(0, 60)}...`);
      }
      
      if (res.ok && data.lyrics) {
        setLyrics(data.lyrics);
      } else {
        throw new Error(data.error || "Failed to generate lyrics");
      }
    } catch (err: any) {
      console.error(err);
      alert("Generation Error: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // ... handleRefine stays the same
  const handleRefine = async () => {
    if (!selectedLine || !refineInstruction || !userSession?.id) return;
    setIsRefining(true);
    
    try {
      const res = await fetch('/api/ghostwriter/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userSession.id,
          originalLine: selectedLine.text,
          instruction: refineInstruction,
          style: flowStyle
        })
      });

      const rawText = await res.text();
      let data;
      try { data = JSON.parse(rawText); } catch (e) { throw new Error(`Server Error: ${rawText.substring(0, 50)}...`); }
      
      if (res.ok && data.refinedLine) {
        const lyricsArray = lyrics.split('\n');
        lyricsArray[selectedLine.index] = data.refinedLine;
        setLyrics(lyricsArray.join('\n'));
        setSelectedLine(null);
        setRefineInstruction("");
      } else { throw new Error(data.error || "Failed to refine line"); }
    } catch (err: any) { console.error(err); alert("Refinement Error: " + err.message); } finally { setIsRefining(false); }
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-[#050505] animate-in fade-in duration-500 border border-[#222]">
      
      {/* LEFT COL: GETNICE AI SETTINGS */}
      <div className="w-full md:w-[45%] lg:w-[40%] border-r border-[#222] flex flex-col bg-black overflow-y-auto custom-scrollbar">
        <div className="p-6 border-b border-[#222] sticky top-0 bg-black z-10">
          <h2 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white flex items-center gap-3">
            <PenTool size={24} className="text-[#E60000]" /> GETNICE AI
          </h2>
        </div>

        <div className="p-6 space-y-8">
          
          {/* Section 1: Core Prompting */}
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-[#E60000] font-bold font-mono uppercase tracking-widest mb-2 block border-b border-[#222] pb-1">1. Track Identity</label>
              <input 
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Song Title (e.g. Matrix Runner)"
                className="w-full bg-[#111] border border-[#333] p-3 text-xs font-mono text-white outline-none focus:border-[#E60000] mb-3"
              />
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Thematic Prompt (e.g. Grinding in the matrix, rising up...)"
                className="w-full bg-[#111] border border-[#333] p-3 text-xs font-mono text-white outline-none focus:border-[#E60000] h-20 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-[#888] font-mono uppercase tracking-widest mb-2 block">Flow Style</label>
                <select 
                  value={flowStyle} onChange={(e) => setFlowStyle(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] p-2 text-[10px] font-mono text-white outline-none focus:border-[#E60000]"
                >
                  <option value="drill">NY Drill</option>
                  <option value="trap">Atlanta Trap</option>
                  <option value="boom_bap">Boom Bap</option>
                  <option value="rnb">R&B Melodic</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[#888] font-mono uppercase tracking-widest mb-2 block">Vocal Matrix</label>
                <select 
                  value={gender} onChange={(e) => setGender(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] p-2 text-[10px] font-mono text-white outline-none focus:border-[#E60000]"
                >
                  <option value="male">Male (Gritty)</option>
                  <option value="female">Female (Sharp)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Interactive Smart Blueprint */}
          <div className="bg-[#110000] border border-[#E60000]/30 p-4 rounded-sm">
            <div className="flex justify-between items-center mb-4 border-b border-[#E60000]/30 pb-2">
              <label className="text-[10px] text-[#E60000] font-bold font-mono uppercase tracking-widest flex items-center gap-2">
                <BrainCircuit size={14} /> 2. Smart Analysis Import
              </label>
              <span className="text-[9px] font-mono text-[#E60000] uppercase">
                {blueprint.reduce((acc, curr) => acc + curr.bars, 0)} Total Bars
              </span>
            </div>
            
            <p className="text-[9px] font-mono text-[#888] mb-4 leading-relaxed">
              * The DSP node automatically constructed this optimal layout based on your beat's length. Modify as needed before generating.
            </p>

            <div className="space-y-2 mb-4">
              {blueprint.map((block, index) => (
                <div key={block.id} className="flex items-center gap-2 bg-black border border-[#222] p-2 group hover:border-[#E60000]/50 transition-colors">
                  <div className="w-6 text-center text-[9px] text-[#555] font-mono">{index + 1}.</div>
                  
                  <select 
                    value={block.type}
                    onChange={(e) => updateBlock(index, 'type', e.target.value)}
                    className="bg-transparent border-none text-[10px] font-mono text-white p-1 outline-none font-bold"
                  >
                    <option value="INTRO">INTRO</option>
                    <option value="VERSE">VERSE</option>
                    <option value="HOOK">HOOK</option>
                    <option value="BRIDGE">BRIDGE</option>
                    <option value="OUTRO">OUTRO</option>
                  </select>

                  <div className="flex items-center bg-[#111] px-2 ml-auto">
                    <input 
                      type="number" 
                      value={block.bars}
                      onChange={(e) => updateBlock(index, 'bars', parseInt(e.target.value) || 0)}
                      className="w-10 bg-transparent text-[10px] font-mono text-white p-1 outline-none text-center"
                    />
                    <span className="text-[9px] text-[#555] font-mono pr-1">Bars</span>
                  </div>

                  <button onClick={() => removeBlock(index)} className="text-[#444] hover:text-[#E60000] transition-colors p-1">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            <button 
              onClick={addBlock}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-[#E60000]/30 text-[#E60000] py-2 text-[10px] uppercase tracking-widest font-bold hover:bg-[#E60000]/10 transition-colors"
            >
              <Plus size={12} /> Add Custom Block
            </button>
          </div>

          <button 
            onClick={handleGenerate}
            disabled={isGenerating || !prompt || blueprint.length === 0}
            className="w-full bg-[#E60000] text-white py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50 flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(230,0,0,0.2)]"
          >
            {isGenerating ? <><Loader2 size={18} className="animate-spin" /> Uplinking to Node...</> : <><Sparkles size={18} /> Initialize Ghostwriter</>}
          </button>
        </div>
      </div>

      {/* RIGHT COL: THE NOTEPAD & REFINEMENT (Same as before) */}
      <div className="flex-1 flex flex-col bg-[#0a0a0a] relative p-6">
        <h3 className="font-oswald text-sm uppercase tracking-widest text-white border-b border-[#222] pb-3 mb-4 font-bold flex justify-between items-center">
          <span>Digital Notepad {title && `- ${title}`}</span>
          {lyrics && <span className="text-[9px] text-green-500 font-mono">Sync Complete</span>}
        </h3>

        {lyrics ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-black border border-[#222] p-6 text-sm font-mono leading-loose text-gray-300 shadow-inner">
            {lyrics.split('\n').map((line, i) => {
              const isHeader = line.startsWith('[');
              return (
                <div 
                  key={i} 
                  onClick={() => !isHeader && line.trim() !== "" && setSelectedLine({ index: i, text: line })}
                  className={`
                    ${isHeader ? 'text-[#E60000] font-bold mt-6 mb-2 text-[10px] tracking-widest' : 'cursor-pointer px-2 py-1 rounded transition-colors'}
                    ${!isHeader && selectedLine?.index === i ? 'bg-[#E60000]/20 border-l-2 border-[#E60000]' : !isHeader ? 'hover:bg-[#111]' : ''}
                  `}
                >
                  {line}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center border border-dashed border-[#333] opacity-50 bg-black">
            <div className="text-center">
              {isGenerating ? (
                <div className="text-[#E60000] flex flex-col items-center">
                  <Loader2 size={32} className="animate-spin mb-4" />
                  <p className="font-mono text-xs uppercase tracking-widest">GETNICE is writing...</p>
                  <p className="font-mono text-[9px] mt-2 opacity-50">Deep generation active. This may take 3-5 minutes based on track length.</p>
                </div>
              ) : (
                <p className="font-mono text-xs uppercase tracking-widest text-[#555]">Awaiting instructions...</p>
              )}
            </div>
          </div>
        )}

        {/* REFINEMENT TRAY */}
        {selectedLine && (
          <div className="mt-4 bg-[#110000] border border-[#E60000] p-4 animate-in slide-in-from-bottom-4 shadow-[0_0_20px_rgba(230,0,0,0.1)]">
            {/* ... Refinement UI ... */}
             <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] text-[#E60000] font-mono uppercase font-bold tracking-widest">Micro-Refinement Active</span>
              <button onClick={() => setSelectedLine(null)} className="text-[#888] hover:text-white text-xs">✕</button>
            </div>
            <p className="text-xs font-mono text-white mb-3 bg-black p-2 border border-[#333]">"{selectedLine.text}"</p>
            
            <div className="flex gap-2">
              <input 
                type="text" 
                value={refineInstruction}
                onChange={(e) => setRefineInstruction(e.target.value)}
                placeholder="Make it rhyme with 'cash'..."
                className="flex-1 bg-black border border-[#333] p-2 text-xs font-mono text-white outline-none focus:border-[#E60000]"
              />
              <button 
                onClick={handleRefine}
                disabled={isRefining || !refineInstruction}
                className="bg-[#E60000] text-white px-4 font-oswald text-sm font-bold uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isRefining ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refine
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button 
            onClick={() => setActiveRoom("04")}
            disabled={!lyrics}
            className="bg-white text-black px-8 py-3 font-oswald text-sm font-bold uppercase tracking-widest hover:bg-gray-200 transition-all disabled:opacity-20 flex justify-center items-center gap-2"
          >
            Proceed to Booth <ArrowRight size={16} />
          </button>
        </div>
      </div>

    </div>
  );
}