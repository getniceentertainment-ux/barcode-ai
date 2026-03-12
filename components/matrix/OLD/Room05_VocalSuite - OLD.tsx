"use client";

import React, { useState } from "react";
import { Mic2, Sliders, PlayCircle, Loader2, CheckCircle2, Waves, Settings2, ArrowRight } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";

const VOCAL_CHAINS = [
  { id: "chain_01", name: "Atlanta Trap", desc: "Heavy Pitch Correction + Crisp Highs", color: "text-[#E60000]" },
  { id: "chain_02", name: "NY Drill", desc: "Dry, Aggressive Compression", color: "text-blue-500" },
  { id: "chain_03", name: "R&B Melodic", desc: "Lush Reverb + Stereo Delay", color: "text-purple-500" },
  { id: "chain_04", name: "Raw Podcast", desc: "Noise Gate + Vocal Leveler", color: "text-green-500" },
];

export default function Room05_VocalSuite() {
  const { setActiveRoom } = useMatrixStore();
  
  const [activeChain, setActiveChain] = useState(VOCAL_CHAINS[0].id);
  const [pitchIntensity, setPitchIntensity] = useState(80);
  const [reverbMix, setReverbMix] = useState(30);
  const [status, setStatus] = useState<"idle" | "processing" | "success">("idle");

  const handleApplyEngineering = async () => {
    setStatus("processing");
    
    // Simulate API call to an AI mixing model (e.g., standard audio processing API)
    await new Promise(resolve => setTimeout(resolve, 3500));
    
    setStatus("success");
  };

  const handleProceed = () => {
    setActiveRoom("06");
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-[#050505] animate-in fade-in duration-500 border border-[#222]">
      
      {/* LEFT COL: AI VOCAL CHAINS */}
      <div className="w-full md:w-1/3 border-r border-[#222] flex flex-col bg-black">
        <div className="p-6 border-b border-[#222]">
          <h2 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white flex items-center gap-3">
            <Settings2 size={24} className="text-[#E60000]" /> Engineering
          </h2>
          <p className="font-mono text-[10px] text-[#555] uppercase mt-2 tracking-widest">
            AI-Driven Vocal Mixing & FX
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          <p className="text-[10px] text-[#888] font-mono uppercase tracking-widest mb-4 ml-2">Select Mix Preset</p>
          
          {VOCAL_CHAINS.map(chain => (
            <button
              key={chain.id}
              onClick={() => setActiveChain(chain.id)}
              className={`w-full text-left p-4 border transition-all flex flex-col gap-2
                ${activeChain === chain.id ? 'border-[#E60000] bg-[#110000]' : 'border-[#222] bg-[#0a0a0a] hover:border-[#555]'}`}
            >
              <span className={`font-oswald text-lg uppercase tracking-widest font-bold ${activeChain === chain.id ? 'text-white' : 'text-gray-400'}`}>
                {chain.name}
              </span>
              <span className="font-mono text-[9px] text-[#888] uppercase tracking-widest">
                {chain.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT COL: MACRO CONTROLS & PROCESSING */}
      <div className="flex-1 flex flex-col p-8 md:p-12 relative overflow-hidden">
        {/* Background Visualizer Graphic */}
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
          <Waves size={400} />
        </div>

        <div className="relative z-10 max-w-xl mx-auto w-full flex-1 flex flex-col">
          
          <div className="bg-black border border-[#222] p-8 mb-8">
            <h3 className="font-oswald text-xl uppercase tracking-widest text-[#E60000] mb-6 border-b border-[#222] pb-3 flex items-center gap-2">
              <Sliders size={18} /> Macro Adjustments
            </h3>
            
            <div className="space-y-8">
              {/* Pitch Correction Slider */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[10px] font-mono uppercase text-[#888] tracking-widest">Pitch Correction (Auto-Tune)</label>
                  <span className="text-xs font-mono text-white">{pitchIntensity}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={pitchIntensity} onChange={(e) => setPitchIntensity(Number(e.target.value))}
                  className="w-full h-1 bg-[#333] appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#E60000]"
                />
                <div className="flex justify-between text-[8px] font-mono text-[#555] uppercase mt-1">
                  <span>Natural</span>
                  <span>Robotic</span>
                </div>
              </div>

              {/* Reverb/Space Slider */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[10px] font-mono uppercase text-[#888] tracking-widest">Wet/Dry Mix (Space)</label>
                  <span className="text-xs font-mono text-white">{reverbMix}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={reverbMix} onChange={(e) => setReverbMix(Number(e.target.value))}
                  className="w-full h-1 bg-[#333] appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#E60000]"
                />
                <div className="flex justify-between text-[8px] font-mono text-[#555] uppercase mt-1">
                  <span>Dry (Booth)</span>
                  <span>Wet (Arena)</span>
                </div>
              </div>
            </div>
          </div>

          {/* ACTION AREA */}
          <div className="mt-auto">
            {status === "idle" && (
              <button 
                onClick={handleApplyEngineering}
                className="w-full bg-[#E60000] text-white py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.2)] flex justify-center items-center gap-3"
              >
                Apply AI Vocal Chain <PlayCircle size={20} />
              </button>
            )}

            {status === "processing" && (
              <div className="bg-[#110000] border border-[#E60000] p-6 flex flex-col items-center text-center animate-pulse">
                <Loader2 size={32} className="text-[#E60000] animate-spin mb-4" />
                <p className="font-oswald text-xl uppercase tracking-widest font-bold text-white">Rendering Audio...</p>
                <p className="font-mono text-[10px] text-[#E60000] uppercase tracking-widest mt-2">Applying dynamic EQ, Compression, and Pitch mapping.</p>
              </div>
            )}

            {status === "success" && (
              <div className="bg-green-500/10 border border-green-500/30 p-6 flex flex-col items-center text-center animate-in zoom-in">
                <CheckCircle2 size={32} className="text-green-500 mb-4" />
                <p className="font-oswald text-xl uppercase tracking-widest font-bold text-white mb-6">Vocals Engineered</p>
                <button 
                  onClick={handleProceed}
                  className="w-full bg-white text-black py-4 font-oswald text-md font-bold uppercase tracking-widest hover:bg-gray-200 transition-all flex justify-center items-center gap-3"
                >
                  Proceed to Mastering <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}