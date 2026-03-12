"use client";

import React, { useState } from "react";
import { PenTool, Activity, ShieldCheck, Zap, ArrowRight, Save, Layout, RefreshCw, Cpu } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";

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

  const calculateTotalBars = () => blueprint.reduce((acc, section) => acc + section.bars, 0);

  const addSection = (type: string, bars: number) => {
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

    try {
      // THE FIX: Exact mathematical syllable targeting based on the track BPM
      // Standard rap is approx 0.12 syllables per BPM per bar. (e.g. 90 BPM = ~11 syllables, 140 BPM = ~17 syllables)
      const targetSyllables = Math.floor(audioData.bpm * 0.12);

      const payload = {
        task_type: "generate",
        prompt: gwPrompt,
        style: gwStyle,
        stageName: "The Artist",
        key: audioData.key || "Unknown",
        bpm: audioData.bpm,
        syllable_target: targetSyllables, // Pass to GPU
        user_reference: flowDNA?.parsedText || "None", // Pass to GPU
        useSlang: gwUseSlang,
        useIntel: gwUseIntel,
        blueprint: blueprint.map(b => ({ type: b.type, bars: b.bars }))
      };

      setProgress(40);

      const res = await fetch('/api/talon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Ghostwriter Worker Failed");

      setProgress(80);
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      setGeneratedLyrics(data.lyrics);
      setProgress(100);
      setStatus("success");
      if(addToast) addToast("Ghostwriter protocol complete. Lyrics secured.", "success");

    } catch (err: any) {
      console.error(err);
      if(addToast) addToast(err.message || "Generation failed.", "error");
      setStatus("idle");
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

          <div className="space-y-3">
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
        </div>
        
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

        <div className="flex-1 bg-[#050505] p-8 overflow-y-auto custom-scrollbar relative">
          <div className="max-w-2xl mx-auto">
            {!generatedLyrics ? (
              <div className="flex flex-col items-center justify-center h-64 opacity-20 text-center">
                <ShieldCheck size={64} className="mb-4 text-white" />
                <h3 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-2">Editor Offline</h3>
                <p className="font-mono text-xs text-white uppercase tracking-widest">Awaiting TALON initialization command.</p>
              </div>
            ) : (
              <div className="bg-[#020202] border border-[#111] p-8 lg:p-12 shadow-2xl">
                <div className="flex items-center justify-between border-b border-[#222] pb-6 mb-8">
                  <div>
                    <h3 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white">{gwTitle || "UNTITLED ARTIFACT"}</h3>
                    <p className="font-mono text-[10px] text-[#E60000] uppercase tracking-widest mt-1">Syllable Control: {audioData?.bpm ? Math.floor(audioData.bpm * 0.12) : 0}/Line</p>
                  </div>
                  <Cpu size={24} className="text-[#333]" />
                </div>
                <textarea 
                  value={generatedLyrics} 
                  onChange={(e) => setGeneratedLyrics(e.target.value)}
                  className="w-full h-full min-h-[500px] bg-transparent text-[#ddd] font-mono text-sm leading-loose outline-none resize-none"
                />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}