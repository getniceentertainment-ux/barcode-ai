"use client";

import React, { useState } from "react";
import { Sliders, CheckCircle2, Activity, ArrowRight, AudioWaveform, Disc3 } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";

export default function Room06_Mastering() {
  const { setActiveRoom } = useMatrixStore();
  
  const [lufs, setLufs] = useState(-14); // -14 LUFS is the Spotify/Apple Music standard
  const [status, setStatus] = useState<"idle" | "processing" | "success">("idle");

  const handleMastering = () => {
    setStatus("processing");
    
    // Simulate DSP Mastering sequence (Limiting, EQ, Compression)
    setTimeout(() => {
      setStatus("success");
    }, 4500);
  };

  const handleProceed = () => {
    setActiveRoom("07");
  };

  return (
    <div className="h-full flex flex-col items-center justify-center max-w-4xl mx-auto animate-in fade-in duration-500">
      
      {/* Dynamic Header Icon based on state */}
      <div className="mb-10 relative">
        {status === "idle" && <Disc3 size={80} className="text-[#333] animate-[spin_10s_linear_infinite]" />}
        {status === "processing" && <AudioWaveform size={80} className="text-[#E60000] animate-pulse" />}
        {status === "success" && <CheckCircle2 size={80} className="text-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)] rounded-full" />}
      </div>

      <div className="text-center mb-12">
        <h2 className="font-oswald text-5xl uppercase tracking-widest mb-4 font-bold text-white">
          R06: Mastering Suite
        </h2>
        {status === "idle" && (
          <p className="font-mono text-xs text-[#555] uppercase tracking-[0.2em]">
            Final Output Limiters // LUFS Normalization
          </p>
        )}
        {status === "processing" && (
          <p className="font-mono text-xs text-[#E60000] uppercase tracking-[0.2em] animate-pulse">
            Applying Multi-band Compression & True Peak Limiting...
          </p>
        )}
        {status === "success" && (
          <p className="font-mono text-xs text-green-500 uppercase tracking-[0.2em]">
            Commercial Standard Reached // Ready for Distribution
          </p>
        )}
      </div>

      {status === "idle" && (
        <div className="w-full bg-[#050505] border border-[#222] p-10 flex flex-col items-center rounded-lg relative overflow-hidden group hover:border-[#E60000]/50 transition-all duration-500">
          {/* Subtle background grid */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#222 1px, transparent 1px), linear-gradient(90deg, #222 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          
          <div className="w-full max-w-lg mb-12 relative z-10">
            <div className="flex justify-between items-end text-[10px] uppercase font-bold text-[#888] mb-6">
              <span className="flex items-center gap-2"><Sliders size={14} className="text-[#E60000]" /> Target Loudness</span>
              <div className="text-right">
                <span className={`font-oswald text-3xl font-bold ${lufs > -10 ? 'text-[#E60000]' : lufs > -12 ? 'text-yellow-500' : 'text-white'}`}>
                  {lufs} <span className="text-xs font-mono text-[#555]">LUFS</span>
                </span>
              </div>
            </div>
            
            <div className="relative">
              <input 
                type="range" min="-20" max="-6" step="0.5" 
                value={lufs} 
                onChange={(e) => setLufs(parseFloat(e.target.value))} 
                className="w-full accent-[#E60000] h-2 bg-[#111] appearance-none cursor-pointer rounded-full relative z-10" 
              />
              {/* Custom tick marks */}
              <div className="flex justify-between text-[8px] font-mono text-[#444] mt-3 absolute w-full -bottom-6">
                <span>-20 (VINYL)</span>
                <span className="text-white border-b border-white">-14 (SPOTIFY)</span>
                <span>-10 (CLUB)</span>
                <span className="text-[#E60000]">-6 (BRICK)</span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={handleMastering} 
            className="relative z-10 w-full max-w-lg bg-[#E60000] text-white py-5 font-oswald text-xl font-bold uppercase tracking-[0.3em] hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.2)] hover:shadow-[0_0_30px_rgba(230,0,0,0.4)]"
          >
            Initiate Final Master
          </button>
        </div>
      )}

      {status === "processing" && (
        <div className="w-full max-w-lg bg-[#050505] border border-[#E60000]/30 p-10 rounded-lg relative overflow-hidden flex flex-col items-center">
          <Activity size={64} className="text-[#E60000] animate-bounce mb-8" />
          
          {/* Mock progress bar */}
          <div className="w-full h-1 bg-[#111] overflow-hidden mb-4">
            <div className="h-full bg-[#E60000] w-full animate-[pulse_1s_ease-in-out_infinite]" style={{ transformOrigin: "left", animationName: "scale-x" }}></div>
          </div>
          
          <div className="w-full flex justify-between text-[9px] font-mono uppercase text-[#555]">
            <span>Processing stems</span>
            <span className="text-[#E60000]">Peak: -0.1dB</span>
          </div>
        </div>
      )}

      {status === "success" && (
        <div className="animate-in zoom-in duration-500">
          <button 
            onClick={handleProceed} 
            className="flex items-center gap-3 bg-white text-black px-12 py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-gray-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          >
            Move to Distribution <ArrowRight size={20} />
          </button>
        </div>
      )}

      {/* Added global animation keyframes for the progress bar */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scale-x {
          0% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
      `}} />
    </div>
  );
}