"use client";
// Utility for cleaner timing logic
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export default function Room02_BrainTrain() {
  // FIXED: Added blueprint and setBlueprint back to the store destructing!
  const { setFlowDNA, setActiveRoom, audioData, setGwStyle, blueprint, setBlueprint } = useMatrixStore();

  // Primary States
  const [status, setStatus] = useState<"idle" | "analyzing" | "success">("idle");
  const [micStatus, setMicStatus] = useState<"idle" | "listening" | "analyzing_cadence" | "recorded">("idle");
  const [textInput, setTextInput] = useState("");
  
  const [detectedStyle, setDetectedStyle] = useState<{id: string, name: string} | null>(null);

  const STYLES = {
    getnice_hybrid: "GetNice Hybrid Triplet",
    drill: "NY Drill",
    boom_bap: "Boom Bap",
    melodic_trap: "Melodic Trap",
    chopper: "Chopper (Fast)"
  };

  const handleRecordCadence = async () => {
    try {
      // REAL ACTION: Request actual microphone access from the browser hardware
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStatus("listening");
      
      // Let the user physically rap/mumble their cadence into the active mic for 5 seconds
      setTimeout(() => {
        // REAL ACTION: Turn the microphone off (removes the red dot from the browser tab)
        stream.getTracks().forEach(track => track.stop());
        
        setMicStatus("analyzing_cadence");
        
        // Run the DSP Heuristic based on the beat's BPM from Room 01
  const handleSynthesize = async () => {
    setStatus("analyzing");

    let finalStyleId = detectedStyle?.id || "getnice_hybrid";
    let finalStyleName = detectedStyle?.name || STYLES.getnice_hybrid;

    // TEXT DSP ANALYZER: Refined word-density logic
    if (micStatus !== "recorded" && textInput.trim()) {
      const lines = textInput.split("\n").filter((l) => l.trim().length > 0);
      if (lines.length > 0) {
        const avgWords = lines.reduce((acc, l) => acc + l.trim().split(/\s+/).length, 0) / lines.length;

        if (avgWords >= 12) finalStyleId = "chopper";
        else if (avgWords <= 6) finalStyleId = "melodic_trap";
        else if (audioData?.bpm && audioData.bpm >= 138) finalStyleId = "drill";
        else finalStyleId = "boom_bap";

        finalStyleName = STYLES[finalStyleId as keyof typeof STYLES];
        
        // Update store and local state with text-derived style
        setGwStyle(finalStyleId);
        setDetectedStyle({ id: finalStyleId, name: finalStyleName });
      }
    }

    // Artificial "Deep Analysis" Buffer for UX
    await delay(2500); 

    setFlowDNA({
      tag: `GetNice Hybrid [${finalStyleName}]`,
      referenceText: textInput.trim() || "Focus on the struggle, the hustle, and survival.",
      syllableDensity: finalStyleId === "chopper" ? 5.5 : finalStyleId === "drill" ? 4.0 : 3.5,
    });

    // FIXED: THE SMART BLUEPRINT MATH ALGORITHM
    if (audioData?.totalBars) {
      let remaining = audioData.totalBars;
      const calc: any[] = [];
      
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
  };

  return (
    <div className="h-full flex flex-col items-center justify-center max-w-5xl mx-auto animate-in fade-in duration-500 py-10">
      
      {status === "idle" && (
        <div className="w-full">
          <div className="text-center mb-12">
            <h2 className="font-oswald text-4xl uppercase tracking-widest mb-4 font-bold flex items-center justify-center gap-4 text-white">
              <BrainCircuit className="text-[#E60000]" size={40} /> Brain Train Matrix
            </h2>
            <p className="font-mono text-xs text-[#555] uppercase tracking-[0.2em]">Inject vocal cadence or lyrical text to prime the GetNice Engine.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mb-8">
            <div className={`bg-[#050505] border p-8 flex flex-col items-center text-center rounded-lg group transition-all duration-300 relative overflow-hidden
              ${micStatus === 'listening' ? 'border-[#E60000] shadow-[0_0_20px_rgba(230,0,0,0.1)]' : micStatus === 'analyzing_cadence' ? 'border-yellow-500/50' : 'border-[#222] hover:border-[#E60000]/50'}`}>
              
              {micStatus === 'analyzing_cadence' && <div className="absolute inset-0 bg-yellow-500/5 animate-pulse pointer-events-none" />}

              <h3 className="font-oswald text-xl uppercase tracking-widest mb-8 font-bold text-white relative z-10">1. Audio Cadence</h3>
              
              {micStatus === 'analyzing_cadence' ? (
                <div className="flex flex-col items-center justify-center h-24 mb-8 relative z-10">
                  <AudioWaveform size={40} className="text-yellow-500 animate-bounce mb-2" />
                  <span className="text-[10px] font-mono text-yellow-500 uppercase tracking-widest animate-pulse">Running Vocal DSP...</span>
                </div>
              ) : (
                <button onClick={handleRecordCadence} disabled={micStatus !== 'idle'} className={`w-24 h-24 rounded-full border-2 flex items-center justify-center mb-8 transition-all duration-300 relative z-10
                  ${micStatus === 'listening' ? 'bg-[#110000] border-[#E60000] animate-pulse text-[#E60000]' : micStatus === 'recorded' ? 'bg-green-500/10 border-green-500 text-green-500' : 'bg-black border-[#222] text-[#444] group-hover:text-white group-hover:border-white'}`}>
                  {micStatus === 'recorded' ? <CheckCircle2 size={40} /> : <Mic2 size={40} />}
                </button>
              )}

              <div className="h-10 flex items-center justify-center w-full relative z-10">
                {micStatus === 'recorded' && detectedStyle ? (
                  <div className="bg-green-500/10 border border-green-500/30 px-4 py-2 flex flex-col w-full animate-in zoom-in">
                    <span className="text-[8px] font-mono text-green-500 uppercase tracking-widest font-bold">Vocal Match Detected</span>
                    <span className="text-xs font-oswald text-white uppercase tracking-widest">{detectedStyle.name}</span>
                  </div>
                ) : (
                  <span className="text-[9px] font-mono text-[#555] uppercase tracking-widest">
                    {micStatus === 'listening' ? 'Capturing Transients...' : 'Record 5s of Mumble Flow'}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-[#050505] border border-[#222] p-8 flex flex-col rounded-lg group hover:border-[#E60000]/50 transition-all duration-300">
              <h3 className="font-oswald text-xl uppercase tracking-widest mb-6 font-bold text-white">2. Lyrical DNA</h3>
              <p className="text-[9px] font-mono text-[#555] uppercase mb-4 tracking-widest">Paste previous bars for algorithmic flow extraction</p>
              <textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="I see the vision, I'm making a killing..." className="flex-1 bg-black border border-[#111] p-4 text-white font-mono text-xs outline-none focus:border-[#E60000] h-40 custom-scrollbar resize-none transition-colors" />
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-[#110000] border border-[#E60000]/30 mb-8 max-w-2xl mx-auto">
            <Info className="text-[#E60000] shrink-0 mt-0.5" size={18} />
            <div>
              <p className="font-oswald text-sm text-[#E60000] uppercase tracking-widest font-bold mb-1">The GetNice Hybrid Flow</p>
              <p className="font-mono text-[10px] text-[#888] uppercase leading-relaxed">
                By synthesizing your input, the engine creates a lyrical blend of your unique cadence intertwined with the proprietary GetNice architecture.
              </p>
            </div>
          </div>

          <button disabled={micStatus === 'idle' && textInput.trim() === ""} onClick={handleSynthesize} className="w-full bg-[#E60000] disabled:opacity-20 disabled:cursor-not-allowed text-white py-6 font-oswald text-lg font-bold uppercase tracking-[0.4em] rounded transition-all hover:bg-red-700">
            Synthesize Hybrid Flow
          </button>
        </div>
      )}

      {status === "analyzing" && (
        <div className="flex flex-col items-center">
          <Activity size={80} className="text-[#E60000] animate-spin mb-8" />
          <h2 className="font-oswald text-4xl uppercase tracking-widest mb-4 font-bold text-white">Extracting DNA</h2>
          <p className="font-mono text-[10px] text-[#E60000] uppercase tracking-widest animate-pulse">Blending with GetNice Architecture...</p>
        </div>
      )}

      {status === "success" && (
        <div className="w-full animate-in zoom-in duration-500 max-w-2xl mx-auto">
          <div className="text-center mb-10 bg-[#050505] border border-[#222] p-12 rounded-lg">
            <CheckCircle2 size={64} className="text-green-500 mx-auto mb-6 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full" />
            <h2 className="font-oswald text-3xl uppercase tracking-widest mb-2 font-bold text-white">Hybrid Flow Locked</h2>
            
            {detectedStyle && (
              <p className="font-mono text-[10px] text-green-500 uppercase tracking-widest mb-4 border border-green-500/20 bg-green-500/5 py-2 inline-block px-4">
                Architecture Matrix: {detectedStyle.name}
              </p>
            )}

            <p className="font-mono text-xs text-[#888] uppercase tracking-widest leading-relaxed">
              Your flow DNA has been successfully blended with the GetNice lyrical structure. The Ghostwriter is now primed.
            </p>
          </div>
          
          <button onClick={() => setActiveRoom("03")} className="flex items-center justify-center gap-3 w-full bg-white text-black py-5 font-oswald font-bold text-lg uppercase tracking-[0.2em] hover:bg-[#E60000] hover:text-white transition-colors">
            Enter Ghostwriter Suite <ArrowRight size={20} />
          </button>
        </div>
      )}

    </div>
  );
}