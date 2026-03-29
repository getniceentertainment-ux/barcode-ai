"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
    title: "Forensic Audio Injection",
    icon: <Terminal size={28} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "SECURE INGESTION", desc: "Upload strict high-fidelity WAV/MP3s (20MB limit) via encrypted Supabase storage buckets, or lease premium instrumentals directly from the internal Stripe marketplace." },
      { id: 2, title: "DSP FORENSICS", desc: "The pipeline automatically extracts the exact mathematical foundation of the beat—BPM, Musical Key (e.g., C# Minor), and Total Bar Count—to feed the Ghostwriter's blueprint." }
    ],
    encouragement: "The entry point of the Matrix. Precision starts at the source. If the math is wrong here, the Hit Score suffers later."
  },
  "02": {
    title: "Neural Mind-Meld",
    icon: <Cpu size={28} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "VOCAL DSP EXTRACTION", desc: "Hit the mic and record a 10-second mumble cadence. The Matrix automatically analyzes your transients, crosses them with the BPM, and detects your exact flow architecture (e.g., NY Drill, Boom Bap, Triplet)." },
      { id: 2, title: "LYRICAL DNA PARSING", desc: "Paste previous verses to calculate syllable density and word frequency. This extracted DNA acts as a permanent anchor, guaranteeing the Ghostwriter mirrors your exact penmanship without breaking the vibe." }
    ],
    encouragement: "Instead of forcing you into a rigid box, we extract your exact rhythm to create the ultimate GetNice Hybrid Flow."
  },
  "03": {
    title: "Synthetic Synthesis",
    icon: <Target size={28} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "GETNICE HYBRID SYNTHESIS", desc: "Powered by fine-tuned LoRA on RunPod GPUs, the engine generates complex multi-syllabic rhyme schemes and inserts mid-bar pipes (|) to dictate physical breath control in the booth." },
      { id: 2, title: "STATELESS RAG INTELLIGENCE", desc: "Injects live daily news and street slang directly into the LLM context so lyrics are chronologically relevant to the hour. Use Micro-Refinement to rewrite lines without breaking the rhyme scheme." }
    ],
    encouragement: "The TALON engine does not write polite poetry. It writes aggressive, authentic commercial warfare."
  },
  "04": {
    title: "Zero-Latency Tracking",
    icon: <Activity size={28} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "ZERO-LATENCY RECORDING", desc: "Bypasses standard web latency using WebAssembly and AudioWorklets. We apply a 150ms mathematical offset to guarantee vocal punch-ins are perfectly quantized to the beat." },
      { id: 2, title: "TELEPROMPTER SYNC", desc: "Generated lyrics scroll perfectly in time with the beat's BPM, acting as a live, mathematically synced karaoke prompter for your Lead, Adlib, and Dub vocal tracks." }
    ],
    encouragement: "A hardware-accelerated, browser-based DAW. Lay down the source data and let the Matrix fix the latency."
  },
  "05": {
    title: "Proprietary Mix Rack",
    icon: <ShieldAlert size={28} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "PROPRIETARY BLUEPRINTS", desc: "Apply CEO-crafted EQ curves mathematically customized for your exact sub-genre (Foundation, Gangsta, Modern, Fusion) utilizing the Web Audio API." },
      { id: 2, title: "THE GETNICE GLUE", desc: "Auto-calculates bus compressor ratios, attacks, and releases to dynamically sit your vocal directly inside the pocket of the beat. Bakes the final chain losslessly using Offline AudioContext." }
    ],
    encouragement: "The magic of the GetNice sound. Glue your raw performance to the beat in real-time, directly in the browser."
  },
  "06": {
    title: "Commercial Render Engine",
    icon: <Zap size={28} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "ANALOG LUFS METERING", desc: "Visual targeting to hit the perfect -14 LUFS (Spotify standard) or -6 LUFS (Brickwall club standard) using an integrated dynamics compressor to protect against digital bleed." },
      { id: 2, title: "STUDIO ARTIFACT EXPORT", desc: "Session Locking permanently secures the project upon export. Generates a complete .ZIP file containing the Lossless WAV Final Master, Instrumental, Raw Stems, and an Official PDF Lyric Sheet." }
    ],
    encouragement: "This is the final firewall. We sum the beat and engineered vocals, limit the peaks, and securely write all metadata."
  },
  "07": {
    title: "Algorithmic A&R Node",
    icon: <TrendingUp size={28} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "HIT SCORE CALCULATION", desc: "Scans the track's sonic profile to generate an algorithmic score out of 100 based on the 3 Codes: The Hook (CTR), Audio Pacing (AVP), and The Addiction (APV)." },
      { id: 2, title: "VIRAL EXTRACTION & ART", desc: "Automatically isolates the most catchy 15-second lyric snippet for TikTok/Reels marketing, and utilizes DALL-E 3 to generate a 3000x3000px Spotify-compliant album cover." }
    ],
    encouragement: "The bridge to the industry. Instead of just exporting audio, your master is uploaded and scanned for commercial viability."
  },
  "08": {
    title: "The Royalty Ledger",
    icon: <ShieldAlert size={28} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "ALGORITHMIC LABEL ADVANCES", desc: "Artifacts achieving a Hit Score > 90 trigger an automated $1,500 marketing advance Upstream Contract (zero-recoupment) to deploy via programmatic ad-spend." },
      { id: 2, title: "FIAT LIQUIDITY", desc: "Access your encrypted Vault history. Withdraw your cleared 60% royalty fiat balance directly to your personal bank account via our secure Stripe Connect integration." }
    ],
    encouragement: "Your financial headquarters. Own your data, secure your master splits, and capitalize on algorithmic deals."
  },
  "09": {
    title: "Live Global Syndication",
    icon: <Activity size={28} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "ALGORITHMIC CHARTING", desc: "GetNice Nation FM is a 24/7 broadcast. Tracks are strictly ordered by their A&R Hit Score, with Top 3 badges awarded to the highest-performing records on the platform." },
      { id: 2, title: "GLOBAL PLAYBACK", desc: "Clicking play seamlessly hijacks the persistent global audio player at the bottom of the screen. Utilize the Live Syndicate Chat to network and exchange feedback." }
    ],
    encouragement: "Dominate the frequencies. Approved tracks are pushed here for the entire community to hear."
  },
  "10": {
    title: "Open Verse Economy",
    icon: <Zap size={28} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "MOGUL LEADERBOARD", desc: "The B2B Artist Network. Tracks top-tier users globally based on platform activity, hit scores, and successful waitlist referrals." },
      { id: 2, title: "SMART ESCROW CONTRACTS", desc: "Lock funds securely via Stripe to request a feature verse or live booking. Funds are held in Escrow and only released when the collaborator delivers the verified audio." }
    ],
    encouragement: "Expand the network. Secure programmatic fiat escrows guarantee safe data exchange and eliminate fraudulent features."
  },
  "11": {
    title: "The Exec: Campaign Hub",
    icon: <Terminal size={28} className="text-[#E60000]" />,
    directives: [
      { id: 1, title: "30-DAY MAXIMUM SUCCESS", desc: "The Exec AI ingests your Artifact and maps out a strict 3-Phase rollout: Infrastructure Validation, Content Saturation (Strike), and Commercial Extraction." },
      { id: 2, title: "AGENTIC DEPLOYMENT", desc: "The terminal executes real API calls to deploy your $1,500 marketing advance on Meta Ads, push viral clips to social networks, and blast Fan CRM emails." }
    ],
    encouragement: "You are selling pickaxes during the gold rush. Let the machine execute the marketing while you scale the brand."
  }
};

