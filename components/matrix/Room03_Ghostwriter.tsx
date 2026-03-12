"use client";

import React, { useState } from "react";
import { PenTool, Activity, ShieldCheck, Zap, ArrowRight, Layout, RefreshCw, Cpu, AlignLeft, Edit3, Loader2 } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function Room03_Ghostwriter() {
  const { 
    setActiveRoom, userSession, audioData, flowDNA,
    gwTitle, gwPrompt, gwStyle, gwUseSlang, gwUseIntel,
    setGwTitle, setGwPrompt, setGwStyle, setGwUseSlang, setGwUseIntel,
    blueprint, setBlueprint,
    generatedLyrics, setGeneratedLyrics, addToast 
  } = useMatrixStore();

  const [status, setStatus] = useState<"idle" | "generating" | "success">("idle");
  const [progress, setProgress] = useState(0);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [uxState, setUxState] = useState("Initializing Secure API Handshake...");

  // Micro-Refinement State
  const [isRefining, setIsRefining] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [selectedLine, setSelectedLine] = useState("");

  const calculateTotalBars = () => blueprint.reduce((acc, section) => acc + section.bars, 0);

  const addSection = (type: "VERSE" | "INTRO" | "HOOK" | "OUTRO" | "BRIDGE", bars: number) => {
    setBlueprint([...blueprint, { id: Math.random().toString(), type, bars }]);
  };
  
  const removeSection = (id: string) => {
    setBlueprint(blueprint.filter(b => b.id !== id));
  };

  const generateLyrics = async () => {
    if (!userSession?.id) return addToast("Security Exception: User Session missing.", "error");
    if (!gwPrompt.trim()) return addToast("Missing directive topic.", "error");
    if (!audioData) return addToast("Instrumental DSP data missing. Return to Room 01.", "error");
    
    setStatus("generating");
    setProgress(15);
    setPollingAttempts(0);
    setUxState("Securing JWT Token...");

    try {
      // 1. FETCH SECURE JWT TOKEN
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Security Exception: Missing Session Token.");

      // 2. CALCULATE SYLLABLE MATH
      const targetSyllables = Math.floor(audioData.bpm * 0.12);

      const payload = {
        prompt: gwPrompt,
        title: gwTitle,
        style: gwStyle,
        stageName: userSession.stageName || "The Artist",
        key: audioData.key || "Unknown",
        bpm: audioData.bpm,
        syllable_target: targetSyllables, 
        user_reference: flowDNA?.referenceText || "None", 
        useSlang: gwUseSlang,
        useIntel: gwUseIntel,
        blueprint: blueprint.map(b => ({ type: b.type, bars: b.bars }))
      };

      setProgress(30);
      setUxState("Passing blueprint to GPU cluster...");

      // 3. INITIALIZE RUNPOD JOB (Using correct Ghostwriter endpoint)
      const initRes = await fetch('/api/ghostwriter', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });

      const initData = await initRes.json();
      if (!initRes.ok) throw new Error(initData.error || "Ghostwriter Worker Failed");

      const jobId = initData.jobId;
      if (!jobId) throw new Error("Failed to receive Job ID");

      setProgress(50);
      let attempts = 0;

      // 4. ASYNCHRONOUS POLLING (Prevents Vercel 504 Timeouts)
      const pollInterval = setInterval(async () => {
        attempts++;
        setPollingAttempts(attempts);
        if (attempts > 2) setUxState("Warming up Neural Network (Cold Start)...");
        else setUxState("Synthesizing Bars...");
        
        setProgress(Math.min(50 + (attempts * 3), 95));

        try {
          const statusRes = await fetch(`/api/ghostwriter?jobId=${jobId}`);
          const statusData = await statusRes.json();

          if (statusData.status === 'COMPLETED') {
            clearInterval(pollInterval);
            setGeneratedLyrics(statusData.output.lyrics);
            setProgress(100);
            setStatus("success");
            if(addToast) addToast("Ghostwriter protocol complete. Lyrics secured.", "success");
          } else if (statusData.status === 'FAILED') {
            clearInterval(pollInterval);
            setStatus("idle");
            if(addToast) addToast("RunPod Execution Failed.", "error");
          }
        } catch (pollErr) {
          console.error("Polling Error", pollErr);
        }
      }, 3000);

    } catch (err: any) {
      console.error(err);
      if(addToast) addToast(err.message || "Generation failed.", "error");
      setStatus("idle");
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

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refinement API Error");

      const updatedLyrics = (generatedLyrics || "").replace(selectedLine, data.refinedLine);
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
    <div className="h-full flex flex-col md:flex-row bg-[#050505] animate-in fade-in duration-500 border border-[#222]">
      
      <div className="w-full md:w-5/12 lg:w-1/3 border-r border-[#222] flex flex-col relative h-full bg-black z-10">
        <div className="p-6 border-b border-[#222]">
          <h2 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white flex items-center gap-3">
            <PenTool size={28} className="text-[#E60000]" /> Ghostwriter
          </h2>
          <p className="font-mono text-[10px] text-[#555] uppercase mt-2 tracking-widest">
            Talon Engine // LLM Lyric Synthesis
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          
          <div className="bg-[#111] p-4 border border-[#333]">
             <div className="flex justify-between items-center mb-2">
               <span className="text-[10px] font-mono uppercase text-[#888] tracking-widest flex items-center gap-2"><Activity size={12}/> Syllable Control</span>
               <span className="text-[10px] font-mono text-[#E60000]">{audioData?.bpm ? Math.floor(audioData.bpm * 0.12) : 0} Syllables/Bar</span>
             </div>
             <p className="text-[9px] text-[#555] font-mono uppercase tracking-widest">Target automatically calculated based on {audioData?.bpm ? Math.round(audioData.bpm) : 0} BPM.</p>
          </div>

          <div>
            <label className="text-[10px] text-[#888] font-mono uppercase tracking-widest font-bold mb-2 block">Track Title / Working Name</label>
            <input type="text" value={gwTitle} onChange={(e) => setGwTitle(e.target.value)} className="w-full bg-black border border-[#222] p-3 font-mono text-xs uppercase text-white outline-none focus:border-[#E60000] transition-colors" placeholder="E.g., MATRIX INFILTRATION..." />
          </div>

          <div>
            <label className="text-[10px] text-[#888] font-mono uppercase tracking-widest font-bold mb-2 block">Directive (Topic/Story)</label>
            <textarea value={gwPrompt} onChange={(e) => setGwPrompt(e.target.value)} rows={3} className="w-full bg-black border border-[#222] p-3 font-mono text-xs text-white outline-none focus:border-[#E60000] transition-colors resize-none" placeholder="What is the song about? Be specific. Focus on concrete physical realities..." />
          </div>

          <div>
            <label className="text-[10px] text-[#888] font-mono uppercase tracking-widest font-bold mb-2 block">Flow Architecture</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setGwStyle("getnice_flow")} className={`p-3 border font-oswald text-xs uppercase tracking-widest transition-all ${gwStyle === 'getnice_flow' ? 'bg-[#E60000] border-[#E60000] text-white' : 'bg-[#111] border-[#333] text-[#555] hover:text-white hover:border-[#555]'}`}>
                GetNice Flow
              </button>
              <button 
                onClick={() => {
                  if (!flowDNA) {
                    if(addToast) addToast("No User Flow DNA found. Return to Brain Train to record or paste lyrics.", "error");
                    return;
                  }
                  setGwStyle("user_flow");
                }} 
                className={`p-3 border font-oswald text-xs uppercase tracking-widest transition-all ${gwStyle === 'user_flow' ? 'bg-[#E60000] border-[#E60000] text-white' : 'bg-[#111] border-[#333] text-[#555] hover:text-white hover:border-[#555]'}`}
              >
                User Flow
              </button>
            </div>
          </div>

          <div className="space-y-3 border-t border-[#222] pt-4">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={gwUseSlang} onChange={(e) => setGwUseSlang(e.target.checked)} className="accent-[#E60000] w-4 h-4" />
              <span className="text-xs font-mono uppercase tracking-widest text-[#888] group-hover:text-white transition-colors">Inject Street Lexicon</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={gwUseIntel} onChange={(e) => setGwUseIntel(e.target.checked)} className="accent-[#E60000] w-4 h-4" />
              <span className="text-xs font-mono uppercase tracking-widest text-[#888] group-hover:text-white transition-colors">Inject Live Intel (News/Culture)</span>
            </label>
          </div>
        </div>

        <div className="p-6 border-t border-[#222] bg-[#020202]">
          {status === "idle" && (
            <button onClick={generateLyrics} disabled={!gwPrompt.trim()} className="w-full bg-[#E60000] text-white py-4 font-oswald text-lg font-bold uppercase tracking-[0.2em] hover:bg-red-700 transition-all disabled:opacity-30 flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(230,0,0,0.2)]">
              Initialize TALON <Zap size={18} />
            </button>
          )}
          {status === "generating" && (
            <div className="w-full bg-[#110000] border border-[#E60000] p-4 text-center">
               <p className="font-oswald text-[#E60000] uppercase tracking-widest font-bold mb-2 flex justify-center items-center gap-2"><RefreshCw size={14} className="animate-spin" /> Neural Sync Active</p>
               <p className="font-mono text-[9px] text-[#E60000] mb-3 uppercase tracking-widest">{uxState}</p>
               <div className="w-full h-1 bg-black overflow-hidden"><div className="h-full bg-[#E60000] transition-all duration-300" style={{width: `${progress}%`}}></div></div>
            </div>
          )}
          {status === "success" && (
            <div className="flex gap-2">
              <button onClick={() => setStatus("idle")} className="flex-1 bg-black border border-[#333] text-[#888] py-4 font-oswald text-sm font-bold uppercase tracking-[0.1em] hover:text-white transition-all">
                Regenerate
              </button>
              <button onClick={() => setActiveRoom("04")} className="flex-[2] bg-white text-black py-4 font-oswald text-sm font-bold uppercase tracking-[0.1em] hover:bg-[#E60000] hover:text-white transition-all flex items-center justify-center gap-2">
                Send to Booth <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="h-16 border-b border-[#222] bg-[#020202] flex items-center justify-between px-8 shrink-0">
           <h3 className="font-oswald text-lg uppercase tracking-widest text-[#888] flex items-center gap-3">
             <Layout size={16} /> Song Blueprint <span className="text-[#333]">|</span> <span className="text-[#E60000] text-sm">{calculateTotalBars()} Bars Target</span>
           </h3>
           <button onClick={() => setGeneratedLyrics("")} className="text-[#555] hover:text-white transition-colors" title="Clear Lyrics"><RefreshCw size={14} /></button>
        </div>
        
        {/* BLUEPRINT BLOCK BUILDER */}
        <div className="h-48 bg-[#0a0a0a] border-b border-[#222] overflow-x-auto flex items-center px-8 gap-4 shrink-0 custom-scrollbar">
          {blueprint.map((block, index) => (
            <div key={block.id} className="w-40 shrink-0 bg-black border border-[#333] p-4 flex flex-col justify-between h-28 group relative">
              <button onClick={() => removeSection(block.id)} className="absolute -top-2 -right-2 bg-red-900 text-white w-5 h-5 rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">×</button>
              <div className="text-[10px] font-mono text-[#888] uppercase tracking-widest flex justify-between">
                <span>Block {index + 1}</span>
              </div>
              <div>
                <h4 className="font-oswald text-xl uppercase tracking-widest text-white">{block.type}</h4>
                <p className="font-mono text-xs text-[#E60000] font-bold">{block.bars} BARS</p>
              </div>
            </div>
          ))}
          <div className="w-40 shrink-0 bg-[#050505] border border-dashed border-[#333] p-4 flex flex-col justify-center h-28 gap-2">
            <p className="text-[9px] font-mono text-[#555] uppercase text-center tracking-widest">Add Structure</p>
            <div className="flex gap-1 justify-center">
              <button onClick={() => addSection("HOOK", 8)} className="bg-[#111] hover:bg-[#E60000] hover:text-white text-[#888] text-[9px] px-2 py-1 uppercase font-bold transition-colors">Hook</button>
              <button onClick={() => addSection("VERSE", 16)} className="bg-[#111] hover:bg-[#E60000] hover:text-white text-[#888] text-[9px] px-2 py-1 uppercase font-bold transition-colors">Verse</button>
            </div>
          </div>
        </div>

        {/* LYRICS DISPLAY & MICRO-REFINEMENT */}
        <div className="flex-1 bg-[#050505] p-8 overflow-y-auto custom-scrollbar relative">
          <div className="max-w-2xl mx-auto">
            {!generatedLyrics ? (
              <div className="flex flex-col items-center justify-center h-64 opacity-20 text-center">
                <ShieldCheck size={64} className="mb-4 text-white" />
                <h3 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-2">Editor Offline</h3>
                <p className="font-mono text-xs text-white uppercase tracking-widest">Awaiting TALON initialization command.</p>
              </div>
            ) : (
              <div className="bg-[#020202] border border-[#111] p-8 lg:p-12 shadow-2xl relative pb-32">
                <div className="flex items-center justify-between border-b border-[#222] pb-6 mb-8">
                  <div>
                    <h3 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white">{gwTitle || "UNTITLED ARTIFACT"}</h3>
                    <p className="font-mono text-[10px] text-[#E60000] uppercase tracking-widest mt-1">Syllable Control: {audioData?.bpm ? Math.floor(audioData.bpm * 0.12) : 0}/Line</p>
                  </div>
                  <Cpu size={24} className="text-[#333]" />
                </div>
                
                {/* Line-by-Line Rendering for Refinement selection */}
                <div className="space-y-2">
                  {generatedLyrics.split('\n').map((line, i) => {
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
              </div>
            )}
          </div>
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