"use client";

import React, { useState } from "react";
import { Mic2, Activity, CheckCircle2, BrainCircuit } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";

export default function Room02_BrainTrain() {
  const { setFlowDNA, setActiveRoom } = useMatrixStore();

  const [status, setStatus] = useState<"idle" | "analyzing" | "success">("idle");
  const [micStatus, setMicStatus] = useState<"idle" | "listening" | "recorded">("idle");
  const [textInput, setTextInput] = useState("");

  const handleRecordCadence = () => {
    setMicStatus("listening");
    // Simulate a 3-second microphone recording capture
    setTimeout(() => {
      setMicStatus("recorded");
    }, 3000);
  };

  const handleSynthesize = () => {
    setStatus("analyzing");
    
    // Simulate DNA extraction from audio and text
    setTimeout(() => {
      // 1. Save DNA to Zustand Global Store
      setFlowDNA({
        tag: micStatus === "recorded" && textInput.trim() ? "Hybrid Flow DNA" : 
             micStatus === "recorded" ? "Audio Cadence DNA" : "Lyrical Text DNA",
        referenceText: textInput.trim() || "Focus on the struggle, the hustle, and survival.",
        syllableDensity: 3.5 // Mock calculated density
      });

      setStatus("success");
    }, 2500);
  };

  const handleProceed = () => {
    setActiveRoom("03");
  };

  return (
    <div className="h-full flex flex-col items-center justify-center max-w-5xl mx-auto animate-in fade-in duration-500">
      
      {status === "idle" && (
        <div className="w-full">
          <div className="text-center mb-12">
            <h2 className="font-oswald text-4xl uppercase tracking-widest mb-4 font-bold flex items-center justify-center gap-4 text-white">
              <BrainCircuit className="text-[#E60000]" size={40} /> Brain Train Matrix
            </h2>
            <p className="font-mono text-xs text-[#555] uppercase tracking-[0.2em]">
              Inject vocal cadence or lyrical structure to prime the TALON Engine.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mb-10">
            {/* LEFT COL: AUDIO RECORDING */}
            <div className={`bg-[#050505] border p-8 flex flex-col items-center text-center rounded-lg group transition-all duration-300
              ${micStatus === 'listening' ? 'border-[#E60000] shadow-[0_0_20px_rgba(230,0,0,0.1)]' : 'border-[#222] hover:border-[#E60000]/50'}`}>
              <h3 className="font-oswald text-xl uppercase tracking-widest mb-8 font-bold text-white">1. Audio Cadence</h3>
              
              <button 
                onClick={handleRecordCadence}
                disabled={micStatus !== 'idle'}
                className={`w-24 h-24 rounded-full border-2 flex items-center justify-center mb-8 transition-all duration-300
                  ${micStatus === 'listening' ? 'bg-[#110000] border-[#E60000] animate-pulse text-[#E60000]' : 
                    micStatus === 'recorded' ? 'bg-[#E60000]/10 border-green-500 text-green-500' : 
                    'bg-black border-[#222] text-[#444] group-hover:text-white group-hover:border-white'}`}
              >
                {micStatus === 'recorded' ? <CheckCircle2 size={40} /> : <Mic2 size={40} />}
              </button>
              
              <div className="h-8">
                {micStatus === 'idle' && <span className="text-[10px] font-mono uppercase tracking-widest text-[#555]">Click to record reference flow</span>}
                {micStatus === 'listening' && <span className="text-[10px] font-mono uppercase tracking-widest text-[#E60000] animate-pulse">Capturing Syllable Density...</span>}
                {micStatus === 'recorded' && <span className="text-[10px] font-mono uppercase tracking-widest text-green-500">Cadence Locked</span>}
              </div>
            </div>

            {/* RIGHT COL: TEXT INPUT */}
            <div className="bg-[#050505] border border-[#222] p-8 flex flex-col rounded-lg group hover:border-[#E60000]/50 transition-all duration-300">
              <h3 className="font-oswald text-xl uppercase tracking-widest mb-6 font-bold text-white">2. Lyrical DNA</h3>
              <p className="text-[9px] font-mono text-[#555] uppercase mb-4 tracking-widest">Paste previous bars for rhyme & syllable extraction</p>
              
              <textarea 
                value={textInput} 
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="I see the vision, I'm making a killing..."
                className="flex-1 bg-black border border-[#111] p-4 text-white font-mono text-xs outline-none focus:border-[#E60000] h-40 custom-scrollbar resize-none transition-colors"
              />
            </div>
          </div>

          <button 
            disabled={micStatus === 'idle' && textInput.trim() === ""}
            onClick={handleSynthesize}
            className="w-full bg-[#E60000] disabled:opacity-20 disabled:cursor-not-allowed text-white py-6 font-oswald text-lg font-bold uppercase tracking-[0.4em] rounded transition-all hover:bg-red-700 hover:shadow-[0_0_30px_rgba(230,0,0,0.3)]"
          >
            Synthesize Flow DNA
          </button>
        </div>
      )}

      {/* ANALYZING STATE */}
      {status === "analyzing" && (
        <div className="flex flex-col items-center">
          <Activity size={80} className="text-[#E60000] animate-spin mb-8" />
          <h2 className="font-oswald text-4xl uppercase tracking-widest mb-4 font-bold text-white">Extracting DNA</h2>
          <p className="font-mono text-xs text-[#E60000] uppercase tracking-[0.3em] animate-pulse">Mapping Syllable Density & Rhyme Scheme...</p>
        </div>
      )}

      {/* SUCCESS STATE */}
      {status === "success" && (
        <div className="text-center animate-in zoom-in duration-500">
          <CheckCircle2 size={80} className="text-green-500 mx-auto mb-8 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full" />
          <h2 className="font-oswald text-4xl uppercase tracking-widest mb-4 font-bold text-white">DNA Sequence Locked</h2>
          <p className="font-mono text-xs text-[#555] uppercase tracking-widest mb-10">Ready for TALON Ingestion</p>
          
          <button 
            onClick={handleProceed} 
            className="bg-white text-black px-16 py-5 font-oswald font-bold uppercase tracking-[0.2em] hover:bg-gray-200 transition-colors"
          >
            Open Ghostwriter
          </button>
        </div>
      )}

    </div>
  );
}