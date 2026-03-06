"use client";

import React, { useState, useEffect } from 'react';
import { Share2, Copy, CheckCircle2, Users, Coins } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function CreditHustle({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (data) setProfile(data);
    };
    fetchProfile();
  }, [userId]);

  if (!profile) return null;

  // Dynamically build their affiliate link based on whatever domain they are currently on
  const affiliateLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/?ref=${profile.referral_code}` 
    : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(affiliateLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#050505] border border-[#222] p-6 w-full max-w-md animate-in fade-in zoom-in duration-300">
      <div className="flex items-center gap-3 border-b border-[#222] pb-4 mb-4">
        <Users className="text-[#E60000]" size={24} />
        <div>
          <h2 className="font-oswald text-xl uppercase tracking-widest font-bold text-white">The Syndicate</h2>
          <p className="font-mono text-[9px] text-[#555] uppercase tracking-widest">Affiliate Node // Credit Hustle</p>
        </div>
      </div>

      <div className="bg-black border border-[#111] p-4 mb-6">
        <p className="font-mono text-[10px] text-gray-400 uppercase leading-relaxed mb-4">
          Invite producers and artists to the Matrix. <strong className="text-white">They get 10 free generations. You get 10 free generations.</strong> Unlimited stacking.
        </p>

        <label className="text-[9px] text-[#E60000] font-mono uppercase font-bold tracking-widest mb-1 block">Your Unique Uplink</label>
        <div className="flex gap-2">
          <input 
            type="text" 
            readOnly 
            value={affiliateLink}
            className="flex-1 bg-[#111] border border-[#333] p-2 text-[10px] font-mono text-white outline-none"
          />
          <button 
            onClick={copyToClipboard}
            className="bg-[#E60000] text-white px-4 hover:bg-red-700 transition-colors flex items-center justify-center"
          >
            {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#110000] border border-[#E60000]/30 p-4 flex flex-col items-center justify-center">
          <Share2 className="text-[#E60000] mb-2" size={20} />
          <span className="font-oswald text-2xl font-bold text-white">{profile.total_referrals}</span>
          <span className="font-mono text-[9px] text-[#888] uppercase tracking-widest">Network Recruits</span>
        </div>
        <div className="bg-black border border-[#222] p-4 flex flex-col items-center justify-center">
          <Coins className="text-white mb-2" size={20} />
          <span className="font-oswald text-2xl font-bold text-white">{profile.credits}</span>
          <span className="font-mono text-[9px] text-[#888] uppercase tracking-widest">Active Credits</span>
        </div>
      </div>
    </div>
  );
}