export default function RoomDirectives({ roomId }: { roomId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFlashing, setIsFlashing] = useState(true);
  const [mounted, setMounted] = useState(false);
  const data = ROOM_MAP[roomId];
  
  // Triggers the 15-second light pulse every time the user enters a new room
  useEffect(() => {
    setMounted(true); // Ensures document.body is available for the Portal
    setIsFlashing(true);
    const timer = setTimeout(() => setIsFlashing(false), 15000);
    return () => clearTimeout(timer);
  }, [roomId]);

  if (!data) return null;

  // React Portal injects the modal directly into the <body>, breaking it out of all z-index traps
  const modalContent = isOpen && mounted ? createPortal(
    <div className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200">
      <div className="bg-[#050505] border-2 border-[#E60000] w-full max-w-4xl p-8 md:p-12 shadow-[0_0_80px_rgba(230,0,0,0.5)] relative animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col rounded-sm">
        
        {/* CLOSE BUTTON */}
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute top-6 right-6 text-[#888] hover:text-white transition-colors p-2 bg-[#111] border border-[#333] rounded-full hover:bg-[#E60000] hover:border-[#E60000] shadow-md"
        >
          <X size={24} />
        </button>

        {/* MODAL HEADER */}
        <div className="flex items-center gap-5 mb-10 border-b border-[#E60000]/40 pb-8 shrink-0 pr-12">
          <div className="p-4 bg-[#110000] border-2 border-[#E60000]/40 text-[#E60000] rounded-sm shadow-[0_0_20px_rgba(230,0,0,0.2)]">
            {data.icon}
          </div>
          <div>
            <p className="text-xs text-[#E60000] font-bold uppercase tracking-widest animate-pulse mb-1 drop-shadow-md">
              System Directives // Node R{roomId}
            </p>
            <h3 className="text-white text-3xl md:text-5xl font-bold uppercase tracking-widest underline underline-offset-8 decoration-[#E60000] drop-shadow-lg">
              {data.title}
            </h3>
          </div>
        </div>
        
        {/* SCROLLABLE CONTENT */}
        <div className="overflow-y-auto custom-scrollbar flex-1 pr-4 space-y-6">
          {data.directives.map((d) => (
            <div key={d.id} className="flex items-start gap-5 p-8 bg-[#0a0a0a] border border-[#222] hover:border-[#E60000]/70 transition-colors group shadow-lg">
              <span className="text-[#E60000] font-black text-4xl mt-0 drop-shadow-md">{d.id}.</span>
              <div>
                <p className="text-white text-xl md:text-2xl font-bold uppercase tracking-widest mb-3 underline underline-offset-4 decoration-[#444] group-hover:decoration-[#E60000] transition-colors drop-shadow-sm">
                  {d.title}
                </p>
                <p className="text-white text-base md:text-lg leading-relaxed tracking-wide font-mono opacity-90 group-hover:opacity-100 transition-opacity">
                  {d.desc}
                </p>
              </div>
            </div>
          ))}

          <div className="mt-10 p-8 border-2 border-[#330000] bg-[#110000] shadow-[inset_0_0_30px_rgba(230,0,0,0.1)]">
            <p className="text-base md:text-lg text-white leading-relaxed font-mono drop-shadow-sm">
              <span className="text-[#E60000] font-bold uppercase tracking-widest block mb-2 underline underline-offset-4 decoration-[#E60000]">OPERATOR NOTE:</span> 
              {data.encouragement}
            </p>
          </div>
        </div>

      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {/* FLOATING HOLOGRAPHIC BUTTON */}
      <button 
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-28 right-6 md:right-10 z-[50] w-20 h-20 flex items-center justify-center rounded-full transition-all hover:scale-110 focus:outline-none group ${isFlashing ? 'animate-pulse' : 'opacity-90 hover:opacity-100'}`}
        title="View Room Directives"
      >
        {/* 90% Transparent Background */}
        <div className="absolute inset-0 bg-black/10 backdrop-blur-sm rounded-full border border-yellow-500/20"></div>

        {/* Rotating Circular Text */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full animate-[spin_12s_linear_infinite] drop-shadow-[0_0_15px_rgba(234,179,8,0.9)]">
          <path id="textCircle" d="M 50, 50 m -35, 0 a 35,35 0 1, 1 70, 0 a 35,35 0 1, 1 -70, 0" fill="none" />
          <text className="font-mono text-[10px] font-bold uppercase tracking-widest fill-yellow-400">
            <textPath href="#textCircle" startOffset="0%" textLength="220" lengthAdjust="spacingAndGlyphs">
              • DAW HELPER • SYSTEM GUIDE
            </textPath>
          </text>
        </svg>

        {/* Centered Yellow Icon */}
        <HelpCircle size={28} className="text-yellow-400 relative z-10 drop-shadow-[0_0_15px_rgba(234,179,8,1)] group-hover:text-yellow-300 transition-colors" />
      </button>

      {/* Render the portal output */}
      {modalContent}
    </>
  );
}