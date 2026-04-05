"use client";

import React, { useState, useEffect } from "react";
import { 
  PenTool, Play, RefreshCw, Zap, AlignLeft, Edit3, 
  Loader2, Layout, ShieldCheck, Cpu, Activity, 
  ArrowRight, Lock, Plus 
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

    // NEW A&R DIRECTIVES
    gwStrikeZone = "snare", setGwStrikeZone = () => {},
    gwHookType = "chant", setGwHookType = () => {},
    gwFlowEvolution = "static", setGwFlowEvolution = () => {}
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
    const hookVariation = variations[0]; 
    const verseVariations = variations.length > 1 ? variations.slice(1) : variations;
    let verseCounter = 0;
    
    let needsUpdate = false;

    const synced = blueprint.map((block) => {
      const start = Math.max(cursor, (block as any).startBar ?? cursor);
      
      let selected;
      if (block.type === 'HOOK') {
          selected = hookVariation;
      } else {
          selected = verseVariations[verseCounter % verseVariations.length];
          if (block.type !== 'INSTRUMENTAL') verseCounter++;
      }
      
      // --- SURGICAL FIX: DECOUPLE ENERGY FROM SYLLABLE MATH ---
      // We pass the rhythmic FLOW_VAULT descriptions directly.
      // The Python backend will handle the DSP dynamic_array silently in the background.
      const activeArray = selected.array;
      const activeName = selected.name;
      const activeDesc = selected.desc;
      
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
  }, [gwStyle, layoutHash, blueprint, audioData]); 

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
    const currentSectionCount = blueprint.length;

    if (isFreeLoader && currentSectionCount >= 2) {
      if (addToast) {
        addToast(
          "Free Tier Limited to 2 Sections (1 Hook & 1 Verse). Upgrade to 'The Artist' for unlimited blocks.", 
          "error"
        );
      }
      return;
    }
    const lastBlock = blueprint[blueprint.length - 1] as any;
    const nextStart = lastBlock && lastBlock.startBar !== undefined ? lastBlock.startBar + lastBlock.bars : 0;
    
    const newBlock = { 
      id: Math.random().toString(), 
      type, 
      bars, 
      startBar: nextStart 
    };
    
    setBlueprint([...blueprint, newBlock]);
  };

  const removeSection = (id: string) => {
    setBlueprint(blueprint.filter(b => b.id !== id));
  };

  const handleGenerate = async () => {
    if (!userSession?.id) return addToast("Security Exception: User Session missing.", "error");
    if (!gwPrompt.trim()) return addToast("Missing thematic directive.", "error");
    if (!audioData) return addToast("Instrumental DSP data missing. Return to Room 01.", "error");
    
    if (!hasEnoughCredits) {
      if(addToast) addToast(`Insufficient Credits. You need ${currentCost} CRD.`, "error");
      return;
    }

    setIsGenerating(true);
    setUxState("Synthesizing Bars via GETNICE Engine...");

    const systemConstraint = `ABSOLUTE ENGINE RULES:
1. RAW LYRICS ONLY: You must ONLY output the lyrics.
2. NO PREFIXES: NEVER output labels like "1st Line:", "Hook:", or "Verse:" before the lyrics.
3. NO PADDING: NEVER pad lines with empty pipe symbols (e.g., "words. | | |" is FORBIDDEN). Use pipes ONLY between syllables (e.g., "CHIL|LAX|IN").
4. NO META-COMMENTARY: Do not explain your output or write "(pipe symbol required)".
5. COMPOUND RHYMING: Use 2- or 3-syllable compound rhymes on the structural accents.
6. PITCH INTONATION: Align your vowel choices to the pitch contour of the beat. Use closed/heavy vowels for pitch drops, and open/elongated vowels for tension rises.`;

    const keyParts = audioData?.key ? audioData.key.split(" ") : ["C", "minor"];
    const rootNote = keyParts[0];
    const scale = keyParts.slice(1).join(" ");

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
          stageName: userSession?.stageName || "Unknown Artist", 
          prompt: gwPrompt,
          flowReference: flowDNA?.referenceText,
          motive: gwMotive || "Mastering the craft",
          struggle: gwStruggle || "Against the odds",
          hustle: gwHustle || "Relentless execution",
          title: gwTitle,
          bpm: audioData?.bpm,
          style: gwStyle,
          tag: flowDNA?.tag,
          useSlang: gwUseSlang,
          useIntel: gwUseIntel,
          
          // INJECTING THE TOPLINE A&R DIRECTIVES
          strikeZone: gwStrikeZone,
          hookType: gwHookType,
          flowEvolution: gwFlowEvolution,
          pocket: gwPocket, // Fallback for safety
          
          root_note: rootNote,
          scale: scale,
          contour: (audioData as any)?.contour || "drops into a lower, cadential register",
          dynamic_array: (audioData as any)?.dynamic_array,
          
          systemConstraint: systemConstraint, 
          blueprint: blueprint.map(b => ({ 
            type: b.type, 
            bars: b.bars, 
            startBar: (b as any).startBar,
            patternDesc: (b as any).patternDesc,
            patternArray: (b as any).patternArray
          }))
        })
      });

      const initData = await initRes.json();
      if (!initRes.ok) throw new Error(initData.error || "Failed to initialize GETNICE.");

      const jobId = initData.jobId;
      let attempts = 0;

      const pollInterval = setInterval(async () => {
        attempts++;
        setPollingAttempts(attempts);
        if (attempts > 2) setUxState("Warming up Neural Network...");
        else setUxState("Synthesizing Bars...");

        try {
          const statusRes = await fetch(`/api/ghostwriter?jobId=${jobId}&t=${Date.now()}`);
          const statusData = await statusRes.json();

          if (statusData.status === 'COMPLETED') {
            clearInterval(pollInterval);
            setIsGenerating(false);
            
            let rawLyrics = statusData.output.lyrics || "";
            let cleanedLyrics = rawLyrics
              .replace(/\(pipe symbol.*?\)/gi, '') 
              .replace(/\|(?:\s*\|)+/g, '') 
              .replace(/(\(\d+:\d{2}\)\s*)\|\s*/gm, '$1') 
              .replace(/\|\s*$/gm, '') 
              .replace(/(\(\d+:\d{2}\)\s*)(?:\d+(?:st|nd|rd|th)? Line:|Line \d+:|Hook:|Verse:|Chorus:|Intro:|Outro:)\s*/gmi, '$1')
              .trim();

            setLyrics(cleanedLyrics);
            setGeneratedLyrics(cleanedLyrics);
            if(addToast) addToast(`Lyrics Synthesized.`, "success");
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
          stageName: userSession?.stageName || "Unknown Artist",
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

  return (
    <div className="flex h-full bg-[#050505] border border-[#222] rounded-lg overflow-hidden animate-in fade-in duration-500">
      
      {/* LEFT COL: PROMPT ENGINE */}
      <div className="w-1/3 border-r border-[#222] flex flex-col relative overflow-y-auto custom-scrollbar shrink-0">
        <div className="p-6 border-b border-[#222] bg-black sticky top-0 z-10">
          <h2 className="font-oswald text-2xl uppercase tracking-widest font-bold text-[#E60000] flex items-center gap-3">
            <PenTool size={24} /> GETNICE Engine
          </h2>
          <p className="font-mono text-[10px] text-[#555] uppercase mt-2 tracking-widest">Neural Parameter Matrix</p>
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

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-mono text-[#E60000] uppercase tracking-widest mb-1 block font-bold">The Drive (Motive)</label>
              <input 
                type="text" 
                value={gwMotive} 
                onChange={(e) => setGwMotive(e.target.value)} 
                placeholder="E.g., Building a media brand..." 
                className="w-full bg-[#111] border border-[#333] p-2 text-xs text-white font-mono outline-none focus:border-[#E60000] transition-colors" 
              />
            </div>
            
            <div>
              <label className="text-[10px] font-mono text-[#E60000] uppercase tracking-widest mb-1 block font-bold">The Setback (Struggle)</label>
              <input 
                type="text" 
                value={gwStruggle} 
                onChange={(e) => setGwStruggle(e.target.value)} 
                placeholder="E.g., Equipment failures and tight margins..." 
                className="w-full bg-[#111] border border-[#333] p-2 text-xs text-white font-mono outline-none focus:border-[#E60000] transition-colors" 
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-[#E60000] uppercase tracking-widest mb-1 block font-bold">The Execution (Hustle)</label>
              <input 
                type="text" 
                value={gwHustle} 
                onChange={(e) => setGwHustle(e.target.value)} 
                placeholder="E.g., Late night DAW sessions..." 
                className="w-full bg-[#111] border border-[#333] p-2 text-xs text-white font-mono outline-none focus:border-[#E60000] transition-colors" 
              />
            </div>

            <div>
              <label className="text-[10px] font-mono text-[#888] uppercase tracking-widest mb-1 block font-bold mt-4">Current Topic (Thematic Focus)</label>
              <textarea 
                value={gwPrompt} 
                onChange={(e) => setGwPrompt(e.target.value)} 
                placeholder="What is this specific song about?" 
                className="w-full h-16 bg-black border border-[#333] p-3 text-xs text-white font-mono outline-none focus:border-[#E60000] custom-scrollbar resize-none transition-colors" 
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono text-[#888] uppercase tracking-widest mb-2 block font-bold">Flow Architecture</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {styles.map(s => (
                <button 
                  key={s.id}
                  onClick={() => setGwStyle(s.id)} 
                  className={`p-3 border font-oswald text-[10px] uppercase tracking-widest transition-all ${gwStyle === s.id ? 'bg-[#E60000] border-[#E60000] text-white' : 'bg-[#111] border-[#333] text-[#888] hover:text-white hover:border-[#555]'}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* TOPLINE DIRECTIVES (A&R CONTROL) */}
          <div className="space-y-4 mt-6 pt-6 border-t border-[#222]">
            <h3 className="font-oswald text-sm uppercase tracking-widest text-[#E60000] font-bold mb-4">Topline Directives</h3>
            
            <div>
              <label className="text-[10px] font-mono text-[#888] uppercase tracking-widest mb-2 block font-bold">The Strike Zone (Rhyme Target)</label>
              <select 
                value={gwStrikeZone}
                onChange={(e) => setGwStrikeZone(e.target.value)}
                className="w-full bg-black border border-[#333] p-3 text-xs text-white font-mono outline-none focus:border-[#E60000] transition-colors uppercase tracking-widest"
              >
                <option value="snare">The 2 & 4 (Snare Snap)</option>
                <option value="downbeat">The Downbeat (Heavy Kick / Drill)</option>
                <option value="spillover">The Spillover (Delayed Drag)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono text-[#888] uppercase tracking-widest mb-2 block font-bold">Hook Architecture (Mathematical Subdivisions)</label>
              <select 
                value={gwHookType}
                onChange={(e) => setGwHookType(e.target.value)}
                className="w-full bg-black border border-[#333] p-3 text-xs text-white font-mono outline-none focus:border-[#E60000] transition-colors uppercase tracking-widest"
              >
                <option value="chant">Stadium Chant (Spacious & Melodic)</option>
                <option value="bouncy">The Double-Up (Dense & Repetitive)</option>
                <option value="triplet">The Trap Triplet (12-Beat Subdivision)</option>
                <option value="symmetry">Symmetry Break (A-B-A-B Structure)</option>
                <option value="prime">Prime Syncopation (Off-Beat Slide)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono text-[#888] uppercase tracking-widest mb-2 block font-bold">Verse Dynamics</label>
              <select 
                value={gwFlowEvolution}
                onChange={(e) => setGwFlowEvolution(e.target.value)}
                className="w-full bg-black border border-[#333] p-3 text-xs text-white font-mono outline-none focus:border-[#E60000] transition-colors uppercase tracking-widest"
              >
                <option value="static">Locked In (Consistent Cadence)</option>
                <option value="switch">The Switch-Up (Mid-Verse Flow Shift)</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 pt-6 border-t border-[#222]">
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

        <div className="p-6 border-t border-[#222] bg-black sticky bottom-0 z-20">
          {!hasEnoughCredits && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center border-t border-[#E60000]/20">
              <Lock size={18} className="text-[#E60000] mb-1" />
              <p className="text-[10px] uppercase font-bold text-white tracking-widest">Requires {currentCost} Credits</p>
            </div>
          )}
          <button 
            onClick={handleGenerate} 
            disabled={isGenerating || !gwPrompt.trim() || !hasEnoughCredits} 
            className="w-full bg-[#E60000] text-white py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex justify-center items-center gap-3 shadow-[0_0_20px_rgba(230,0,0,0.2)]"
          >
            {isGenerating ? <><Loader2 size={20} className="animate-spin" /> Synthesizing</> : <><Zap size={20} /> Generate Track {currentCost > 0 ? `(${currentCost} CRD)` : ''}</>}
          </button>
        </div>
      </div>

      {/* RIGHT COL: BLUEPRINT VISUALIZER & LYRICS */}
      <div className="flex-1 flex flex-col relative bg-[#020202] overflow-hidden">
        
        {/* HEADER */}
        <div className="h-16 border-b border-[#222] bg-[#0a0a0a] flex items-center justify-between px-8 shrink-0">
           <h3 className="font-oswald text-lg uppercase tracking-widest text-[#888] flex items-center gap-3">
             <Layout size={16} /> Song Blueprint <span className="text-[#333]">|</span> <span className="text-[#E60000] text-sm">{calculateTotalBars()} Bars Target</span>
           </h3>
           <div className="flex items-center gap-4">
             {!isMogul && (
               <span className={`text-[10px] font-mono uppercase px-2 py-1 font-bold ${hasEnoughCredits ? 'text-yellow-500 bg-yellow-500/10 border border-yellow-500/30' : 'text-red-500 bg-red-500/10 border border-red-500/30'}`}>
                 Cost: {currentCost} CRD
               </span>
             )}
             {audioData && <span className="text-[#E60000] font-mono text-[10px] uppercase tracking-widest">Locked to {Math.round(audioData.bpm)} BPM</span>}
             <button onClick={() => {setLyrics(""); setGeneratedLyrics("");}} className="text-[#555] hover:text-white transition-colors"><RefreshCw size={14} /></button>
           </div>
        </div>

        {/* BLUEPRINT BLOCK BUILDER */}
        <div className="h-44 bg-black border-b border-[#222] overflow-x-auto flex items-center px-8 gap-4 shrink-0 custom-scrollbar shadow-[inset_0_-10px_20px_rgba(0,0,0,0.5)]">
          {blueprint.map((block, index) => (
            <div key={block.id} className="w-40 shrink-0 bg-[#050505] border border-[#333] p-4 flex flex-col justify-between h-32 group relative hover:border-[#E60000] transition-colors">
              <button onClick={() => removeSection(block.id)} className="absolute -top-2 -right-2 bg-red-900 text-white w-5 h-5 rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-lg">×</button>
              <div className="text-[9px] font-mono text-[#888] uppercase tracking-widest flex justify-between">
                <span>Block {index + 1}</span>
              </div>
              <div>
                <h4 className={`font-oswald text-lg uppercase tracking-widest ${block.type === 'INSTRUMENTAL' ? 'text-blue-500' : 'text-white'}`}>{block.type}</h4>
                <p className="font-mono text-[10px] text-[#E60000] font-bold">{block.bars} BARS</p>
                {(block as any).patternName && block.type !== 'INSTRUMENTAL' && (
                  <p className="font-mono text-[8px] text-yellow-500 uppercase mt-1 truncate" title={(block as any).patternDesc}>
                    {(block as any).patternName} [{(block as any).patternArray?.join(',')}]
                  </p>
                )}
              </div>

              <div className="flex justify-between items-center mt-2 border-t border-[#333] pt-2">
                <span className="text-[9px] font-mono text-[#555] uppercase tracking-widest">Start Bar</span>
                <div className="flex items-center gap-2">
                   <span className="text-[9px] text-[#E60000] font-mono">{formatTime(((block as any).startBar || 0) * secondsPerBar)}</span>
                   <input 
                     type="number" 
                     value={(block as any).startBar ?? 0}
                     onChange={(e) => updateBlueprintStartBar(index, parseInt(e.target.value) || 0)}
                     className="w-10 bg-black border border-[#444] text-white text-xs text-center font-mono outline-none focus:border-[#E60000]"
                   />
                </div>
              </div>
            </div>
          ))}
          
          {/* ADD STRUCTURE BLOCK */}
          <div className="w-48 shrink-0 bg-transparent border border-dashed border-[#333] p-3 flex flex-col justify-center h-32 gap-2 relative">
            {(userSession?.tier as string) === "Free Loader" && blueprint.length >= 2 && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10">
                <Lock size={14} className="text-[#E60000] mb-1" />
                <span className="text-[8px] font-mono text-white uppercase font-bold tracking-tighter text-center px-2">Sections Locked</span>
              </div>
            )}
            <p className="text-[8px] font-mono text-[#555] uppercase text-center tracking-widest">Add Structure</p>
            <div className="flex gap-1 justify-center flex-wrap">
              <button 
                onClick={() => addSection("HOOK", 8)} 
                disabled={(userSession?.tier as string) === "Free Loader" && blueprint.length >= 2}
                className="bg-[#111] hover:bg-[#E60000] hover:text-white text-[#888] text-[9px] px-2 py-1 uppercase font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Hook
              </button>
              <button 
                onClick={() => addSection("VERSE", 16)} 
                disabled={(userSession?.tier as string) === "Free Loader" && blueprint.length >= 2}
                className="bg-[#111] hover:bg-[#E60000] hover:text-white text-[#888] text-[9px] px-2 py-1 uppercase font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Verse
              </button>
              <button 
                onClick={() => addSection("INSTRUMENTAL", 8)} 
                disabled={(userSession?.tier as string) === "Free Loader" && blueprint.length >= 2}
                className="bg-[#111] hover:bg-blue-600 hover:text-white text-[#888] text-[9px] px-2 py-1 uppercase font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Instr.
              </button>
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
              <div className="flex items-center justify-between border-b border-[#222] pb-6 mb-8">
                <div>
                  <h3 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white glow-red">{gwTitle || "UNTITLED ARTIFACT"}</h3>
                  <p className="font-mono text-[10px] text-[#555] uppercase tracking-widest mt-2 flex items-center gap-2">
                    <AlignLeft size={12}/> Thematic Intent: {gwPrompt ? gwPrompt.substring(0, 50) + "..." : "None"}
                  </p>
                </div>
                <Cpu size={32} className="text-[#E60000] opacity-50" />
              </div>

              {(() => {
                 let currentBlockIndex = -1;
                 let barOffsetWithinBlock = 0;
                 
                 return lyrics.split('\n').map((line, i) => {
                   const text = line.trim();
                   if (!text) return null;

                   if (text.startsWith('[')) {
                      currentBlockIndex++;
                      barOffsetWithinBlock = 0;
                      return <p key={i} className="text-[#E60000] font-bold mt-8 mb-4 tracking-widest text-xs">{text}</p>;
                   }
                   
                   let blockStartBar = 0;
                   if (currentBlockIndex >= 0 && currentBlockIndex < blueprint.length) {
                       const block = blueprint[currentBlockIndex];
                       if ((block as any).startBar !== undefined) blockStartBar = (block as any).startBar;
                   }

                   const absoluteBar = blockStartBar + barOffsetWithinBlock;
                   const startTimeSec = absoluteBar * secondsPerBar;
                   const mins = Math.floor(startTimeSec / 60);
                   const secs = Math.floor(startTimeSec % 60).toString().padStart(2, '0');
                   const timestamp = `(${mins}:${secs})`;
                   
                   barOffsetWithinBlock++;
                   
                   return (
                     <div 
                        key={i} 
                        onClick={() => setSelectedLine(text)}
                        className={`flex items-start gap-3 transition-all font-mono text-sm cursor-pointer rounded p-1
                          ${selectedLine === text ? 'bg-[#E60000]/20 border-l-2 border-[#E60000] pl-3 text-white font-bold' : 'text-gray-300 hover:text-white hover:bg-[#111]'}`}
                     >
                        <span className="text-[9px] text-[#555] mt-1 shrink-0 select-none">{timestamp}</span>
                        <span className="flex-1">{text}</span>
                     </div>
                   );
                 });
              })()}

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
               placeholder="E.g., Make it rhyme with 'cash'..." 
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