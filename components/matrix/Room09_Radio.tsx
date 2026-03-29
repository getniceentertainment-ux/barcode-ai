"use client";

import React, { useEffect, useState } from "react";
import { Radio, Play, Pause, BarChart2, Users, Disc3, Trophy, Flame, Megaphone, Target, Zap, Loader2, ArrowUpRight } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";
import Link from "next/link";

interface ApprovedTrack {
  id: string;
  title: string;
  audio_url: string;
  hit_score: number;
  user_id: string;
  created_at: string;
  stage_name?: string; 
}

// SEED TRACKS: Fills the radio if the database is empty
const SEED_TRACKS: ApprovedTrack[] = [
  { id: "seed_1", title: "NEON BLOOD (MASTER)", audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", hit_score: 98, user_id: "GETNICE_ADM", created_at: new Date().toISOString(), stage_name: "GetNice Admin" },
  { id: "seed_2", title: "GHOST PROTOCOL", audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", hit_score: 95, user_id: "SYSTEM_NODE", created_at: new Date().toISOString(), stage_name: "System Node" },
  { id: "seed_3", title: "SILICON SOUL", audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", hit_score: 91, user_id: "AURA_SYNTH", created_at: new Date().toISOString(), stage_name: "Aura Synth" },
];

export default function Room09_Radio() {
  const { radioTrack, setRadioTrack, setPlaybackMode, playbackMode, userSession, addToast } = useMatrixStore();
  
  // Radio State
  const [tracks, setTracks] = useState<ApprovedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Ad Manager State
  const [userVault, setUserVault] = useState<ApprovedTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");
  const [campaignBudget, setCampaignBudget] = useState<number>(0);
  const [isDeploying, setIsDeploying] = useState(false);

  const availableCredits = (userSession as any)?.marketingCredits || 0;

  useEffect(() => {
    fetchGlobalRadio();
    fetchUserVault();
  }, [userSession]);

  const fetchGlobalRadio = async () => {
    setIsLoading(true);
    try {
      const { data: tracksData, error } = await supabase
        .from('submissions')
        .select('*')
        .gte('hit_score', 85)
        .not('audio_url', 'is', null)
        .order('hit_score', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      if (tracksData && tracksData.length > 0) {
        const userIds = [...new Set(tracksData.map(t => t.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, stage_name')
          .in('id', userIds);
          
        const profileMap: Record<string, string> = {};
        profilesData?.forEach(p => { profileMap[p.id] = p.stage_name; });
        
        const mergedTracks = tracksData.map(t => ({
          ...t,
          stage_name: profileMap[t.user_id] || "Unknown Artist"
        }));
        
        setTracks(mergedTracks);
      } else {
        setTracks(SEED_TRACKS);
      }
    } catch (err) {
      console.error("Failed to load Radio:", err);
      setTracks(SEED_TRACKS);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserVault = async () => {
    if (!userSession?.id) return;
    try {
      const { data } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', userSession.id);
      
      if (data) {
        setUserVault(data);
        if (data.length > 0) setSelectedTrackId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to load user vault:", err);
    }
  };

  const playRadioTrack = (track: ApprovedTrack) => {
    setRadioTrack({ 
      url: track.audio_url, 
      title: track.title, 
      artist: track.stage_name || track.user_id.substring(0,8), 
      score: track.hit_score 
    });
    setPlaybackMode('radio');
    
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('matrix-global-sys-seek', { detail: 0 }));
      window.dispatchEvent(new Event('matrix-global-sys-play'));
    }, 100);
  };

  const handleDeployCampaign = async () => {
    if (!userSession?.id || !selectedTrackId || campaignBudget <= 0) return;
    if (campaignBudget > availableCredits) {
      if (addToast) addToast("Insufficient marketing credits.", "error");
      return;
    }

    setIsDeploying(true);
    try {
      // --- SURGICAL FIX: FAN ACQUISITION MATH ---
      // We calculate realistic Fan conversion. At a $3.33 CAC, $10 = 3 Fans.
      const fansGained = Math.floor(campaignBudget * 0.3);
      const newBalance = availableCredits - campaignBudget;

      // 1. Fetch current fan count to avoid overriding existing fans
      const { data: profileData } = await supabase
        .from('profiles')
        .select('total_fans')
        .eq('id', userSession.id)
        .single();
        
      const currentFans = profileData?.total_fans || 0;

      // 2. Update Profile: Deduct Ad Spend AND Add Cult Fans
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ 
          marketing_credits: newBalance,
          total_fans: currentFans + fansGained 
        })
        .eq('id', userSession.id);

      if (profileErr) throw profileErr;

      const selectedTrack = userVault.find(t => t.id === selectedTrackId);
      await supabase.from('transactions').insert({
        user_id: userSession.id,
        amount: -campaignBudget,
        type: 'AD_CAMPAIGN_SPEND',
        description: `Meta Ads Deploy: Captured ${fansGained} Fans`
      });

      // (We completely removed the hit_score payola boost from the Submissions table)

      useMatrixStore.setState({ 
        userSession: { ...userSession, marketingCredits: newBalance } as any
      });

      if (addToast) addToast(`Meta Ads Deployed. +${fansGained} Cult Fans Captured.`, "success");
      setCampaignBudget(0);
      
    } catch (err: any) {
      if (addToast) addToast(err.message, "error");
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto p-4 lg:p-8 animate-in fade-in duration-500 overflow-hidden">
      
      {/* LEFT PANEL: THE RADIO BROADCAST */}
      <div className="flex-1 flex flex-col border border-[#222] bg-[#050505] overflow-hidden">
        <div className="flex items-end justify-between border-b border-[#222] bg-black p-6">
          <div>
            <h2 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white flex items-center gap-4">
              <Radio size={28} className="text-[#E60000]" /> Global Syndicate
            </h2>
            <p className="font-mono text-[10px] text-[#555] uppercase mt-2 tracking-widest">
              Live Broadcast // A&R Approved Network
            </p>
          </div>
          <div className="text-right hidden sm:block">
            <div className="flex items-center justify-end gap-2 text-green-500 font-mono text-[10px] uppercase tracking-widest mb-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> Active
            </div>
            <div className="font-oswald text-lg text-white tracking-widest">{tracks.length} Nodes</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full opacity-50">
              <Disc3 size={48} className="text-[#E60000] animate-spin mb-4" />
              <p className="font-mono text-[10px] uppercase tracking-widest">Tuning Frequencies...</p>
            </div>
          ) : tracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full border border-dashed border-[#222] bg-black">
              <Radio size={48} className="text-[#333] mb-4" />
              <p className="font-oswald text-xl uppercase tracking-widest text-[#555]">Dead Air</p>
            </div>
          ) : (
            tracks.map((track, index) => {
              const isPlaying = playbackMode === 'radio' && radioTrack?.url === track.audio_url;
              const isHeavyRotation = track.hit_score >= 95;

              return (
                <div 
                  key={track.id} 
                  className={`flex items-center justify-between p-4 border transition-all duration-300 group
                    ${isPlaying ? 'bg-[#110000] border-[#E60000]' : isHeavyRotation ? 'bg-[#0a0000] border-[#330000] hover:border-[#E60000]' : 'bg-black border-[#222] hover:border-[#555]'}`}
                >
                  <div className="flex items-center gap-4 w-full">
                    <div className={`font-oswald text-xl font-bold w-6 text-center ${isHeavyRotation ? 'text-[#E60000]' : 'text-[#333]'}`}>{index + 1}</div>
                    
                    <button 
                      onClick={() => playRadioTrack(track)}
                      className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-all ${
                        isPlaying ? 'bg-[#E60000] text-white shadow-[0_0_15px_rgba(230,0,0,0.4)] animate-pulse' : 'bg-[#111] border border-[#333] text-white hover:bg-white hover:text-black'
                      }`}
                    >
                      {isPlaying ? <Disc3 size={16} className="animate-spin" /> : <Play size={16} className="ml-1" />}
                    </button>
                    
                    <div className="overflow-hidden flex-1">
                      <h3 className={`font-oswald text-lg uppercase tracking-widest font-bold truncate ${isPlaying || isHeavyRotation ? 'text-[#E60000]' : 'text-white'}`}>
                        {track.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 font-mono text-[9px] text-[#666] uppercase tracking-widest">
                        <Link href={`/${encodeURIComponent(track.stage_name || "Artist")}`} className="hover:text-white hover:underline transition-colors z-10 relative cursor-pointer">
                          {track.stage_name || track.user_id.substring(0, 8)}
                        </Link>
                        {isHeavyRotation && <span className="text-[#E60000] flex items-center gap-1"><Flame size={10}/> Priority</span>}
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0 hidden sm:flex">
                      <span className="text-[8px] font-mono text-[#555] uppercase tracking-widest mb-1 flex items-center gap-1"><BarChart2 size={10} /> Score</span>
                      <span className={`font-oswald text-lg font-bold ${isHeavyRotation ? 'text-[#E60000]' : 'text-white'}`}>
                        {track.hit_score}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANEL: AD MANAGER CAMPAIGN BUILDER */}
      {/* RIGHT PANEL: ALGORITHMIC STRIKE MANAGER */}
      <div className="w-full lg:w-[400px] flex flex-col bg-black border border-[#222]">
        <div className="p-6 border-b border-[#222] bg-[#110000]">
           <h3 className="font-oswald text-2xl uppercase tracking-widest text-[#E60000] font-bold flex items-center gap-3">
             <Megaphone size={24} /> Strike Manager
           </h3>
           <p className="font-mono text-[9px] text-gray-400 uppercase tracking-widest mt-2">Deploy Programmatic TikTok/Reels Campaigns</p>
        </div>

        <div className="p-6 flex-1 flex flex-col custom-scrollbar overflow-y-auto">
           <div className="bg-[#050505] border border-[#330000] p-6 text-center mb-8 shadow-[0_0_20px_rgba(230,0,0,0.1)]">
             <p className="text-[10px] font-mono text-[#888] uppercase tracking-widest font-bold mb-2">Available Marketing Budget</p>
             <p className="font-oswald text-5xl font-bold text-white tracking-widest">
               ${availableCredits.toFixed(2)}
             </p>
           </div>

           {availableCredits <= 0 ? (
             <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 border border-dashed border-[#333] p-8">
               <Target size={40} className="mb-4 text-[#555]" />
               <p className="font-oswald text-lg text-white uppercase tracking-widest">No Active Budgets</p>
               <p className="font-mono text-[9px] text-[#888] uppercase mt-2 leading-relaxed">You must secure an Upstream Deal in Room 08 to unlock programmatic network distribution.</p>
             </div>
           ) : (
             <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-4">
               <div>
                 <label className="text-[10px] font-mono text-[#E60000] uppercase tracking-widest font-bold mb-2 block">1. Select Target Record</label>
                 <select 
                   value={selectedTrackId}
                   onChange={(e) => setSelectedTrackId(e.target.value)}
                   className="w-full bg-[#0a0a0a] border border-[#333] p-4 text-white font-oswald uppercase tracking-widest text-sm outline-none focus:border-[#E60000] transition-colors appearance-none"
                 >
                   <option value="" disabled>-- Choose Track --</option>
                   {userVault.map(t => (
                     <option key={t.id} value={t.id}>{t.title} (Score: {t.hit_score})</option>
                   ))}
                 </select>
               </div>

               <div>
                 <div className="flex justify-between items-center mb-2">
                   <label className="text-[10px] font-mono text-[#E60000] uppercase tracking-widest font-bold">2. Allocate Network Bandwidth</label>
                   <span className="font-oswald text-lg text-white">${campaignBudget.toFixed(2)}</span>
                 </div>
                 <input 
                   type="range" 
                   min="0" 
                   max={availableCredits} 
                   step="10"
                   value={campaignBudget} 
                   onChange={(e) => setCampaignBudget(Number(e.target.value))} 
                   className="w-full accent-[#E60000] h-2 bg-[#222] rounded-full appearance-none cursor-pointer" 
                 />
                 <div className="flex justify-between mt-2 text-[9px] font-mono text-[#555]">
                   <span>$0</span>
                   <span>MAX</span>
                 </div>
               </div>

               <div className="bg-[#111] p-4 border-l-2 border-[#E60000] mt-2">
                 <p className="text-[9px] font-mono text-[#888] uppercase tracking-widest mb-1">Estimated Organic Resonance</p>
                 <div className="flex items-center gap-2 mt-3">
                   <Zap size={14} className="text-[#555]"/>
                   <span className="font-oswald text-xl text-[#888]">{(campaignBudget * 14.5).toLocaleString()}</span>
                   <span className="font-mono text-[10px] text-[#555] uppercase mt-1">Short-Form Views</span>
                 </div>
                 <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#222]">
                   <Users size={14} className="text-[#E60000]"/>
                   <span className="font-oswald text-xl text-white">{Math.floor(campaignBudget * 0.3)}</span>
                   <span className="font-mono text-[10px] text-[#E60000] uppercase mt-1 font-bold">Cult Fans Acquired</span>
                 </div>
               </div>

               <button 
                 onClick={handleDeployCampaign}
                 disabled={isDeploying || campaignBudget <= 0 || !selectedTrackId}
                 className="mt-4 w-full bg-[#E60000] text-white py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(230,0,0,0.2)]"
               >
                 {isDeploying ? <Loader2 size={20} className="animate-spin" /> : <><ArrowUpRight size={20} /> Deploy TikTok/Reels Strike</>}
               </button>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}