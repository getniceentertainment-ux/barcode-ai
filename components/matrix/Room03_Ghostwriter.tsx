"use client";

import React, { useState, useEffect } from "react";
import { PenTool, Play, RefreshCw, Zap, AlignLeft, Edit3, Loader2, Layout, ShieldCheck, Cpu, Activity, ArrowRight, Lock } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function Room03_Ghostwriter() {
  const { 
    audioData, flowDNA, blueprint, setBlueprint, generatedLyrics, setGeneratedLyrics, setActiveRoom, addToast,
    gwTitle, setGwTitle, gwPrompt, setGwPrompt, gwStyle, setGwStyle, gwGender, setGwGender, 
    gwUseSlang, setGwUseSlang, gwUseIntel, setGwUseIntel, userSession
  } = useMatrixStore();

  const [motive, setMotive] = useState("");
  const [struggle, setStruggle] = useState("");
  const [hustle, setHustle] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [lyrics, setLyrics] = useState(generatedLyrics || "");
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [uxState, setUxState] = useState("Initializing Secure API Handshake...");
  
  const [isRefining, setIsRefining] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [selectedLine, setSelectedLine] = useState("");

  const styles = [
    { id: "getnice_hybrid", name: "GetNice Hybrid [Melodic Trap]" },
    { id: "heartbeat", name: "Heartbeat (Boom-Bap)" },
    { id: "lazy", name: "Lazy (Wavy/Delayed)" },
    { id: "triplet", name: "Triplet (Trap)" },
    { id: "chopper", name: "Chopper (Fast/Tech)" }
  ];

  const secondsPerBar = audioData?.bpm ? (60 / audioData.bpm) * 4 : 2.5;
  const formatTime = (s: number) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
  const calculateTotalBars = () => blueprint.reduce((acc, section) => acc + section.bars, 0);

  const CREATOR_ID = process.env.NEXT_PUBLIC_CREATOR_ID;
  const isCreator = userSession?.id && userSession.id === CREATOR_ID;
  const isMogul = (userSession?.tier as string) === "The Mogul";
  const currentCost = isMogul ? 0 : Math.max(1, Math.ceil(blueprint.length / 2));

  const hasEnoughCredits = isCreator || isMogul || 
    (userSession?.creditsRemaining && (userSession.creditsRemaining === "UNLIMITED" || userSession.creditsRemaining >= currentCost));

  const syncTimeline = (newBlueprint: any[]) => {
    let cursor = 0;
    const synced = newBlueprint.map((block) => {
      const start = Math.max(cursor, block.startBar ?? cursor);
      const updated = { ...block, startBar: start };
      cursor = start + block.bars;
      return updated;
    });
    setBlueprint(synced);
  };

  const updateBlueprintStartBar = (index: number, newStart: number) => {
    const newBp = [...blueprint];
    const oldStart = (newBp[index] as any).startBar || 0;
    const delta = newStart - oldStart;
    (newBp[index] as any).startBar = Math.max(0, newStart);
    for (let i = index + 1; i < newBp.length; i++) {
        const currentPos = (newBp[i] as any).startBar || 0;
        (newBp[i] as any).startBar = Math.max(0, currentPos + delta);
    }
    syncTimeline(newBp);
  };

  const addSection = (type: "VERSE" | "INTRO" | "HOOK" | "OUTRO" | "BRIDGE", bars: number) => {
    // --- TIER CHECK ---
    const isFreeLoader = (userSession?.tier as string) === "The Free Loader";
    if (isFreeLoader && blueprint.length >= 2) {
      if (addToast) addToast("Free Tier limited to 2 sections. Upgrade for unlimited.", "error");
      return;
    }

    const lastBlock = blueprint[blueprint.length - 1] as any;
    const nextStart = lastBlock && lastBlock.startBar !== undefined ? lastBlock.startBar + lastBlock.bars : 0;
    const newBlock = { id: Math.random().toString(), type, bars, startBar: nextStart };
    syncTimeline([...blueprint, newBlock]);
  };

  const removeSection = (id: string) => {
    syncTimeline(blueprint.filter(b => b.id !== id));
  };

  const handleGenerate = async () => {
    if (!userSession?.id || !gwPrompt.trim() || !audioData || !hasEnoughCredits) {
        if(addToast) addToast("Input requirements or credits missing.", "error");
        return;
    }

    setIsGenerating(true);
    setUxState("Synthesizing Bars...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Missing Token");

      const initRes = await fetch('/api/ghostwriter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          userId: userSession?.id,
          prompt: gwPrompt,
          motive, struggle, hustle,
          title: gwTitle,
          bpm: audioData?.bpm,
          style: gwStyle,
          tag: flowDNA?.tag,
          useSlang: gwUseSlang,
          useIntel: gwUseIntel,
          blueprint: blueprint.map(b => ({ type: b.type, bars: b.bars, startBar: (b as any).startBar }))
        })
      });

      const initData = await initRes.json();
      const jobId = initData.jobId;
      let attempts = 0;

      const pollInterval = setInterval(async () => {
        attempts++;
        setPollingAttempts(attempts);
        const statusRes = await fetch(`/api/ghostwriter?jobId=${jobId}&t=${Date.now()}`);
        const statusData = await statusRes.json();

        if (statusData.status === 'COMPLETED') {
          clearInterval(pollInterval);
          setIsGenerating(false);
          setLyrics(statusData.output.lyrics);
          setGeneratedLyrics(statusData.output.lyrics);
          if(addToast) addToast(`Lyrics Synthesized.`, "success");
        } else if (statusData.status === 'FAILED') {
          clearInterval(pollInterval);
          setIsGenerating(false);
        }
      }, 3000);
    } catch (err: any) {
      setIsGenerating(false);
      if(addToast) addToast(err.message, "error");
    }
  };

  const handleRefine = async () => {
    if (!selectedLine || !refineInstruction) return;
    setIsRefining(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/ghostwriter/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ userId: userSession?.id, originalLine: selectedLine, instruction: refineInstruction, style: gwStyle })
      });
      const data = await res.json();
      const updatedLyrics = lyrics.replace(selectedLine, data.refinedLine);
      setLyrics(updatedLyrics);
      setGeneratedLyrics(updatedLyrics);
      setRefineInstruction("");
      setSelectedLine("");
    } catch (err) {
      if(addToast) addToast("Refinement failed.", "error");
    } finally { setIsRefining(false); }
  };

  return (
    <div className="flex h-full bg-[#050505] border border-[#222] rounded-lg overflow-hidden animate-in fade-in duration-500">
      <div className="w-1/3 border-r border-[#222] flex flex-col relative overflow-y-auto custom-scrollbar shrink-0">
        <div className="p-6 border-b border-[#222] bg-black sticky top-0 z-10">
          <h2 className="font-oswald text-2xl uppercase tracking-widest font-bold text-[#E60000] flex items-center gap-3"><PenTool size={24} /> TALON Engine</h2>
        </div>
        <div className="p-6 space-y-6 flex-1">
          <div>
            <label className="text-[10px] font-mono text-[#888] uppercase mb-2 block font-bold">Track Title</label>
            <input type="text" value={gwTitle} onChange={(e) => setGwTitle(e.target.value)} placeholder="NEON BLOOD..." className="w-full bg-black border border-[#333] p-3 text-xs text-white outline-none focus:border-[#E60000]" />
          </div>
          <div className="space-y-4">
            <input type="text" value={motive} onChange={(e) => setMotive(e.target.value)} placeholder="The Drive..." className="w-full bg-[#111] border border-[#333] p-2 text-xs text-white outline-none focus:border-[#E60000]" />
            <input type="text" value={struggle} onChange={(e) => setStruggle(e.target.value)} placeholder="The Setback..." className="w-full bg-[#111] border border-[#333] p-2 text-xs text-white outline-none focus:border-[#E60000]" />
            <input type="text" value={hustle} onChange={(e) => setHustle(e.target.value)} placeholder="The Execution..." className="w-full bg-[#111] border border-[#333] p-2 text-xs text-white outline-none focus:border-[#E60000]" />
            <textarea value={gwPrompt} onChange={(e) => setGwPrompt(e.target.value)} placeholder="Thematic Focus..." className="w-full h-16 bg-black border border-[#333] p-3 text-xs text-white outline-none focus:border-[#E60000] resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {styles.map(s => (
              <button key={s.id} onClick={() => setGwStyle(s.id)} className={`p-2 border font-oswald text-[10px] uppercase ${gwStyle === s.id ? 'bg-[#E60000] text-white border-[#E60000]' : 'bg-[#111] text-[#888] border-[#333]'}`}>{s.name}</button>
            ))}
          </div>
        </div>
        <div className="p-6 border-t border-[#222] bg-black sticky bottom-0 z-20">
          {!hasEnoughCredits && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center border-t border-[#E60000]/20">
              <Lock size={18} className="text-[#E60000] mb-1" /><p className="text-[10px] uppercase font-bold text-white">Requires {currentCost} Credits</p>
            </div>
          )}
          <button onClick={handleGenerate} disabled={isGenerating || !hasEnoughCredits} className="w-full bg-[#E60000] text-white py-4 font-oswald text-lg font-bold uppercase disabled:opacity-30">
            {isGenerating ? <Loader2 size={20} className="animate-spin" /> : "Generate Track"}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-[#020202] overflow-hidden">
        <div className="h-16 border-b border-[#222] bg-[#0a0a0a] flex items-center justify-between px-8">
           <h3 className="font-oswald text-lg uppercase tracking-widest text-[#888] flex items-center gap-3"><Layout size={16} /> Song Blueprint</h3>
        </div>

        <div className="h-44 bg-black border-b border-[#222] overflow-x-auto flex items-center px-8 gap-4 custom-scrollbar">
          {blueprint.map((block, index) => (
            <div key={block.id} className="w-40 shrink-0 bg-[#050505] border border-[#333] p-4 flex flex-col justify-between h-32 relative">
              <button onClick={() => removeSection(block.id)} className="absolute top-1 right-1 text-[#555]">×</button>
              <h4 className="font-oswald text-sm text-white uppercase">{block.type}</h4>
              <p className="font-mono text-[10px] text-[#E60000]">{block.bars} BARS</p>
              <input type="number" value={(block as any).startBar ?? 0} onChange={(e) => updateBlueprintStartBar(index, parseInt(e.target.value) || 0)} className="w-full bg-black border border-[#333] text-white text-[10px] text-center" />
            </div>
          ))}
          <div className="w-36 shrink-0 bg-transparent border border-dashed border-[#333] p-3 flex flex-col justify-center h-32 gap-2 relative">
            {(userSession?.tier as string) === "The Free Loader" && blueprint.length >= 2 && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10">
                <Lock size={14} className="text-[#E60000]" /><span className="text-[8px] font-mono text-white font-bold">LOCKED</span>
              </div>
            )}
            <button onClick={() => addSection("HOOK", 8)} className="bg-[#111] text-[#888] text-[9px] py-1 uppercase">Hook</button>
            <button onClick={() => addSection("VERSE", 16)} className="bg-[#111] text-[#888] text-[9px] py-1 uppercase">Verse</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
          {isGenerating ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[#E60000]">
              <Activity size={64} className="animate-pulse mb-6" /><p className="font-oswald text-2xl uppercase tracking-widest">{uxState}</p>
            </div>
          ) : lyrics ? (
            <div className="max-w-2xl mx-auto space-y-2 pb-32">
              {lyrics.split('\n').map((line, i) => (
                <div key={i} onClick={() => setSelectedLine(line)} className="text-gray-300 hover:text-white cursor-pointer p-1 font-mono text-sm">{line}</div>
              ))}
              <button onClick={() => setActiveRoom("04")} className="bg-white text-black px-8 py-3 font-oswald text-sm font-bold uppercase mt-8">Send to Booth</button>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center opacity-10"><PenTool size={100} /></div>
          )}
        </div>

        <div className={`absolute bottom-0 left-0 w-full bg-black border-t border-[#E60000] p-6 transition-transform ${selectedLine ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-oswald text-sm text-[#E60000] uppercase font-bold">Micro-Refinement</h4>
            <button onClick={() => setSelectedLine("")} className="text-[#555]">Close [X]</button>
          </div>
          <div className="flex gap-3">
             <input type="text" value={refineInstruction} onChange={(e) => setRefineInstruction(e.target.value)} placeholder="Refine instruction..." className="flex-1 bg-[#111] border border-[#333] p-3 text-xs text-white" />
             <button onClick={handleRefine} disabled={isRefining} className="bg-[#E60000] text-white px-8 font-oswald text-sm font-bold uppercase">{isRefining ? "Refining..." : "Rewrite"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}