"use client";

import React, { useState } from "react";
import { ShieldAlert, Zap, Terminal, Activity, Target, Cpu, TrendingUp, HelpCircle, X } from "lucide-react";

interface Directive {
  id: number;
  title: string;
  desc: string;
}

interface RoomData {
  title: string;
  directives: Directive[];
  encouragement: string;
  icon: React.ReactNode;
}

const ROOM_MAP: Record<string, RoomData> = {
  "01": {
    title: "Forensic Ingestion",
    icon: <Terminal size={24} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "DATA PURITY", desc: "Upload high-fidelity instrumentals. Low-bitrate files corrupt the DSP extraction." },
      { id: 2, title: "MDX SEPARATION", desc: "Use the stem splitter to isolate the drums. The algorithm needs a clean transient pulse." }
    ],
    encouragement: "Precision starts at the source. If the math is wrong here, the Hit Score suffers later."
  },
  "02": {
    title: "Neural Mind-Meld",
    icon: <Cpu size={24} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "CADENCE LOCK", desc: "Record 10 seconds of raw mumble flow. Focus on rhythmic patterns, not words." },
      { id: 2, title: "FLOW DNA", desc: "Ensure your transients are sharp. The Ghostwriter uses these to map syllable density." }
    ],
    encouragement: "Synchronize your biological rhythm with the machine's clock."
  },
  "03": {
    title: "Synthetic Synthesis",
    icon: <Target size={24} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "THEMATIC INTENT", desc: "Input your Motive, Struggle, and Hustle. Gritty authenticity is required for 90+ scores." },
      { id: 2, title: "BLUEPRINT MAPPING", desc: "Respect the Hook-Verse-Hook structure. CTR (Code 1) depends on immediate capture." }
    ],
    encouragement: "The TALON engine does not write poetry. It writes commercial warfare."
  },
  "04": {
    title: "Hardware Tracking",
    icon: <Activity size={24} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "SIGNAL CHAIN", desc: "Ensure your input gain is peaking at -6dB. Digital clipping is permanent failure." },
      { id: 2, title: "TELEPROMPTER SYNC", desc: "Follow the red bar. Perfect timing increases the 'Addiction' (APV) metric." }
    ],
    encouragement: "Lay down the source data. Don't overthink the take; the Matrix will fix the energy."
  },
  "05": {
    title: "Vocal Engineering",
    icon: <ShieldAlert size={24} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "TONAL BALANCE", desc: "Use the GetNice EQ preset for vocal-forward clarity. Avoid muddy low-mids." },
      { id: 2, title: "PRESENCE PUNCH", desc: "Saturation adds harmonic excitement. Too much creates fatigue; balance is key." }
    ],
    encouragement: "Glue the performance into the pocket. Make the vocal feel like it was born in the beat."
  },
  "06": {
    title: "Commercial Mastering",
    icon: <Zap size={24} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "LUFS STANDARDS", desc: "Aim for -14 LUFS for DSPs. -9 LUFS for club/aggressive playback." },
      { id: 2, title: "BRICKWALL LIMITING", desc: "Zero ceiling violation is mandatory. Protect the signal from digital bleed." }
    ],
    encouragement: "Prepare for global release. This is the final firewall before the algorithm takes over."
  },
  "07": {
    title: "A&R Neural Scan",
    icon: <TrendingUp size={24} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "THE 3 CODES", desc: "Your score is based on CTR (The Hook), AVP (Audio Pacing), and APV (Addiction)." },
      { id: 2, title: "VIRAL SLICING", desc: "The isolated snippet is your primary weapon. Use it for social infiltration." }
    ],
    encouragement: "The algorithm is ruthless. If you score under 90, go back to the blueprint."
  },
  "08": {
    title: "The Smart Ledger",
    icon: <ShieldAlert size={24} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "UPSTREAM DEALS", desc: "Signing the contract triggers an irreversible 60/40 master split." },
      { id: 2, title: "FIAT LIQUIDITY", desc: "Royalties are withdrawable once the Stripe secure tunnel is verified." }
    ],
    encouragement: "Own your data. Capitalize on your artifact's performance."
  },
  "09": {
    title: "Nation FM Broadcast",
    icon: <Activity size={24} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "BOOST PROTOCOL", desc: "Deploy marketing credits to increase rotational frequency." },
      { id: 2, title: "NETWORK REACH", desc: "Boosts add a multiplier to your global Hit Score visibility." }
    ],
    encouragement: "Dominate the airwaves. Every credit spent is a neural node activated."
  },
  "10": {
    title: "Syndicate Brokerage",
    icon: <Zap size={24} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "ESCROW SECURITY", desc: "Never exchange data outside the matrix. Funds are only safe in Escrow." },
      { id: 2, title: "RESONANCE PURGE", desc: "Low-value chatter is deleted. Maintain high-fidelity collaboration." }
    ],
    encouragement: "Expand the network. The larger the Syndicate, the higher the ROI."
  },
  "11": {
    title: "Agentic Execution",
    icon: <Terminal size={24} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "30-DAY FRAMEWORK", desc: "The Exec AI handles the ads. You handle the energy. Do not miss a day." },
      { id: 2, title: "BIO-LINK TRAFFIC", desc: "Your Smart Drop link is your only path to fan email harvesting." }
    ],
    encouragement: "Follow the framework. Let the machine execute while you scale."
  }
};

