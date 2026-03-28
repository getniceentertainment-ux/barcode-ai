"use client";

import React from "react";
import { ShieldAlert, Zap, Terminal, Activity, Target, Cpu, TrendingUp } from "lucide-react";

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
    icon: <Terminal size={20} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "DATA PURITY", desc: "Upload high-fidelity instrumentals. Low-bitrate files corrupt the DSP extraction." },
      { id: 2, title: "MDX SEPARATION", desc: "Use the stem splitter to isolate the drums. The algorithm needs a clean transient pulse." }
    ],
    encouragement: "Precision starts at the source. If the math is wrong here, the Hit Score suffers later."
  },
  "02": {
    title: "Neural Mind-Meld",
    icon: <Cpu size={20} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "CADENCE LOCK", desc: "Record 10 seconds of raw mumble flow. Focus on rhythmic patterns, not words." },
      { id: 2, title: "FLOW DNA", desc: "Ensure your transients are sharp. The Ghostwriter uses these to map syllable density." }
    ],
    encouragement: "Synchronize your biological rhythm with the machine's clock."
  },
  "03": {
    title: "Synthetic Synthesis",
    icon: <Target size={20} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "THEMATIC INTENT", desc: "Input your Motive, Struggle, and Hustle. Gritty authenticity is required for 90+ scores." },
      { id: 2, title: "BLUEPRINT MAPPING", desc: "Respect the Hook-Verse-Hook structure. CTR (Code 1) depends on immediate capture." }
    ],
    encouragement: "The TALON engine does not write poetry. It writes commercial warfare."
  },
  "04": {
    title: "Hardware Tracking",
    icon: <Activity size={20} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "SIGNAL CHAIN", desc: "Ensure your input gain is peaking at -6dB. Digital clipping is permanent failure." },
      { id: 2, title: "TELEPROMPTER SYNC", desc: "Follow the red bar. Perfect timing increases the 'Addiction' (APV) metric." }
    ],
    encouragement: "Lay down the source data. Don't overthink the take; the Matrix will fix the energy."
  },
  "05": {
    title: "Vocal Engineering",
    icon: <ShieldAlert size={20} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "TONAL BALANCE", desc: "Use the GetNice EQ preset for vocal-forward clarity. Avoid muddy low-mids." },
      { id: 2, title: "PRESENCE PUNCH", desc: "Saturation adds harmonic excitement. Too much creates fatigue; balance is key." }
    ],
    encouragement: "Glue the performance into the pocket. Make the vocal feel like it was born in the beat."
  },
  "06": {
    title: "Commercial Mastering",
    icon: <Zap size={20} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "LUFS STANDARDS", desc: "Aim for -14 LUFS for DSPs. -9 LUFS for club/aggressive playback." },
      { id: 2, title: "BRICKWALL LIMITING", desc: "Zero ceiling violation is mandatory. Protect the signal from digital bleed." }
    ],
    encouragement: "Prepare for global release. This is the final firewall before the algorithm takes over."
  },
  "07": {
    title: "A&R Neural Scan",
    icon: <TrendingUp size={20} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "THE 3 CODES", desc: "Your score is based on CTR (The Hook), AVP (Audio Pacing), and APV (Addiction)." },
      { id: 2, title: "VIRAL SLICING", desc: "The isolated snippet is your primary weapon. Use it for social infiltration." }
    ],
    encouragement: "The algorithm is ruthless. If you score under 90, go back to the blueprint."
  },
  "08": {
    title: "The Smart Ledger",
    icon: <ShieldAlert size={20} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "UPSTREAM DEALS", desc: "Signing the contract triggers an irreversible 60/40 master split." },
      { id: 2, title: "FIAT LIQUIDITY", desc: "Royalties are withdrawable once the Stripe secure tunnel is verified." }
    ],
    encouragement: "Own your data. Capitalize on your artifact's performance."
  },
  "09": {
    title: "Nation FM Broadcast",
    icon: <Activity size={20} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "BOOST PROTOCOL", desc: "Deploy marketing credits to increase rotational frequency." },
      { id: 2, title: "NETWORK REACH", desc: "Boosts add a multiplier to your global Hit Score visibility." }
    ],
    encouragement: "Dominate the airwaves. Every credit spent is a neural node activated."
  },
  "10": {
    title: "Syndicate Brokerage",
    icon: <Zap size={20} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "ESCROW SECURITY", desc: "Never exchange data outside the matrix. Funds are only safe in Escrow." },
      { id: 2, title: "RESONANCE PURGE", desc: "Low-value chatter is deleted. Maintain high-fidelity collaboration." }
    ],
    encouragement: "Expand the network. The larger the Syndicate, the higher the ROI."
  },
  "11": {
    title: "Agentic Execution",
    icon: <Terminal size={20} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "30-DAY FRAMEWORK", desc: "The Exec AI handles the ads. You handle the energy. Do not miss a day." },
      { id: 2, title: "BIO-LINK TRAFFIC", desc: "Your Smart Drop link is your only path to fan email harvesting." }
    ],
    encouragement: "Follow the framework. Let the machine execute while you scale."
  }
};

export default function RoomDirectives({ roomId }: { roomId: string }) {
  const data = ROOM_MAP[roomId];
  if (!data) return null;

  return (
    <div className="bg-[#0a0000] border border-[#E60000]/30 p-6 rounded-sm font-mono animate-in fade-in duration-700 mb-8">
      <div className="flex items-center justify-between mb-6 border-b border-[#E60000]/20 pb-4">
        <div className="flex items-center gap-3">
          {data.icon}
          <h3 className="text-white text-xs font-bold uppercase tracking-[0.3em]">Directive R{roomId} // {data.title}</h3>
        </div>
        <p className="text-[8px] text-[#E60000] font-bold uppercase tracking-widest animate-pulse">
          Node: Online
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.directives.map((d) => (
          <div key={d.id} className="flex items-start gap-3 p-3 bg-black border border-[#222] hover:border-[#E60000]/50 transition-colors">
            <span className="text-[#E60000] font-bold text-[10px] mt-0.5">{d.id}.</span>
            <div>
              <p className="text-white text-[10px] font-bold uppercase tracking-widest mb-1">{d.title}</p>
              <p className="text-[#555] text-[9px] leading-relaxed uppercase tracking-tighter">{d.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-[#111]">
        <p className="text-[9px] text-gray-400 italic leading-relaxed">
          <span className="text-[#E60000] font-bold not-italic">OPERATOR NOTE:</span> "{data.encouragement}"
        </p>
      </div>
    </div>
  );
}