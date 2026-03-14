"use client";

import React, { useState } from "react";
import { PenTool, Play, RefreshCw, Zap, AlignLeft, Edit3, Loader2, Layout, ShieldCheck, Cpu, Activity, ArrowRight, Info } from "lucide-react";
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
    { id: "getnice_hybrid", name: "GetNice Hybrid" },
    { id: "heartbeat", name: "Heartbeat (Boom-Bap)" },
    { id: "lazy", name: "Lazy (Wavy/Delayed)" },
    { id: "triplet", name: "Triplet (Trap)" },
    { id: "chopper", name: "Chopper (Fast/Tech)" }
  ];

  const calculateTotalBars = () => blueprint.reduce((acc, section) => acc + section.bars, 0);

  const addSection = (type: "VERSE" | "INTRO" | "HOOK" | "OUTRO" | "BRIDGE", bars: number) => {
    setBlueprint([...blueprint, { id: Math.random().toString(), type, bars }]);
  };
  
  const removeSection = (id: string) => {
    setBlueprint(blueprint.filter(b => b.id !== id));
  };

  const handleGenerate = async () => {
    if (!userSession?.id) return addToast("Security Exception: User Session missing.", "error");
    if (!gwPrompt.trim()) return addToast("Missing thematic directive.", "error");
    if (!audioData) return addToast("Instrumental DSP data missing. Return to Room 01.", "error");

    setIsGenerating(true);
    setPollingAttempts(0);
    setUxState("Securing JWT Token & Matrix Alignment...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Security Exception: Missing Session Token.");

      const initRes = await fetch('/api/ghostwriter', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: userSession?.id,
          prompt: gwPrompt,
          title: gwTitle,
          bpm: audioData?.bpm,
          key: audioData?.key, 
          stageName: userSession?.stageName, 
          tag: flowDNA?.tag,
          style: gwStyle,
          gender: gwGender,
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
          userId: userSession?.id,
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
      if(addToast) addToast("Failed to refine line.", "error");
    } finally {
      setIsRefining(false);
    }
  };

  // --- TELEPROMPTER PARSER ---
  // Transforms the raw syntax into a highly visual, color-coded rhythm map
  const renderLyricLine = (line: string) => {
    if (line.startsWith('[')) return line; // Headers handled in the main map

    // Split by the forward slash and the immediate word/syllable following it
    const parts = line.split(/(\/\s*[a-zA-Z0-9'-]+)/g);
    
    return (
      <>
        {parts.map((part, index) => {
          if (part.startsWith('/')) {
            const word = part.substring(1).trim();
            return (
              <span key={index}>
                <span className="text-[#00FFCC] font-bold mx-[2px] select-none text-lg leading-none drop-shadow-[0_0_8px_rgba(0,255,204,0.8)]">/</span>
                <span className="text-white font-extrabold">{word}</span>
              </span>
            );
          }
          return <span key={index} className="text-gray-400">{part}</span>;
        })}
      </>
    );
  };

  return (
    <div className="flex h-full bg-[#050505] border border-[#222] rounded-lg overflow-hidden animate-in fade-in duration-500">
      
      {/* LEFT COL: PROMPT ENGINE */}
      <div className="w-1/3 border-r border-[#222] flex flex-col relative overflow-y-auto custom-scrollbar shrink-0">
        <div className="p-6 border-b border-[#222] bg-black sticky top-0 z-10">
          <h2 className="font-oswald text-2xl uppercase tracking-widest font-bold text-[#E60000] flex items-center gap-3">
            <PenTool size={24} /> TALON Engine
          </h2>
          <p className="font-mono text-[10px] text-[#555] uppercase mt-2 tracking-widest">
            Neural Parameter Matrix
          </p>
        </div>

        <div className="p-6 space-y-6 flex-1">
          <div>
            <label className="text-[10px] font-mono text-[#888] uppercase tracking-widest mb-2 block font-bold">Track Title</label>
            <input 
              type="text" 
              value={gwTitle} 
              onChange={(e) => setGwTitle(e.target.value)} 
              placeholder="NEON BLOOD..." 
              className="w-full bg-black border border-[#333] p-3 text-xs text-white font-mono outline-none focus:border-[#E60000] transition-colors" 
            />
          </div>

          <div>
            <label className="text-[10px] font-mono text-[#888] uppercase tracking-widest mb-2 block font-bold">Thematic Prompt (Description)</label>
            <textarea 
              value={gwPrompt} 
              onChange={(e) => setGwPrompt(e.target.value)} 
              placeholder="Describe the vibe, the struggle, the story..." 
              className="w-full h-24 bg-black border border-[#333] p-3 text-xs text-white font-mono outline-none focus:border-[#E60000] custom-scrollbar resize-none transition-colors" 
            />
          </div>

          <div>
            <label className="text-[10px] font-mono text-[#888] uppercase tracking-widest mb-2 block font-bold">Flow Architecture</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {styles.map(s => (
                <button 
                  key={s.id}
                  onClick={() => {
                    if (s.id === 'user_flow' && !flowDNA) {
                      if(addToast) addToast("No User Flow DNA found. Return to Brain Train.", "error");
                      return;
                    }
                    setGwStyle(s.id);
                  }} 
                  className={`p-3 border font-oswald text-[10px] uppercase tracking-widest transition-all ${gwStyle === s.id ? 'bg-[#E60000] border-[#E60000] text-white' : 'bg-[#111] border-[#333] text-[#888] hover:text-white hover:border-[#555]'}`}
                >
                  {s.name}
                </button>
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
          <button 
            onClick={handleGenerate} 
            disabled={isGenerating || !gwPrompt.trim()} 
            className="w-full bg-[#E60000] text-white py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex justify-center items-center gap-3 shadow-[0_0_20px_rgba(230,0,0,0.2)]"
          >
            {isGenerating ? <><Loader2 size={20} className="animate-spin" /> Synthesizing</> : <><Zap size={20} /> Generate Track</>}
          </button>
        </div>
      </div>

      {/* RIGHT COL: BLUEPRINT VISUALIZER & LYRICS */}
      <div className="flex-1 flex flex-col relative bg-[#020202] overflow-hidden">
        
        {/* HEADER: BLUEPRINT DETAILS */}
        <div className="h-16 border-b border-[#222] bg-[#0a0a0a] flex items-center justify-between px-8 shrink-0">
           <h3 className="font-oswald text-lg uppercase tracking-widest text-[#888] flex items-center gap-3">
             <Layout size={16} /> Song Blueprint <span className="text-[#333]">|</span> <span className="text-[#E60000] text-sm">{calculateTotalBars()} Bars Target</span>
           </h3>
           <div className="flex items-center gap-4">
             {audioData && <span className="text-[#E60000] font-mono text-[10px] uppercase tracking-widest">Locked to {Math.round(audioData.bpm)} BPM</span>}
             <button onClick={() => {setLyrics(""); setGeneratedLyrics("");}} className="text-[#555] hover:text-white transition-colors"><RefreshCw size={14} /></button>
           </div>
        </div>

        {/* BLUEPRINT BLOCK BUILDER SCROLLBAR */}
        <div className="h-40 bg-black border-b border-[#222] overflow-x-auto flex items-center px-8 gap-4 shrink-0 custom-scrollbar shadow-[inset_0_-10px_20px_rgba(0,0,0,0.5)]">
          {blueprint.map((block, index) => (
            <div key={block.id} className="w-36 shrink-0 bg-[#050505] border border-[#333] p-4 flex flex-col justify-between h-24 group relative hover:border-[#E60000] transition-colors">
              <button onClick={() => removeSection(block.id)} className="absolute -top-2 -right-2 bg-red-900 text-white w-5 h-5 rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-lg">×</button>
              <div className="text-[9px] font-mono text-[#888] uppercase tracking-widest flex justify-between">
                <span>Block {index + 1}</span>
              </div>
              <div>
                <h4 className="font-oswald text-lg uppercase tracking-widest text-white">{block.type}</h4>
                <p className="font-mono text-[10px] text-[#E60000] font-bold">{block.bars} BARS</p>
              </div>
            </div>
          ))}
          <div className="w-36 shrink-0 bg-transparent border border-dashed border-[#333] p-3 flex flex-col justify-center h-24 gap-2">
            <p className="text-[8px] font-mono text-[#555] uppercase text-center tracking-widest">Add Structure</p>
            <div className="flex gap-1 justify-center">
              <button onClick={() => addSection("HOOK", 8)} className="bg-[#111] hover:bg-[#E60000] hover:text-white text-[#888] text-[9px] px-2 py-1 uppercase font-bold transition-colors">Hook</button>
              <button onClick={() => addSection("VERSE", 16)} className="bg-[#111] hover:bg-[#E60000] hover:text-white text-[#888] text-[9px] px-2 py-1 uppercase font-bold transition-colors">Verse</button>
            </div>
          </div>
        </div>

        {/* LYRICS DISPLAY ENVIRONMENT */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative bg-[#020202]">
          {isGenerating ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[#E60000]">
              <Activity size={64} className="animate-pulse mb-6" />
              <p className="font-oswald text-2xl uppercase tracking-widest font-bold mb-2">{uxState}</p>
              <p className="font-mono text-xs text-[#555]">Passing blueprint to GPU cluster... Attempt {pollingAttempts}</p>
            </div>
          ) : lyrics ? (
            <div className="max-w-2xl mx-auto space-y-2 pb-32">
              
              <div className="flex items-center justify-between border-b border-[#222] pb-6 mb-6">
                <div>
                  <h3 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white glow-red">{gwTitle || "UNTITLED ARTIFACT"}</h3>
                  <p className="font-mono text-[10px] text-[#555] uppercase tracking-widest mt-2 flex items-center gap-2">
                    <AlignLeft size={12}/> Thematic Intent: {gwPrompt ? gwPrompt.substring(0, 50) + "..." : "None"}
                  </p>
                </div>
                <Cpu size={32} className="text-[#E60000] opacity-50" />
              </div>

              {/* NEW: TELEPROMPTER LEGEND */}
              <div className="bg-[#0a0a0a] border border-[#222] p-4 mb-8 rounded-md flex flex-col gap-3 shadow-lg">
                <h4 className="text-[#E60000] font-oswald uppercase tracking-widest text-xs font-bold flex items-center gap-2">
                  <Info size={14} /> BPM Architect Teleprompter Guide
                </h4>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-[10px] font-mono uppercase tracking-widest text-[#888]">
                  <span className="flex items-center gap-2"><span className="text-[#00FFCC] font-bold text-sm drop-shadow-[0_0_5px_rgba(0,255,204,0.8)]">/</span> = Metronome Downbeat</span>
                  <span className="flex items-center gap-2"><span className="text-white font-bold bg-[#111] px-1 rounded">WHITE TEXT</span> = Stressed Syllable (Hit this on the beat)</span>
                  <span className="flex items-center gap-2"><span className="text-gray-500">GRAY TEXT</span> = Pocket / In-between beats</span>
                </div>
              </div>

              {/* RENDERED LYRICS */}
              <div className="space-y-3">
                {lyrics.split('\n').map((line, i) => {
                  const isHeader = line.startsWith('[');
                  return (
                    <div 
                      key={i} 
                      onClick={() => !isHeader && setSelectedLine(line)}
                      className={`transition-all ${!isHeader && 'cursor-pointer hover:bg-[#111] p-2 rounded -mx-2'}`}
                    >
                      <p className={`font-mono text-[15px] leading-relaxed ${isHeader ? 'text-[#E60000] font-bold mt-8 mb-2 tracking-widest text-xs' : ''} ${selectedLine === line ? 'bg-[#E60000]/10 border-l-2 border-[#E60000] pl-3' : ''}`}>
                        {isHeader ? line : renderLyricLine(line)}
                      </p>
                    </div>
                  )
                })}
              </div>

              <div className="pt-12 flex justify-end">
                <button onClick={() => setActiveRoom("04")} className="bg-white text-black px-8 py-3 font-oswald text-sm font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all flex items-center gap-2">
                  Send to Booth <ArrowRight size={16} />
                </button>
              </div>

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

        {/* Micro-Refinement Tray Popup */}
        <div className={`absolute bottom-0 left-0 w-full bg-black border-t border-[#E60000] p-6 transition-transform duration-300 ${selectedLine ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="flex justify-between items-center mb-4">
             <h4 className="font-oswald text-sm text-[#E60000] uppercase tracking-widest font-bold flex items-center gap-2"><Edit3 size={14} /> Micro-Refinement</h4>
             <button onClick={() => setSelectedLine("")} className="text-[#555] hover:text-white text-[10px] font-mono uppercase tracking-widest">Close [X]</button>
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