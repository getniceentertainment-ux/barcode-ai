"use client";

import React from "react";
import { ShieldAlert, Zap } from "lucide-react";

const DIRECTIVES = [
  { id: 1, title: "THE 90+ STANDARD", desc: "Achieve a 90+ Hit Score in Room 07 to unlock the $1,500 Upstream Advance." },
  { id: 2, title: "ESCROW PROTOCOL", desc: "Funds secured in Escrow for features. No delivery = No payout." },
  { id: 3, title: "OWNERSHIP", desc: "100% ownership until Upstream Deal; then 60/40 split for global amplification." },
  { id: 4, title: "THE EXEC", desc: "AI command takes over post-signing. Follow the 30-day blueprint." },
  { id: 5, title: "DATA HARVESTING", desc: "Low-resonance chatter is purged. Focus on APV and high-value exchange." },
  { id: 6, title: "CONTENT BUTCHERY", desc: "Shred assets into vertical clips. Measured by retention (AVP)." }
];

export default function ChatRules() {
  return (
    <div className="bg-[#0a0000] border border-[#E60000]/30 p-6 rounded-sm font-mono animate-in fade-in duration-700">
      <div className="flex items-center gap-3 mb-6 border-b border-[#E60000]/20 pb-4">
        <ShieldAlert size={20} className="text-[#E60000] animate-pulse" />
        <h3 className="text-white text-xs font-bold uppercase tracking-[0.3em]">System Directives // Syndicate Rules</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DIRECTIVES.map((d) => (
          <div key={d.id} className="group relative">
            <div className="flex items-start gap-3 p-3 bg-black border border-[#222] group-hover:border-[#E60000]/50 transition-colors h-full">
              <span className="text-[#E60000] font-bold text-[10px] mt-0.5">{d.id}.</span>
              <div>
                <p className="text-white text-[10px] font-bold uppercase tracking-widest mb-1 group-hover:text-[#E60000] transition-colors">
                  {d.title}
                </p>
                <p className="text-[#555] text-[9px] leading-relaxed uppercase tracking-tighter">
                  {d.desc}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#444]">
          <Zap size={10} />
          <span className="text-[8px] uppercase tracking-widest">Protocol Version 2026.03</span>
        </div>
        <p className="text-[8px] text-[#E60000] font-bold uppercase tracking-widest animate-pulse">
          Status: Operational
        </p>
      </div>
    </div>
  );
}