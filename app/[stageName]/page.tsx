"use client";

import React, { useEffect, useState, useRef } from "react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";
import { 
  Terminal, ShieldCheck, Activity, Disc3, 
  Play, Pause, Edit3, Save, UploadCloud, Lock, Share2, CheckCircle2
} from "lucide-react";
import Link from "next/link";

interface ProfileData {
  id: string;
  stage_name: string;
  bio: string;
  avatar_url: string | null;
  tier: string;
  mogul_score: number;
  total_referrals: number;
  created_at: string;
}

interface TrackData {
  id: string;
  title: string;
  audio_url: string;
  cover_url: string | null;
  hit_score: number;
  created_at: string;
}

export default function ArtistProfilePage({ params }: { params: { stageName: string } }) {
  const { userSession, addToast } = useMatrixStore();
  const decodedStageName = decodeURIComponent(params.stageName);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [tracks, setTracks] = useState<TrackData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Edit State (Only available to the owner)
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Audio Player State
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Social State
  const [copiedLink, setCopiedLink] = useState(false);

  const isOwner = userSession?.id === profile?.id;

  useEffect(() => {
    fetchProfileData();
  }, [decodedStageName]);

  const fetchProfileData = async () => {
    setIsLoading(true);
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, stage_name, bio, avatar_url, tier, mogul_score, total_referrals, created_at')
        .ilike('stage_name', decodedStageName)
        .limit(1)
        .single();

      if (profileError || !profileData) {
        setProfile(null);
        setIsLoading(false);
        return;
      }
      
      setProfile(profileData);
      setEditBio(profileData.bio || "");

      const { data: trackData, error: trackError } = await supabase
        .from('submissions')
        .select('id, title, audio_url, cover_url, hit_score, created_at')
        .eq('user_id', profileData.id)
        .eq('status', 'approved')
        .order('hit_score', { ascending: false })
        .limit(3);

      if (!trackError && trackData) {
        setTracks(trackData);
      }

    } catch (error) {
      console.error("Profile Fetch Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ bio: editBio })
        .eq('id', profile.id);

      if (error) throw error;
      setProfile({ ...profile, bio: editBio });
      setIsEditing(false);
      if (addToast) addToast("Profile configuration saved.", "success");
    } catch (err: any) {
      if (addToast) addToast("Failed to save profile.", "error");
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (file.size > 5 * 1024 * 1024) {
      if (addToast) addToast("Avatar must be under 5MB.", "error");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${profile.id}/avatar_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const newAvatarUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: newAvatarUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: newAvatarUrl });
      if (addToast) addToast("Avatar securely updated.", "success");
    } catch (err: any) {
      if (addToast) addToast("Avatar upload failed.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const togglePlay = (url: string) => {
    window.dispatchEvent(new Event('matrix-global-sys-pause'));

    if (playingTrack === url) {
      audioRef.current?.pause();
      setPlayingTrack(null);
    } else {
      setPlayingTrack(url);
      setPlaybackProgress(0);
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play();
        }
      }, 50);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setPlaybackProgress(progress || 0);
    }
  };

  const handleShareProfile = () => {
    // Locks the share link to the strict production domain
    const url = `https://bar-code.ai/${encodeURIComponent(decodedStageName)}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-white">
        <Activity size={48} className="text-[#E60000] animate-pulse mb-6" />
        <h2 className="font-oswald text-2xl uppercase tracking-widest font-bold">Locating Global Node...</h2>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-white p-6 text-center">
        <Terminal size={64} className="text-[#333] mb-6" />
        <h2 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white mb-4">Node Not Found</h2>
        <p className="font-mono text-xs text-[#888] uppercase tracking-widest mb-8">
          The requested artist alias "{decodedStageName}" does not exist in the Bar-Code registry.
        </p>
        <Link href="/" className="bg-[#E60000] text-white px-8 py-3 font-oswald text-sm font-bold uppercase tracking-widest hover:bg-red-700 transition-colors">
          Return to Matrix
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020202] text-white selection:bg-[#E60000] font-mono pb-20 relative">
      
      {/* Hidden Audio Player */}
      <audio 
        ref={audioRef} 
        src={playingTrack || ""} 
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => { setPlayingTrack(null); setPlaybackProgress(0); }}
        className="hidden"
      />

      {/* MATRIX GRID BACKGROUND */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#E60000 1px, transparent 1px), linear-gradient(90deg, #E60000 1px, transparent 1px)', backgroundSize: '50px 50px' }} />

      {/* TOP HEADER */}
      <div className="border-b border-[#222] bg-black/80 backdrop-blur-md p-6 flex justify-between items-center sticky top-0 z-50">
        <div>
          <h1 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white flex items-center gap-3">
            <ShieldCheck size={20} className="text-[#E60000]" /> Bar-Code.ai Node Registry
          </h1>
        </div>
        <Link href="/" className="text-[10px] text-[#555] uppercase tracking-widest hover:text-white transition-colors border border-[#333] px-4 py-2 bg-[#111] hover:bg-[#222]">
          Close Profile [X]
        </Link>
      </div>

      <div className="max-w-6xl mx-auto mt-12 px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        
        {/* LEFT COLUMN: IDENT & STATS */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Avatar & Identity Box */}
          <div className="bg-black border border-[#222] p-8 text-center relative overflow-hidden group shadow-2xl">
            <div className="absolute top-0 right-0 bg-[#110000] border-b border-l border-[#330000] text-[#E60000] px-3 py-1 text-[8px] font-bold uppercase tracking-widest z-20">
              Verified Artist
            </div>

            <div className="relative w-48 h-48 mx-auto mb-6">
              <div className="absolute inset-0 border-2 border-[#E60000] rounded-sm transform group-hover:rotate-6 transition-transform duration-500 opacity-50"></div>
              <div className="absolute inset-0 border-2 border-white rounded-sm transform group-hover:-rotate-3 transition-transform duration-500"></div>
              <div className="w-full h-full bg-[#111] overflow-hidden relative z-10">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.stage_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl font-oswald text-[#333]">
                    {profile.stage_name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {isOwner && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity">
                  <input type="file" id="avatarUpload" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  <label htmlFor="avatarUpload" className="cursor-pointer text-[10px] uppercase font-bold text-white flex flex-col items-center gap-2 hover:text-[#E60000]">
                    {isUploading ? <Activity className="animate-pulse" /> : <UploadCloud size={20} />}
                    {isUploading ? "Uploading..." : "Update Image"}
                  </label>
                </div>
              )}
            </div>

            <h2 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white mb-2 glow-red truncate px-2">
              {profile.stage_name}
            </h2>
            <div className="flex justify-center items-center gap-2 border-b border-[#222] pb-6 mb-6">
               <span className="text-[9px] text-[#555] uppercase tracking-widest">Access Level:</span>
               <span className="text-[10px] text-green-500 font-bold uppercase tracking-widest px-2 py-0.5 bg-green-500/10 border border-green-500/30">{profile.tier}</span>
            </div>

            {/* Matrix Stats */}
            <div className="grid grid-cols-2 gap-4 text-left mb-8">
              <div className="bg-[#050505] border border-[#111] p-4 group-hover:border-[#333] transition-colors">
                <span className="text-[8px] text-[#555] uppercase tracking-widest block mb-1">Mogul Score</span>
                <span className="font-oswald text-3xl text-[#E60000] font-bold">{profile.mogul_score}</span>
              </div>
              <div className="bg-[#050505] border border-[#111] p-4 group-hover:border-[#333] transition-colors">
                <span className="text-[8px] text-[#555] uppercase tracking-widest block mb-1">Syndicate Recruits</span>
                <span className="font-oswald text-3xl text-white font-bold">{profile.total_referrals}</span>
              </div>
            </div>

            {/* Production Share Link */}
            <button 
              onClick={handleShareProfile}
              className="w-full bg-[#111] border border-[#333] text-white py-3 font-oswald text-sm font-bold uppercase tracking-widest hover:bg-[#222] hover:border-white transition-colors flex items-center justify-center gap-2"
            >
              {copiedLink ? <CheckCircle2 size={16} className="text-green-500" /> : <Share2 size={16} className="text-[#888]" />} 
              {copiedLink ? "Link Copied" : "Share Profile"}
            </button>

            {/* Guest Action: Connect / Book */}
            {!isOwner && (
              <Link href="/?room=10" className="w-full mt-3 bg-[#E60000] text-white py-4 font-oswald text-sm font-bold uppercase tracking-widest hover:bg-red-700 transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(230,0,0,0.3)]">
                <Lock size={14} /> Request Feature Escrow
              </Link>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: BIO & AUDIO PORTFOLIO */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* ABOUT / BIO SECTION */}
          <div className="bg-black border border-[#222] p-8 relative">
            <div className="flex justify-between items-center border-b border-[#222] pb-4 mb-6">
              <h3 className="font-oswald text-xl uppercase tracking-widest text-white flex items-center gap-2">
                <Terminal size={18} className="text-[#E60000]" /> Intelligence Briefing
              </h3>
              {isOwner && !isEditing && (
                <button onClick={() => setIsEditing(true)} className="text-[10px] text-[#555] hover:text-white uppercase tracking-widest flex items-center gap-1 border border-[#333] px-3 py-1 bg-[#111]">
                  <Edit3 size={12} /> Edit Bio
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4 animate-in fade-in">
                <textarea 
                  value={editBio} 
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full h-32 bg-[#050505] border border-[#333] p-4 text-xs text-gray-300 font-mono outline-none focus:border-[#E60000] resize-none leading-loose"
                  placeholder="Enter your street intelligence bio..."
                />
                <div className="flex justify-end gap-3">
                  <button onClick={() => { setEditBio(profile.bio || ""); setIsEditing(false); }} className="px-6 py-2 border border-[#333] text-[10px] uppercase font-bold text-[#888] hover:text-white hover:bg-[#111] transition-colors">Cancel</button>
                  <button onClick={handleSaveProfile} className="px-8 py-2 bg-[#E60000] text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-red-700 shadow-[0_0_10px_rgba(230,0,0,0.3)]">
                    <Save size={12} /> Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-400 leading-loose whitespace-pre-wrap">
                {profile.bio || <span className="opacity-50 italic">This node has not provided a biographical intelligence briefing.</span>}
              </div>
            )}
          </div>

          {/* TOP ARTIFACTS PLAYER (The MySpace Section) */}
          <div className="bg-black border border-[#222] p-8">
            <h3 className="font-oswald text-xl uppercase tracking-widest text-white flex items-center gap-2 border-b border-[#222] pb-4 mb-6">
              <Disc3 size={18} className="text-green-500" /> Top Authorized Artifacts
            </h3>

            {tracks.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-[#222] bg-[#050505]">
                <Disc3 size={32} className="mx-auto text-[#333] mb-3" />
                <p className="text-[10px] text-[#555] uppercase tracking-widest">No public artifacts detected in the Vault.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tracks.map((track, i) => (
                  <div key={track.id} className={`relative flex items-center gap-6 p-4 border transition-colors group overflow-hidden
                    ${playingTrack === track.audio_url ? 'border-[#E60000] bg-[#110000]' : 'border-[#111] bg-[#050505] hover:border-[#333]'}`}>
                    
                    {/* Live Progress Bar (Background) */}
                    {playingTrack === track.audio_url && (
                      <div 
                        className="absolute top-0 left-0 h-full bg-[#E60000]/10 transition-all duration-100 ease-linear pointer-events-none"
                        style={{ width: `${playbackProgress}%` }}
                      />
                    )}

                    {/* Position / Ranking */}
                    <div className="font-oswald text-2xl font-bold text-[#333] w-8 text-center group-hover:text-[#555] relative z-10">
                      0{i + 1}
                    </div>

                    {/* Cover Art Thumbnail */}
                    <div className="w-14 h-14 bg-black border border-[#222] shrink-0 relative overflow-hidden z-10 shadow-lg">
                      {track.cover_url ? (
                        <img src={track.cover_url} alt="cover" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity group-hover:scale-110 duration-700" />
                      ) : (
                        <Disc3 className="absolute inset-0 m-auto text-[#333]" size={20} />
                      )}
                    </div>

                    {/* Track Info */}
                    <div className="flex-1 overflow-hidden relative z-10">
                      <h4 className={`font-oswald text-lg uppercase tracking-widest font-bold truncate transition-colors ${playingTrack === track.audio_url ? 'text-white glow-red' : 'text-gray-300'}`}>
                        {track.title}
                      </h4>
                      <div className="flex items-center gap-4 mt-1 text-[9px] uppercase tracking-widest font-mono">
                        <span className="text-green-500 font-bold bg-green-500/10 px-1 border border-green-500/20">Score: {track.hit_score}</span>
                        <span className="text-[#555]">|</span>
                        <span className="text-[#555]">{new Date(track.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Audio Equalizer Anim (Only shows when playing) */}
                    {playingTrack === track.audio_url && (
                      <div className="hidden md:flex gap-1 h-4 items-end mr-4 relative z-10">
                          <div className="w-1 bg-[#E60000] animate-[pulse_0.4s_ease-in-out_infinite]" style={{ height: '100%' }}></div>
                          <div className="w-1 bg-[#E60000] animate-[pulse_0.7s_ease-in-out_infinite]" style={{ height: '60%' }}></div>
                          <div className="w-1 bg-[#E60000] animate-[pulse_0.5s_ease-in-out_infinite]" style={{ height: '80%' }}></div>
                      </div>
                    )}

                    {/* Play Button */}
                    <button 
                      onClick={() => togglePlay(track.audio_url)}
                      className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center border transition-all relative z-10
                        ${playingTrack === track.audio_url ? 'bg-[#E60000] border-[#E60000] text-white shadow-[0_0_15px_rgba(230,0,0,0.4)]' : 'bg-black border-[#333] text-[#888] hover:text-white hover:border-white'}`}
                    >
                      {playingTrack === track.audio_url ? <Pause size={18} /> : <Play size={18} className="ml-1" />}
                    </button>

                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}