export default function RoomDirectives({ roomId }: { roomId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const data = ROOM_MAP[roomId];
  
  if (!data) return null;

  return (
    <>
      {/* FLOATING QUESTION MARK BUTTON */}
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-32 right-6 md:right-10 z-[40] bg-black border-2 border-[#E60000] text-[#E60000] p-4 rounded-full shadow-[0_0_20px_rgba(230,0,0,0.4)] hover:bg-[#E60000] hover:text-white transition-all hover:scale-110 group"
        title="View Room Directives"
      >
        <HelpCircle size={28} />
        <span className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black border border-[#333] text-white text-[10px] px-3 py-1.5 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg">
          Room Directives
        </span>
      </button>

      {/* POPUP MODAL OVERLAY */}
      {isOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#050505] border border-[#E60000]/50 w-full max-w-3xl p-8 md:p-12 shadow-[0_0_50px_rgba(230,0,0,0.2)] relative animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
            
            {/* CLOSE BUTTON */}
            <button 
              onClick={() => setIsOpen(false)}
              className="absolute top-6 right-6 text-[#888] hover:text-white transition-colors p-2 bg-[#111] border border-[#333] rounded-full"
            >
              <X size={24} />
            </button>

            {/* MODAL HEADER */}
            <div className="flex items-center gap-5 mb-8 border-b border-[#E60000]/30 pb-6 shrink-0 pr-12">
              <div className="p-4 bg-[#110000] border border-[#E60000]/30 text-[#E60000] rounded-sm">
                {data.icon}
              </div>
              <div>
                <p className="text-xs text-[#E60000] font-bold uppercase tracking-widest animate-pulse mb-1">
                  System Directives // Node R{roomId}
                </p>
                <h3 className="text-white text-3xl md:text-4xl font-bold uppercase tracking-widest underline underline-offset-8 decoration-[#E60000]">
                  {data.title}
                </h3>
              </div>
            </div>
            
            {/* SCROLLABLE CONTENT */}
            <div className="overflow-y-auto custom-scrollbar flex-1 pr-2 space-y-6">
              {data.directives.map((d) => (
                <div key={d.id} className="flex items-start gap-4 p-6 bg-[#0a0a0a] border border-[#222] hover:border-[#E60000]/50 transition-colors group">
                  <span className="text-[#E60000] font-bold text-2xl mt-0.5">{d.id}.</span>
                  <div>
                    <p className="text-white text-lg md:text-xl font-bold uppercase tracking-widest mb-3 underline underline-offset-4 decoration-[#444] group-hover:decoration-[#E60000] transition-colors">
                      {d.title}
                    </p>
                    <p className="text-white text-sm md:text-base leading-relaxed tracking-wide font-mono">
                      {d.desc}
                    </p>
                  </div>
                </div>
              ))}

              <div className="mt-8 p-6 border border-[#330000] bg-[#110000]">
                <p className="text-sm md:text-base text-white leading-relaxed font-mono">
                  <span className="text-[#E60000] font-bold uppercase tracking-widest block mb-2 underline underline-offset-4 decoration-[#E60000]">OPERATOR NOTE:</span> 
                  {data.encouragement}
                </p>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}