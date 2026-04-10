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
    { array: [1, 1, 1, 1], name: "Machine Gun", desc: "All rapid-fire, ultra-fast 16th-note syllables. No long stretches. Relentless." },
    { array: [2, 1, 1, 1, 1, 2], name: "Stutter Step", desc: "A standard syllable, followed by four ultra-fast rapid syllables, ending on a standard syllable." }
  ],
  "heartbeat": [
    { array: [2, 2, 2, 2], name: "Steady Anchor", desc: "All standard, steady 8th-note syllables. Methodical, calm, and heavy." },
    { array: [4, 2, 2, 4, 4], name: "Delayed Pocket", desc: "A massive hold, two standard syllables, then two more massive holds. Very lazy and behind the beat." }
  ],
  "triplet": [
    { array: [3, 3, 2], name: "Standard Triplet", desc: "Two long stretched syllables followed by a standard syllable. The classic triplet trap flow." },
    { array: [2, 2, 2, 3, 3, 4], name: "Atmospheric Stagger", desc: "Three standard syllables, two long stretches, and a massive hold. A wavy, staggered rhythm." }
  ],
  "lazy": [
    { array: [4, 2, 2], name: "Standard Drawl", desc: "A massive lazy hold followed by two standard syllables. Slow and dragged out." },
    { array: [6, 2, 8], name: "Extreme Drag", desc: "An extreme delayed hold, a standard syllable, and an enormously long stretched finish." }
  ]
};

