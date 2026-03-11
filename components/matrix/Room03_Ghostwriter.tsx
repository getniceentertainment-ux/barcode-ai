"use client";

import React, { useState } from "react";
import { PenTool, Play, RefreshCw, Zap, AlignLeft, Edit3, Loader2, Activity, Plus, Minus } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function Room03_Ghostwriter() {
  const { 
    audioData, flowDNA, blueprint, setBlueprint, generatedLyrics, setGeneratedLyrics, setActiveRoom, addToast,
    gwTitle, setGwTitle, gwPrompt, setGwPrompt, gwStyle, setGwStyle, gwGender, setGwGender, 
    gwUseSlang, setGwUseSlang, gwUseIntel, setGwUseIntel, userSession
  } = useMatrixStore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [lyrics, setLyrics] = useState(generatedLyrics || "");
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [uxState, setUxState] = useState("Initializing Secure API Handshake...");
  
  // Micro-Refinement State
  const [isRefining, setIsRefining] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [selectedLine, setSelectedLine] = useState("");

  const styles = [
    { id: "getnice_hybrid", name: "GetNice Hybrid Triplet" },
    { id: "drill", name: "NY Drill" },
    { id: "boom_bap", name: "Boom Bap" },
    { id: "melodic_trap", name: "Melodic Trap" },
    { id: "chopper", name: "Chopper (Fast)" }
  ];

  // BLUEPRINT EDITOR LOGIC
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

  const handleGenerate = async () => {
    setIsGenerating(true);
    setPollingAttempts(0);
    setUxState("Verifying Authentication...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Security Exception: Missing Session Token. Please log in.");

      setUxState("Initializing Secure API Handshake...");

      const initRes = await fetch('/api/ghostwriter', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          prompt: gwPrompt,
          title: gwTitle,
          bpm: audioData?.bpm,
          key: audioData?.key, 
          stageName: userSession?.stageName,
          tag: flowDNA?.tag,
          style: gwStyle,
          gender: gwGender, // Passed for AI persona context
          useSlang: gwUseSlang,
          useIntel: gwUseIntel,
          blueprint: blueprint.map(b => ({ type: b.type, bars: b.bars }))
        })
      });

      const initData = await initRes.json();
      if (!initRes.ok) throw new Error(initData.error || "Failed to initialize TALON.");

      const jobId = initData.jobId;
      let attempts = 0;

      const pollInterval = setInterval(async () => {
        attempts++;
        setPollingAttempts(attempts);
        if (attempts > 2) setUxState("Warming up Neural Network (Cold Start)...");
        else setUxState("Synthesizing Bars...");

        try {
          const statusRes = await fetch(`/api/ghostwriter?jobId=${jobId}`);
          const statusData = await statusRes.json();

          if (statusData.status === 'COMPLETED') {
            clearInterval(pollInterval);
            setIsGenerating(false);
            setLyrics(statusData.output.lyrics);
            setGeneratedLyrics(statusData.output.lyrics);
            if(addToast) addToast("Lyrics Synthesized Successfully.", "success");
          } else if (statusData.status === 'FAILED') {
            clearInterval(pollInterval);
            setIsGenerating(false);
            if(addToast) addToast("RunPod Execution Failed.", "error");
          }
        } catch (pollErr) {
            console.error("Polling Error", pollErr);
        }
      }, 3000);

    } catch (err: any) {
      console.error(err);
      setIsGenerating(false);
      if(addToast) addToast(err.message, "error");
    }
  };

  const handleRefine = async () => {
    if (!selectedLine || !refineInstruction) return;
    setIsRefining(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Security Exception: Missing Session Token.");

      const res = await fetch('/api/ghostwriter/refine', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          originalLine: selectedLine, 
          instruction: refineInstruction,
          style: gwStyle 
        })
      });

      if (!res.ok) throw new Error("Refinement API Error");

      const data = await res.json();
      const updatedLyrics = lyrics.replace(selectedLine, data.refinedLine);
      setLyrics(updatedLyrics);
      setGeneratedLyrics(updatedLyrics);
      setRefineInstruction("");
      setSelectedLine("");
      if(addToast) addToast("Micro-refinement applied.", "success");
      
    } catch (err: any) {
      if(addToast) addToast(err.message || "Failed to refine line.", "error");
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <div className="flex h-full bg-[#050505] border border-[#222] rounded-lg overflow-hidden animate-in fade-in duration-500">
      
      {/* LEFT COL: TALON PARAMETERS */}
      <div className="w-1/3 border-r border-[#222] flex flex-col relative overflow-y-auto custom-scrollbar bg-[#020202]">
        <div className="p-6 border-b border-[#222] bg-black sticky top-0 z-10">
          <h2 className="font-oswald text-2xl uppercase tracking-widest font-bold text-[#E60000] flex items-center gap-3">
            <PenTool size={24} /> TALON Engine
          </h2>
          <p className="font-mono text-[10px] text-[#555] uppercase mt-2 tracking-widest">
            Neural Parameter Matrix
          </p>
        </div>

        <div className="p-6 space-y-6 flex-1">
          
          {/* VOCALIST PROFILE (Stage Name & Gender) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] font-mono text-[#888] uppercase tracking-widest mb-2 block">Stage Name</label>
              <input 
                type="text" readOnly value={userSession?.stageName || "Unknown"} 
                className="w-full bg-[#111] border border-[#333] p-3 text-[10px] text-gray-500 font-mono outline-none cursor-not-allowed uppercase truncate" 
                title={userSession?.stageName}
              />
            </div>
            <div>
              <label className="text-[9px] font-mono text-[#888] uppercase tracking-widest mb-2 block">Vocal Gender</label>
              <select 
                value={gwGender} onChange={(e) => setGwGender(e.target.value)} 
                className="w-full bg-black border border-[#333] p-3 text-[10px] text-white font-oswald uppercase tracking-widest outline-none focus:border-[#E60000] transition-colors cursor-pointer"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono text-[#888] uppercase tracking-widest mb-2 block">Track Title</label>
            <input type="text" value={gwTitle} onChange={(e) => setGwTitle(e.target.value)} placeholder="NEON BLOOD..." className="w-full bg-black border border-[#333] p-3 text-xs text-white font-mono outline-none focus:border-[#E60000] transition-colors" />
          </div>

          <div>
            <label className="text-[10px] font-mono text-[#888] uppercase tracking-widest mb-2 block">Thematic Prompt</label>
            <textarea value={gwPrompt} onChange={(e) => setGwPrompt(e.target.value)} placeholder="Describe the vibe, the struggle, the story..." className="w-full h-24 bg-black border border-[#333] p-3 text-xs text-white font-mono outline-none focus:border-[#E60000] custom-scrollbar resize-none transition-colors" />
          </div>

          <div>
            <label className="text-[10px] font-mono text-[#888] uppercase tracking-widest mb-2 block">Flow Architecture</label>
            <select value={gwStyle} onChange={(e) => setGwStyle(e.target.value)} className="w-full bg-black border border-[#333] p-3 text-xs text-white font-oswald uppercase tracking-widest outline-none focus:border-[#E60000] transition-colors cursor-pointer">
              {styles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* DYNAMIC STRUCTURAL BLUEPRINT */}
          <div className="pt-4 border-t border-[#222]">
            <div className="flex justify-between items-end mb-3">
              <label className="text-[10px] font-mono text-[#888] uppercase tracking-widest block">Structural Blueprint</label>
              <span className="text-[9px] font-mono text-[#E60000] uppercase tracking-widest">{blueprint.reduce((a, b) => a + b.bars, 0)} Bars Total</span>
            </div>

            {/* The Visual Bar (DAW Timeline style) */}
            <div className="flex w-full h-1.5 mb-4 rounded-sm overflow-hidden gap-[2px] bg-[#111]">
              {blueprint.map((block, i) => (
                <div
                  key={block.id || i}
                  style={{ flex: block.bars }}
                  className={`h-full ${block.type === 'HOOK' ? 'bg-[#E60000]' : block.type === 'VERSE' ? 'bg-white' : block.type === 'INTRO' || block.type === 'OUTRO' ? 'bg-[#333]' : 'bg-[#777]'}`}
                  title={`${block.type} (${block.bars} Bars)`}
                />
              ))}
            </div>

            {/* The Blueprint Editor */}
            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
              {blueprint.map((block, index) => (
                <div key={block.id || index} className="flex items-center justify-between bg-[#111] border border-[#333] p-2 hover:border-[#E60000] transition-colors group">
                  <select
                    value={block.type} onChange={(e) => updateBlueprintType(index, e.target.value)}
                    className="bg-transparent text-white font-oswald uppercase tracking-widest text-[10px] outline-none cursor-pointer"
                  >
                    <option value="INTRO">Intro</option>
                    <option value="HOOK">Hook</option>
                    <option value="VERSE">Verse</option>
                    <option value="BRIDGE">Bridge</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                  <div className="flex items-center gap-3">
                    <button onClick={() => updateBlueprintBar(index, -1)} className="text-[#555] hover:text-[#E60000] transition-colors"><Minus size={12} /></button>
                    <span className="font-mono text-[10px] w-4 text-center text-white">{block.bars}</span>
                    <button onClick={() => updateBlueprintBar(index, 1)} className="text-[#555] hover:text-green-500 transition-colors"><Plus size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-[#222]">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={gwUseSlang} onChange={(e) => setGwUseSlang(e.target.checked)} className="accent-[#E60000] w-4 h-4" />
              <span className="text-xs font-mono text-[#888] uppercase tracking-widest group-hover:text-white transition-colors">Inject RAG Slang Dictionary</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={gwUseIntel} onChange={(e) => setGwUseIntel(e.target.checked)} className="accent-[#E60000] w-4 h-4" />
              <span className="text-xs font-mono text-[#888] uppercase tracking-widest group-hover:text-white transition-colors">Inject Daily Cultural Intel</span>
            </label>
          </div>
        </div>

        <div className="p-6 border-t border-[#222] bg-black sticky bottom-0">
          <button onClick={handleGenerate} disabled={isGenerating || !gwPrompt.trim()} className="w-full bg-[#E60000] text-white py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex justify-center items-center gap-3 shadow-[0_0_20px_rgba(230,0,0,0.2)]">
            {isGenerating ? <><Loader2 size={20} className="animate-spin" /> Synthesizing</> : <><Zap size={20} /> Generate Track</>}
          </button>
        </div>
      </div>

      {/* RIGHT COL: OUTPUT MATRIX */}
      <div className="flex-1 flex flex-col relative bg-[#050505]">
        <div className="h-16 border-b border-[#222] bg-black flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-3 text-[#555] font-mono text-[10px] uppercase tracking-widest">
            <AlignLeft size={16} /> Output Matrix 
            {audioData && <span className="text-[#E60000] ml-4">Locked to {Math.round(audioData.bpm)} BPM / {audioData.key}</span>}
          </div>
          <button onClick={() => setLyrics("")} className="text-[#555] hover:text-white transition-colors"><RefreshCw size={14} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
          {isGenerating ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[#E60000]">
              <Activity size={64} className="animate-pulse mb-6" />
              <p className="font-oswald text-2xl uppercase tracking-widest font-bold mb-2">{uxState}</p>
              <p className="font-mono text-xs text-[#555]">Passing blueprint to GPU cluster... Attempt {pollingAttempts}</p>
            </div>
          ) : lyrics ? (
            <div className="max-w-2xl mx-auto space-y-2 pb-32">
              {lyrics.split('\n').map((line, i) => {
                const isHeader = line.startsWith('[');
                return (
                  <p 
                    key={i} 
                    onClick={() => !isHeader && setSelectedLine(line)}
                    className={`font-mono text-sm leading-loose transition-all
                      ${isHeader ? 'text-[#E60000] font-bold mt-8 mb-4 tracking-widest text-xs' : 'text-gray-300 hover:text-white cursor-pointer hover:bg-[#111] p-1 rounded'}
                      ${selectedLine === line ? 'bg-[#E60000]/20 border-l-2 border-[#E60000] pl-3 text-white font-bold' : ''}
                    `}
                  >
                    {line}
                  </p>
                )
              })}
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none text-center">
              <div>
                <PenTool size={100} className="mx-auto mb-4" />
                <p className="font-oswald text-3xl uppercase tracking-widest">Awaiting Parameters</p>
              </div>
            </div>
          )}
        </div>

        {/* Micro-Refinement Tray */}
        <div className={`absolute bottom-0 left-0 w-full bg-black border-t border-[#E60000] p-6 transition-transform duration-300 ${selectedLine ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="flex justify-between items-center mb-4">
             <h4 className="font-oswald text-sm text-[#E60000] uppercase tracking-widest font-bold flex items-center gap-2"><Edit3 size={14} /> Micro-Refinement</h4>
             <button onClick={() => setSelectedLine("")} className="text-[#555] hover:text-white text-[10px] font-mono uppercase">Close [X]</button>
          </div>
          <p className="text-xs font-mono text-gray-400 mb-4 bg-[#111] p-3 border border-[#333] italic">"{selectedLine}"</p>
          <div className="flex gap-3">
             <input 
               type="text" value={refineInstruction} onChange={(e) => setRefineInstruction(e.target.value)}
               placeholder="E.g., Make it rhyme with 'cash', make it more aggressive..." 
               className="flex-1 bg-[#111] border border-[#333] p-3 text-xs text-white font-mono outline-none focus:border-[#E60000]"
             />
             <button 
               onClick={handleRefine} disabled={isRefining || !refineInstruction}
               className="bg-[#E60000] text-white px-8 font-oswald text-sm font-bold uppercase tracking-widest hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
             >
               {isRefining ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />} Rewrite Line
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}