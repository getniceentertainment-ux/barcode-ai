import React from "react";
import Link from "next/link";
import { ChevronLeft, ShieldAlert, Zap } from "lucide-react";

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-mono selection:bg-[#E60000] pb-32">
      
      <div className="w-full bg-black border-b border-[#222] sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-8 h-20 flex items-center justify-between">
          <Link href="/" className="text-[#888] hover:text-white flex items-center gap-2 text-xs uppercase tracking-widest transition-colors group">
             <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Return to Matrix
          </Link>
          <div className="flex items-center gap-2">
             <Zap className="text-[#E60000]" size={16} />
             <span className="font-oswald text-lg uppercase tracking-[0.2em] font-bold">BAR-CODE.AI</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 pt-16 animate-in fade-in duration-700">
        <ShieldAlert size={48} className="text-[#E60000] mb-8" />
        <h1 className="font-oswald text-5xl md:text-7xl uppercase tracking-tighter font-bold text-white mb-6">Terms & Conditions</h1>
        <p className="text-xs text-[#555] uppercase tracking-widest mb-12 border-l-2 border-[#E60000] pl-4">
          Last Updated: March 2026 // GetNice Entertainment LLC
        </p>

        <div className="space-y-12 text-gray-300 text-sm leading-loose">
          
          <section>
            <h2 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing and using Bar-Code.ai ("The Platform", "Matrix", or "Service"), operated by GetNice Entertainment LLC, you accept and agree to be bound by the terms and provision of this agreement. Furthermore, when using these particular services, you shall be subject to any posted guidelines or rules applicable to such services.
            </p>
          </section>

          <section>
            <h2 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-4">2. Intellectual Property & AI Generations</h2>
            <p>
              The Artist retains 100% ownership of their vocal performances and any underlying instrumental compositions they upload, provided they have legally acquired the rights to said compositions. 
              Lyrics synthesized by the TALON AI engine are provided to the Artist on a royalty-free, commercial-use license. GetNice Records claims no publishing ownership over AI-generated lyrics unless an Upstream Deal is executed.
            </p>
          </section>

          <section>
            <h2 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-4">3. Beat Leases & Clearances</h2>
            <p>
              The Artist explicitly warrants that any instrumental audio uploaded to Room 01 (The Lab) is either originally composed by the Artist or legally leased with appropriate commercial rights from the original producer. GetNice Entertainment LLC bears zero liability for copyright infringement resulting from uncleared instrumental uploads.
            </p>
          </section>

          <section>
            <h2 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-4">4. Token Economics & Purchases</h2>
            <p>
              All purchases of Credits (CRD), Engineering Tokens, and Mastering Tokens are strictly non-refundable. Tokens represent computational server time on our neural network GPUs. Once a Token is consumed by the audio engine, the transaction is final.
            </p>
          </section>

          <section>
            <h2 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-4">5. Escrow & Social Syndicate (Room 10)</h2>
            <p>
              Funds processed through the Room 10 Escrow system are held securely by our financial partner (Stripe). Funds are locked upon contract initiation. If a booked artist fails to deliver the requested verse or performance within 14 days, the buyer may initiate a dispute for a full refund. Completed and verified deliveries are non-refundable.
            </p>
          </section>

          <section>
            <h2 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-4">6. The Upstream Deal (Room 08)</h2>
            <p>
              If an Artist's Artifact achieves a Hit Score of 90+ and the Artist elects to sign the algorithmic "Upstream Deal," they mathematically agree to transfer a 40% master ownership stake of that specific track to GetNice Records for a term of 5 years. In exchange, the Artist receives $1,500 in non-withdrawable, in-ecosystem marketing credits.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}