export default function Room03_Ghostwriter() {
  const { 
    audioData, flowDNA, blueprint, setBlueprint, generatedLyrics, setGeneratedLyrics, setActiveRoom, addToast,
    gwTitle, setGwTitle, gwPrompt, setGwPrompt, gwStyle, setGwStyle, gwGender, setGwGender, 
    gwPocket, setGwPocket,
    gwUseSlang, setGwUseSlang, gwUseIntel, setGwUseIntel, userSession,
    
    gwMotive = "", setGwMotive = () => {},
    gwStruggle = "", setGwStruggle = () => {},
    gwHustle = "", setGwHustle = () => {},

    gwStrikeZone = "snare", setGwStrikeZone = () => {},
    gwHookType = "auto", setGwHookType = () => {}, 
    gwFlowEvolution = "auto", setGwFlowEvolution = () => {} 
  } = useMatrixStore();

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
  const isMogul = userSession?.tier === "The Mogul";
  const currentCost = isMogul ? 0 : Math.max(1, Math.ceil(blueprint.length / 2));

  const hasEnoughCredits = isCreator || isMogul || 
    (userSession?.creditsRemaining && (userSession.creditsRemaining === "UNLIMITED" || userSession.creditsRemaining >= currentCost));

  const layoutHash = blueprint.map(b => `${b.id}-${b.type}-${b.bars}`).join('|');

  useEffect(() => {
    if (blueprint.length === 0) return;
    
    let cursor = 0;
    const variations = FLOW_VAULT[gwStyle as string] || FLOW_VAULT["getnice_hybrid"];
    let verseCounter = 0;
    
    let needsUpdate = false;

    const hookLabels: Record<string, string> = {
      auto: "Neural Match (DNA)",
      chant: "Stadium Chant",
      bouncy: "The Double-Up",
      triplet: "Trap Triplet",
      symmetry: "Symmetry Break",
      prime: "Prime Syncopation"
    };

    const synced = blueprint.map((block) => {
      const start = Math.max(cursor, (block as any).startBar ?? cursor);
      
      let activeName = "";
      let activeDesc = "";
      let activeArray: number[] = [];
      
      if (block.type === 'HOOK') {
          // SURGICAL FIX: Assign a "Catchy" pattern to Hooks instead of an empty array
          const hookVariations = variations; 
          const selectedHook = hookVariations[0]; 
          activeArray = selectedHook.array;
          
          activeName = hookLabels[gwHookType as string] || "Custom Hook";
          activeDesc = `Topline Override Active: ${activeName}`;
      } else if (block.type === 'VERSE') {
          const verseVariations = variations.length > 1 ? variations.slice(1) : variations;
          
          let evolutionLabel = "[Locked In]";
          let finalEvolution = gwFlowEvolution;
          
          if (gwFlowEvolution === "auto" || !gwFlowEvolution) {
              finalEvolution = (gwStyle === "chopper" || gwStyle === "triplet") ? "switch" : "static";
              evolutionLabel = "[Neural Flow]";
          } else if (gwFlowEvolution === "switch") {
              evolutionLabel = "[Switch-Up Active]";
          }

          const selected = finalEvolution === "static" 
              ? verseVariations[0] 
              : verseVariations[verseCounter % verseVariations.length];
          
          verseCounter++;
          
          activeArray = selected.array;

          const pocketLabels: Record<string, string> = {
            standard: "Std",
            chainlink: "Chain-Link",
            pickup: "Drag",
            cascade: "Cascade",
            matrix_pivot: "Pivot" 
          };
          const pLabel = pocketLabels[gwPocket as string] || "Std";

          activeName = `[${pLabel}] ${selected.name} ${evolutionLabel}`;
          activeDesc = selected.desc;
      } else {
          activeName = "DSP Passthrough";
      }
      
      if ((block as any).startBar !== start || (block as any).patternName !== activeName) {
          needsUpdate = true;
      }
      
      const updated = { 
        ...block, 
        startBar: start,
        patternArray: activeArray, 
        patternName: activeName,
        patternDesc: activeDesc
      };
      cursor = start + block.bars;
      return updated;
    });

    if (needsUpdate) {
        setBlueprint(synced);
    }
  }, [gwStyle, gwHookType, gwFlowEvolution, gwPocket, layoutHash, blueprint, audioData]);

  // --- THE SMART LOCK BOUNCER (PREVENTS ENGINE CRASHES) ---
  useEffect(() => {
    if (gwStyle === "lazy" && gwPocket === "cascade") {
      setGwPocket("standard");
      if (addToast) addToast("Cascade disabled: Lazy flow lacks syllable density.", "info");
    }
    if (gwStyle === "chopper" && gwStrikeZone === "spillover") {
      setGwStrikeZone("snare");
      if (addToast) addToast("Spillover disabled: Chopper grid is too dense.", "info");
    }
    if (gwStyle === "triplet" && gwHookType === "prime") {
      setGwHookType("auto");
      if (addToast) addToast("Prime disabled: Clashes with Triplet math.", "info");
    }
    if (gwPocket === "pickup" && gwStrikeZone === "downbeat") {
      setGwStrikeZone("snare");
      if (addToast) addToast("Downbeat disabled: Clashes with Pickup pocket.", "info");
    }
  }, [gwStyle, gwPocket, gwStrikeZone, gwHookType, setGwPocket, setGwStrikeZone, setGwHookType, addToast]);

  const updateBlueprintStartBar = (index: number, newStart: number) => {
    const newBp = [...blueprint];
    const oldStart = (newBp[index] as any).startBar || 0;
    const delta = newStart - oldStart;
    (newBp[index] as any).startBar = Math.max(0, newStart);
    for (let i = index + 1; i < newBp.length; i++) {
        const currentPos = (newBp[i] as any).startBar || 0;
        (newBp[i] as any).startBar = Math.max(0, currentPos + delta);
    }
    setBlueprint(newBp); 
  };

  const addSection = (type: "VERSE" | "INTRO" | "HOOK" | "OUTRO" | "BRIDGE" | "INSTRUMENTAL", bars: number) => {
    const isFreeLoader = (userSession?.tier as string) === "Free Loader";
    if (isFreeLoader && blueprint.length >= 2) {
      if (addToast) addToast("Free Tier Limited to 2 Sections.", "error");
      return;
    }
    const lastBlock = blueprint[blueprint.length - 1] as any;
    const nextStart = lastBlock && lastBlock.startBar !== undefined ? lastBlock.startBar + lastBlock.bars : 0;
    const newBlock = { id: Math.random().toString(), type, bars, startBar: nextStart };
    setBlueprint([...blueprint, newBlock]);
  };

  const removeSection = (id: string) => {
    setBlueprint(blueprint.filter(b => b.id !== id));
  };

  const handleGenerate = async () => {
    if (!userSession?.id) return addToast("Security Exception: User Session missing.", "error");
    if (!gwPrompt.trim()) return addToast("Missing thematic directive.", "error");
    if (!audioData) return addToast("Instrumental DSP data missing.", "error");
    if (!hasEnoughCredits) return addToast(`Insufficient Credits. You need ${currentCost} CRD.`, "error");

    setIsGenerating(true);
    setUxState("Synthesizing Bars via GETNICE Engine...");

    let finalHookType = gwHookType;
    if (gwHookType === "auto" || !gwHookType) {
      if (gwStyle === "triplet") finalHookType = "triplet";
      else if (gwStyle === "chopper") finalHookType = "bouncy";
      else finalHookType = "chant";
    }

    let finalFlowEvolution = gwFlowEvolution;
    if (gwFlowEvolution === "auto" || !gwFlowEvolution) {
      finalFlowEvolution = (gwStyle === "chopper" || gwStyle === "triplet") ? "switch" : "static";
    }

    const systemConstraint = `ABSOLUTE ENGINE RULES:
1. RAW LYRICS ONLY: You must ONLY output the lyrics.
2. NO PREFIXES: NEVER output labels.
3. COMPOUND RHYMING: Use 2- or 3-syllable compound rhymes.
4. PITCH INTONATION: Align vowel choices to pitch contour.`;

    const keyParts = audioData?.key ? audioData.key.split(" ") : ["C", "minor"];
    const rootNote = keyParts[0];
    const scale = keyParts.slice(1).join(" ");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Security Exception: Missing Token.");

      const initRes = await fetch('/api/ghostwriter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          userId: userSession?.id,
          stageName: userSession?.stageName || "Unknown Artist", 
          prompt: gwPrompt,
          flowReference: flowDNA?.referenceText,
          motive: gwMotive,
          struggle: gwStruggle,
          hustle: gwHustle,
          title: gwTitle,
          bpm: audioData?.bpm,
          style: gwStyle,
          tag: flowDNA?.tag,
          useSlang: gwUseSlang,
          useIntel: gwUseIntel,
          strikeZone: gwStrikeZone,
          hookType: finalHookType,             
          flowEvolution: finalFlowEvolution,   
          pocket: gwPocket, 
          root_note: rootNote,
          scale: scale,
          contour: (audioData as any)?.contour,
          dynamic_array: (audioData as any)?.dynamic_array,
          systemConstraint: systemConstraint, 
          blueprint: blueprint.map(b => ({ 
            type: b.type, bars: b.bars, startBar: (b as any).startBar,
            patternDesc: (b as any).patternDesc, patternArray: (b as any).patternArray
          }))
        })
      });

      const initData = await initRes.json();
      if (!initRes.ok) throw new Error(initData.error || "Init Failed.");

      const jobId = initData.jobId;
      const pollInterval = setInterval(async () => {
        setPollingAttempts(prev => prev + 1);
        try {
          const statusRes = await fetch(`/api/ghostwriter?jobId=${jobId}&t=${Date.now()}`);
          const statusData = await statusRes.json();
          if (statusData.status === 'COMPLETED') {
            clearInterval(pollInterval);
            setIsGenerating(false);
            let rawLyrics = statusData.output.lyrics || "";
            setLyrics(rawLyrics);
            setGeneratedLyrics(rawLyrics);
            if(addToast) addToast(`Lyrics Synthesized.`, "success");
          } else if (statusData.status === 'FAILED') {
            clearInterval(pollInterval);
            setIsGenerating(false);
            if(addToast) addToast("Execution Failed.", "error");
          }
        } catch (pollErr) { console.error(pollErr); }
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
        body: JSON.stringify({ userId: userSession?.id, stageName: userSession?.stageName, originalLine: selectedLine, instruction: refineInstruction, style: gwStyle })
      });
      const data = await res.json();
      const updatedLyrics = lyrics.replace(selectedLine, data.refinedLine);
      setLyrics(updatedLyrics);
      setGeneratedLyrics(updatedLyrics);
      setSelectedLine("");
    } catch (err: any) { if(addToast) addToast("Refinement failed.", "error"); } finally { setIsRefining(false); }
  };

  return (
    <div className="flex h-full bg-[#050505] border border-[#222] rounded-lg overflow-hidden animate-in fade-in duration-500">
      <div className="w-1/3 border-r border-[#222] flex flex-col relative overflow-y-auto custom-scrollbar shrink-0">
        <div className="p-6 border-b border-[#222] bg-black sticky top-0 z-10">
          <h2 className="font-oswald text-2xl uppercase tracking-widest font-bold text-[#E60000] flex items-center gap-3"><PenTool size={24} /> GETNICE Engine</h2>
        </div>
        <div className="p-6 space-y-6 flex-1">
          <input type="text" value={gwTitle} onChange={(e) => setGwTitle(e.target.value)} placeholder="TRACK TITLE" className="w-full bg-black border border-[#333] p-3 text-xs text-white font-mono outline-none" />
          <div className="space-y-4">
            <input type="text" value={gwMotive} onChange={(e) => setGwMotive(e.target.value)} placeholder="DRIVE" className="w-full bg-[#111] border border-[#333] p-2 text-xs text-white font-mono" />
            <input type="text" value={gwStruggle} onChange={(e) => setGwStruggle(e.target.value)} placeholder="STRUGGLE" className="w-full bg-[#111] border border-[#333] p-2 text-xs text-white font-mono" />
            <input type="text" value={gwHustle} onChange={(e) => setGwHustle(e.target.value)} placeholder="HUSTLE" className="w-full bg-[#111] border border-[#333] p-2 text-xs text-white font-mono" />
            <textarea value={gwPrompt} onChange={(e) => setGwPrompt(e.target.value)} placeholder="TOPIC" className="w-full h-16 bg-black border border-[#333] p-3 text-xs text-white font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {styles.map(s => (
              <button key={s.id} onClick={() => setGwStyle(s.id)} className={`p-3 border text-[10px] uppercase ${gwStyle === s.id ? 'bg-[#E60000] text-white' : 'bg-[#111] text-[#888]'}`}>{s.name}</button>
            ))}
          </div>
          <div className="space-y-4 pt-6 border-t border-[#222]">
            <select value={gwStrikeZone} onChange={(e) => setGwStrikeZone(e.target.value)} className="w-full bg-black border border-[#333] p-3 text-xs text-white uppercase"><option value="snare">Snare</option><option value="downbeat">Downbeat</option><option value="spillover">Spillover</option></select>
            <select value={gwHookType} onChange={(e) => setGwHookType(e.target.value)} className="w-full bg-black border border-[#333] p-3 text-xs text-white uppercase"><option value="auto">Neural Match</option><option value="chant">Chant</option><option value="bouncy">Double-Up</option><option value="triplet">Triplet</option></select>
            <select value={gwFlowEvolution} onChange={(e) => setGwFlowEvolution(e.target.value)} className="w-full bg-black border border-[#333] p-3 text-xs text-white uppercase"><option value="auto">Auto</option><option value="static">Static</option><option value="switch">Switch</option></select>
            <select value={gwPocket} onChange={(e) => setGwPocket(e.target.value)} className="w-full bg-black border border-[#333] p-3 text-xs text-white uppercase font-bold"><option value="standard">Standard</option><option value="chainlink">Chain-Link</option><option value="pickup">Drag</option><option value="cascade">Cascade</option><option value="matrix_pivot">Pivot</option></select>
          </div>
        </div>
        <div className="p-6 border-t border-[#222] bg-black sticky bottom-0 z-20">
          <button onClick={handleGenerate} disabled={isGenerating || !hasEnoughCredits} className="w-full bg-[#E60000] text-white py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700">
            {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} />} Generate Track
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative bg-[#020202] overflow-hidden">
        <div className="h-16 border-b border-[#222] bg-[#0a0a0a] flex items-center justify-between px-8 shrink-0">
           <h3 className="font-oswald text-lg uppercase tracking-widest text-[#888]">Song Blueprint</h3>
        </div>
        <div className="h-44 bg-black border-b border-[#222] overflow-x-auto flex items-center px-8 gap-4 shrink-0 custom-scrollbar">
          {blueprint.map((block, index) => (
            <div key={block.id} className="w-40 shrink-0 bg-[#050505] border border-[#333] p-4 flex flex-col justify-between h-32 group relative transition-colors">
              <button onClick={() => removeSection(block.id)} className="absolute -top-2 -right-2 bg-red-900 text-white w-5 h-5 rounded-full text-[10px]">×</button>
              <h4 className={`font-oswald text-lg uppercase ${block.type === 'INSTRUMENTAL' ? 'text-blue-500' : 'text-white'}`}>{block.type}</h4>
              <p className="font-mono text-[10px] text-[#E60000] font-bold">{block.bars} BARS</p>
              <div className="flex justify-between items-center mt-2 border-t border-[#333] pt-2">
                <span className="text-[9px] text-[#E60000] font-mono">{formatTime(((block as any).startBar || 0) * secondsPerBar)}</span>
              </div>
            </div>
          ))}
          <div className="w-48 shrink-0 border border-dashed border-[#333] p-3 flex flex-col justify-center h-32 gap-2">
            <button onClick={() => addSection("HOOK", 8)} className="bg-[#111] hover:bg-[#E60000] text-[#888] text-[9px] px-2 py-1 uppercase font-bold">+ Hook</button>
            <button onClick={() => addSection("VERSE", 16)} className="bg-[#111] hover:bg-[#E60000] text-[#888] text-[9px] px-2 py-1 uppercase font-bold">+ Verse</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative bg-[#020202]">
          {isGenerating ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[#E60000]"><Activity size={64} className="animate-pulse" /><p className="font-oswald text-2xl uppercase tracking-widest mt-4">{uxState}</p></div>
          ) : lyrics ? (
            <div className="max-w-2xl mx-auto space-y-2 pb-32">
              {lyrics.split('\n').map((line, i) => (
                <div key={i} onClick={() => setSelectedLine(line)} className={`flex items-start gap-3 transition-all font-mono text-sm cursor-pointer p-1 ${selectedLine === line ? 'bg-[#E60000]/20 border-l-2 border-[#E60000] text-white' : 'text-gray-300'}`}>
                  <span className="flex-1">{line}</span>
                </div>
              ))}
              <div className="pt-12 flex justify-end">
                <button onClick={() => setActiveRoom("04")} className="bg-white text-black px-8 py-3 font-oswald text-sm font-bold uppercase tracking-widest hover:bg-[#E60000] transition-all">Send to Booth</button>
              </div>
            </div>
          ) : <div className="absolute inset-0 flex items-center justify-center opacity-10"><PenTool size={100} /></div>}
        </div>
        <div className={`absolute bottom-0 left-0 w-full bg-black border-t border-[#E60000] p-6 transition-transform duration-300 ${selectedLine ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="flex gap-3">
             <input type="text" value={refineInstruction} onChange={(e) => setRefineInstruction(e.target.value)} placeholder="Refinement instruction..." className="flex-1 bg-[#111] border border-[#333] p-3 text-xs text-white font-mono" />
             <button onClick={handleRefine} disabled={isRefining} className="bg-[#E60000] text-white px-8 font-oswald text-sm font-bold uppercase tracking-widest">{isRefining ? 'Refining...' : 'Rewrite Line'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}