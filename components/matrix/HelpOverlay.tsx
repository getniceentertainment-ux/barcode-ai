"use client";

import React, { useState } from "react";
import { X, HelpCircle, Terminal, Cpu, Wallet, Handshake, ChevronDown, ChevronUp, Mail } from "lucide-react";

interface HelpOverlayProps {
  onClose: () => void;
}

export default function HelpOverlay({ onClose }: HelpOverlayProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      icon: <Terminal size={18} />,
      question: "How do Credits (CRD) and Tokens work?",
      answer: "Credits (CRD) are used to power the AI engines in Room 02 (Brain Train) and Room 03 (Ghostwriter). Tokens are one-time secure passes used for heavy cloud processing: Engineering ($4.99) and Mastering ($4.99). 'The Mogul' tier has unlimited Credits and Tokens."
    },
    {
      icon: <Cpu size={18} />,
      question: "How does the AI Ghostwriter know my flow?",
      answer: "In Room 02 (Brain Train), you record 10 seconds of mumble flow. Our DSP engine analyzes your syllables-per-second, pauses, and transients to determine your Flow DNA (e.g., NY Drill vs. Chopper). The Ghostwriter then mathematically aligns the generated lyrics to match that exact cadence."
    },
    {
      icon: <Wallet size={18} />,
      question: "What happens if I score a 90+ on the Hit Score?",
      answer: "If your track scores a 90 or above in Room 07 (Distribution), GetNice Records will automatically offer you an Upstream Deal in Room 08 (The Bank). This includes a $1,500 Marketing Advance (for ad-spend) in exchange for a 40% Master stake over 5 years."
    },
    {
      icon: <Handshake size={18} />,
      question: "Is the Room 10 Escrow safe?",
      answer: "Yes. When you book an artist or request a verse, your fiat currency is held securely by Stripe in a locked Escrow account. The funds are only released to the target artist once the audio file is delivered and verified through the Matrix."
    }
  ];

  return (
    <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
      <div className="w-full max-w-3xl bg-[#050505] border border-[#333] shadow-[0_0_50px_rgba(230,0,0,0.15)] flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10">
        
        {/* HEADER */}
        <div className="p-6 border-b border-[#222] flex justify-between items-center bg-black">
          <h2 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white flex items-center gap-3">
            <HelpCircle size={24} className="text-[#E60000]" /> Operator Comm-Link
          </h2>
          <button onClick={onClose} className="text-[#555] hover:text-white transition-colors bg-[#111] p-2 rounded-full border border-[#333]">
            <X size={20} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-6 md:p-10 overflow-y-auto custom-scrollbar flex-1 bg-[#020202]">
          <p className="font-mono text-xs text-[#888] uppercase tracking-widest mb-8 leading-relaxed">
            Welcome to the Bar-Code Matrix. Review the system directives below to understand node operations, token economics, and ledger protocols.
          </p>

          <div className="space-y-4 mb-10">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-black border border-[#222] transition-colors hover:border-[#333]">
                <button 
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full p-5 flex items-center justify-between text-left focus:outline-none"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-[#E60000]">{faq.icon}</div>
                    <span className="font-oswald text-lg uppercase tracking-widest text-white">{faq.question}</span>
                  </div>
                  {openFaq === idx ? <ChevronUp size={18} className="text-[#555]" /> : <ChevronDown size={18} className="text-[#555]" />}
                </button>
                
                {openFaq === idx && (
                  <div className="p-5 pt-0 border-t border-[#111] animate-in slide-in-from-top-2">
                    <p className="font-mono text-xs text-gray-400 leading-loose mt-4 border-l-2 border-[#E60000] pl-4">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* CONTACT SUPPORT */}
          <div className="bg-[#0a0a0a] border border-[#222] p-6 text-center rounded-sm">
             <Mail size={32} className="mx-auto text-[#555] mb-4" />
             <h3 className="font-oswald text-xl uppercase tracking-widest font-bold text-white mb-2">Need Direct Support?</h3>
             <p className="font-mono text-[10px] text-[#888] uppercase tracking-widest mb-6">Open a support ticket with the GetNice admin nodes.</p>
             <a href="mailto:support@bar-code.ai" className="inline-flex items-center gap-2 bg-white text-black px-8 py-3 font-oswald text-sm font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all">
               Email Support
             </a>
          </div>
        </div>

      </div>
    </div>
  );
}