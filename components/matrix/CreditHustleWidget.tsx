"use client";

import React, { useState, useEffect } from "react";
import { Copy, CheckCircle2, Share2, Zap } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function CreditHustleWidget() {
  const { userSession, addToast } = useMatrixStore();
  const [copied, setCopied] = useState(false);
  const [referrals, setReferrals] = useState(0);

  useEffect(() => {
    if (userSession?.id) {
      supabase
        .from('profiles')
        .select('total_referrals')
        .eq('id', userSession.id)
        .single()
        .then(({ data }) => {
          if (data) setReferrals(data.total_referrals || 0);
        });
    }
  }, [userSession?.id]);

  const referralLink = typeof window !== 'undefined' ? `${window.location.origin}/?ref=${userSession?.id}` : '';

  const handleCopy = () => {
    const textArea = document.createElement("textarea");
    textArea.value = referralLink;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      if (addToast) addToast("Hustle Link Copied. Go recruit nodes.", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed", err);
    }
    document.body.removeChild(textArea);
  };

  return (
    <div className="bg-[#110000] border border-[#E60000]/30 p-4 mt-4 group hover:border-[#E60000]/60 transition-all shadow-[inset_0_0_15px_rgba(230,0,0,0.05)]">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-oswald text-sm uppercase tracking-widest text-[#E60000] flex items-center gap-2 font-bold">
          <Share2 size={14} /> Credit Hustle
        </h3>
        <span className="bg-black border border-[#330000] px-2 py-1 text-[9px] font-mono text-[#E60000] font-bold flex items-center gap-1 shadow-sm">
          <Zap size={10} /> {referrals} Recruits
        </span>
      </div>
      
      <p className="font-mono text-[9px] text-[#888] uppercase tracking-widest leading-relaxed mb-3">
        Recruit external nodes. Earn <strong className="text-white">5 Free GPU Credits</strong> per successful network onboarding.
      </p>
      
      <div className="flex items-center gap-2 bg-black border border-[#222] p-1.5 shadow-inner">
        <code className="font-mono text-[9px] text-white truncate flex-1 pl-2 opacity-80">
          {referralLink}
        </code>
        <button 
          onClick={handleCopy}
          className="bg-[#E60000] text-white px-3 py-2 text-[9px] font-bold uppercase tracking-widest hover:bg-red-700 transition-colors flex items-center gap-2 shrink-0 shadow-[0_0_10px_rgba(230,0,0,0.2)]"
        >
          {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}