"use client";

import React, { useEffect, useState } from "react";
import { Radio, Play, Pause, BarChart2, Users, Disc3, Trophy, Flame } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

interface ApprovedTrack {
  id: string;
  title: string;
  audio_url: string;
  hit_score: number;
  user_id: string;
  created_at: string;
}

// SEED TRACKS: Fills the radio if the database is empty
const SEED_TRACKS: ApprovedTrack[] = [
  { id: "seed_1", title: "NEON BLOOD (MASTER)", audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", hit_score: 98, user_id: "GETNICE_ADM", created_at: new Date().toISOString() },
  { id: "seed_2", title: "GHOST PROTOCOL", audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", hit_score: 95, user_id: "SYSTEM_NODE", created_at: new Date().toISOString() },
  { id: "seed_3", title: "SILICON SOUL", audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", hit_score: 91, user_id: "AURA_SYNTH", created_at: new Date().toISOString() },
];

export default function Room09_Radio() {
  const { radioTrack, setRadioTrack, setPlaybackMode, playbackMode } = useMatrixStore();
  const [tracks, setTracks] = useState<ApprovedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchGlobalRadio();
  }, []);

  const fetchGlobalRadio = async () => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('status', 'approved')
        .order('hit_score', { ascending: false });

      if (error) throw error;
      
      // AUTO-SEED: Use the database tracks, but fallback to seeds if empty!
      const finalTracks = (data && data.length > 0) ? data : SEED_TRACKS;
      setTracks(finalTracks);
      
    } catch (err) {
      console.error("Failed to load Radio:", err);
      setTracks(SEED_TRACKS); // Ultimate fallback
    } finally {
      setIsLoading(false);
    }
  };

  const playRadioTrack = (track: ApprovedTrack) => {
    // THE FIX: Uses the dedicated radio state, leaving the user's Room 01 DSP session 100% safe!
    setRadioTrack({ url: track.audio_url, title: track.title, artist: track.user_id.substring(0,8), score: track.hit_score });
    setPlaybackMode('radio');
    
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('matrix-global-seek', { detail: 0 }));
      window.dispatchEvent(new Event('matrix-global-play'));
    }, 100);
  };

  return (
    <div className="h-full flex flex-col max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-end justify-between border-b border-[#222] pb-6 mb-8">
        <div>
          <h2 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white flex items-center gap-4">
            <Radio size={36} className="text-[#E60000]" /> Global Radio
          </h2>
          <p className="font-mono text-[10px] text-[#555] uppercase mt-2 tracking-widest">
            Live Syndication // A&R Approved Master Tracks
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 text-green-500 font-mono text-[10px] uppercase tracking-widest mb-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> Broadcast Active
          </div>
          <div className="font-oswald text-xl text-white tracking-widest">{tracks.length} Tracks Online</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 pb-12">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 opacity-50">
            <Disc3 size={48} className="text-[#E60000] animate-spin mb-4" />
            <p className="font-mono text-[10px] uppercase tracking-widest">Tuning Frequencies...</p>
          </div>
        ) : tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border border-dashed border-[#222] bg-[#050505]">
            <Radio size={48} className="text-[#333] mb-4" />
            <p className="font-oswald text-xl uppercase tracking-widest text-[#555]">Dead Air</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#444] mt-2">No tracks have passed A&R review yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tracks.map((track, index) => {
              const isPlaying = playbackMode === 'radio' && radioTrack?.url === track.audio_url;
              const isHeavyRotation = track.hit_score >= 95;

              return (
                <div 
                  key={track.id} 
                  className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 border transition-all duration-300 group
                    ${isPlaying ? 'bg-[#110000] border-[#E60000]' : isHeavyRotation ? 'bg-[#0a0000] border-[#330000] hover:border-[#E60000]' : 'bg-black border-[#222] hover:border-[#555]'}`}
                >
                  <div className="flex items-center gap-6 w-full md:w-auto">
                    <div className={`font-oswald text-2xl font-bold w-8 text-center ${isHeavyRotation ? 'text-[#E60000]' : 'text-[#333]'}`}>{index + 1}</div>
                    
                    <button 
                      onClick={() => playRadioTrack(track)}
                      className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center transition-all ${
                        isPlaying ? 'bg-[#E60000] text-white shadow-[0_0_15px_rgba(230,0,0,0.4)] animate-pulse' : 'bg-[#111] text-white hover:bg-white hover:text-black'
                      }`}
                    >
                      {isPlaying ? <Disc3 size={20} className="animate-spin" /> : <Play size={20} className="ml-1" />}
                    </button>
                    
                    <div className="overflow-hidden">
                      <h3 className={`font-oswald text-xl uppercase tracking-widest font-bold truncate ${isPlaying || isHeavyRotation ? 'text-[#E60000]' : 'text-white'}`}>
                        {track.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 font-mono text-[9px] text-[#666] uppercase tracking-widest">
                        <span>ID: {track.user_id.substring(0, 6)}</span><span>•</span><span>{new Date(track.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 mt-4 md:mt-0 w-full md:w-auto justify-end border-t md:border-t-0 border-[#222] pt-4 md:pt-0">
                    {isHeavyRotation && (
                      <div className="flex items-center gap-1 text-[#E60000] font-mono text-[9px] uppercase tracking-widest px-2 py-1 bg-red-900/10 border border-red-900/30">
                        <Flame size={10} /> Heavy Rotation
                      </div>
                    )}
                    
                    <div className="flex flex-col items-end">
                      <span className="text-[8px] font-mono text-[#555] uppercase tracking-widest mb-1 flex items-center gap-1"><BarChart2 size={10} /> Score</span>
                      <span className={`font-oswald text-xl font-bold ${track.hit_score === 100 ? 'text-yellow-500' : isHeavyRotation ? 'text-[#E60000]' : track.hit_score >= 80 ? 'text-green-500' : 'text-white'}`}>
                        {track.hit_score}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}