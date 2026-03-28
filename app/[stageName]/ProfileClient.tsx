"use client";

import React, { useState } from "react";
import { Mic2, Globe, ShieldCheck, Star, Edit2, Save, Loader2, Disc3, Play, Camera, User, Activity } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

interface ProfileClientProps {
  initialProfile: any;
  submissions: any[];
}

export default function ProfileClient({ initialProfile, submissions }: ProfileClientProps) {
  const { userSession } = useMatrixStore();
  const [profile, setProfile] = useState(initialProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState(profile.bio || "");
  const [isSaving, setIsSaving] = useState(false);
  
  // NEW: Avatar Upload State
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);

  // IDENTITY CHECK
  const isOwner = userSession?.id === profile.id;

  const handleSaveBio = async () => {
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ bio: editBio })
      });

      if (!res.ok) throw new Error("Failed to save bio");

      setProfile({ ...profile, bio: editBio });
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      alert("Failed to update profile intel.");
    } finally {
      setIsSaving(false);
    }
  };

  // NEW: Avatar Upload Logic
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) return;
      setIsUploadingAvatar(true);
      
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${userSession?.id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      // 1. Upload to Supabase 'avatars' bucket
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 3. Save URL to Database via secure API
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ avatar_url: publicUrl })
      });

      if (!res.ok) throw new Error("Database update failed");

      // 4. Update UI instantly
      setAvatarUrl(publicUrl);
    } catch (error: any) {
      console.error("Upload error:", error.message);
      alert("Avatar upload failed. Ensure the 'avatars' bucket exists and is public in Supabase.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Fallback ambient image if they don't have an avatar yet
  const ambientBackground = avatarUrl || "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop";

  return (
    <div className="min-h-screen bg-[#050505] text-white font-mono selection:bg-[#E60000] pb-24">
      
      {/* --- AMBIENT BANNER --- */}
      <div className="h-[40vh] md:h-[50vh] relative overflow-hidden border-b border-[#E60000]/20">
        {/* Blurred ambient background image */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30 grayscale blur-2xl scale-110"
          style={{ backgroundImage: `url(${ambientBackground})` }}
        />
        {/* Digital Grid Texture */}
        <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        {/* Fade to black gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent z-10" />

        {/* AVATAR & NAME OVERLAY */}
        <div className="absolute bottom-0 left-0 w-full px-6 md:px-12 z-20 translate-y-1/3 flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8 text-center md:text-left">
          
          {/* Circular Avatar Module */}
          <div className="relative w-32 h-32 md:w-48 md:h-48 rounded-full border-[6px] border-[#050505] bg-[#111] shadow-[0_0_40px_rgba(230,0,0,0.4)] shrink-0 group overflow-hidden">
             {avatarUrl ? (
               <img src={avatarUrl} alt={profile.stage_name} className="w-full h-full object-cover" />
             ) : (
               <div className="w-full h-full flex items-center justify-center text-[#333]">
                 <User size={64} />
               </div>
             )}

             {/* Hover Upload State (Owner Only) */}
             {isOwner && (
               <label className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-sm">
                 {isUploadingAvatar ? (
                   <Loader2 className="animate-spin text-[#E60000] mb-2" size={28} />
                 ) : (
                   <Camera className="text-white mb-2" size={28} />
                 )}
                 <span className="font-mono text-[9px] text-white uppercase tracking-widest font-bold">
                   {isUploadingAvatar ? "Syncing..." : "Update Node"}
                 </span>
                 <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={isUploadingAvatar} />
               </label>
             )}
          </div>

          {/* Name & Badges */}
          <div className="pb-2 md:pb-12">
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-3 mb-4">
               <span className="bg-[#E60000] text-white text-[10px] px-3 py-1.5 font-bold uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(230,0,0,0.5)]">
                 {profile.tier || "NODE"}
               </span>
               {profile.tier?.includes('Mogul') && (
                 <div className="flex items-center gap-1 text-yellow-500 bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 text-[10px] uppercase font-bold tracking-widest shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                   <Star size={12} className="fill-yellow-500 animate-pulse" /> Verified
                 </div>
               )}
               {isOwner && (
                 <span className="bg-transparent border border-[#333] text-[#888] text-[9px] px-3 py-1 font-bold uppercase tracking-widest">
                   Operator View
                 </span>
               )}
            </div>
            <h1 className="font-oswald text-5xl md:text-7xl lg:text-8xl uppercase font-bold tracking-tighter text-white leading-none drop-shadow-2xl">
              {profile.stage_name}
            </h1>
          </div>
        </div>
      </div>

      {/* --- CONTENT GRID --- */}
      {/* Pushing the top padding down slightly to account for the overlapping avatar */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 pt-32 md:pt-28 pb-20 grid grid-cols-1 lg:grid-cols-3 gap-12 md:gap-20">
        
        {/* LEFT COL: INTEL & STATS */}
        <div className="lg:col-span-1 space-y-12">
          
          {/* Flashy Mogul Score */}
          <div className="relative p-[1px] bg-gradient-to-b from-[#E60000] to-[#E60000]/10 rounded-sm shadow-[0_0_30px_rgba(230,0,0,0.15)] group">
            <div className="bg-[#0a0a0a] p-8 h-full">
               <div className="flex justify-between items-start mb-4">
                 <p className="text-[10px] text-[#888] uppercase font-bold tracking-[0.3em]">Network Resonance</p>
                 <Activity size={16} className="text-[#E60000] animate-pulse" />
               </div>
               <p className="text-6xl font-oswald font-bold text-white tracking-tighter group-hover:text-[#E60000] transition-colors duration-500">
                 {profile.mogul_score || 0}
               </p>
               <p className="text-[9px] font-mono text-[#555] uppercase tracking-widest mt-4 border-t border-[#222] pt-4">
                 Influence metric determined by ecosystem interaction and vault syndication.
               </p>
            </div>
          </div>

          {/* Biometric Lore (Bio) */}
          <div className="bg-[#0a0a0a]/50 border border-[#222] p-8 backdrop-blur-md relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#E60000]/50 to-transparent" />
            
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-oswald text-sm uppercase text-white tracking-[0.4em] font-bold flex items-center gap-2">
                 <span className="w-2 h-2 bg-[#E60000] animate-pulse" /> Node Intel
              </h3>
              {isOwner && !isEditing && (
                <button onClick={() => setIsEditing(true)} className="text-[9px] bg-black border border-[#333] px-3 py-1 font-mono text-[#888] hover:text-white hover:border-white uppercase flex items-center gap-2 transition-all">
                  <Edit2 size={10}/> Override
                </button>
              )}
            </div>
            
            {isEditing ? (
               <div className="space-y-3 animate-in fade-in">
                 <textarea 
                    value={editBio} 
                    onChange={e => setEditBio(e.target.value)} 
                    className="w-full bg-black border border-[#333] p-4 text-xs font-mono text-[#E60000] outline-none focus:border-[#E60000] resize-none h-32 custom-scrollbar shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]" 
                    placeholder="Enter biometric data / artist lore..." 
                  />
                 <div className="flex gap-2">
                   <button onClick={handleSaveBio} disabled={isSaving} className="flex-1 bg-[#E60000] text-white px-4 py-3 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-700 transition-colors shadow-[0_0_15px_rgba(230,0,0,0.3)]">
                     {isSaving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Commit
                   </button>
                   <button onClick={() => setIsEditing(false)} disabled={isSaving} className="bg-transparent text-[#555] px-4 py-3 text-[10px] font-bold uppercase tracking-widest hover:text-white hover:bg-[#111] transition-colors border border-[#222]">
                     Abort
                   </button>
                 </div>
               </div>
            ) : (
               <p className="text-xs text-[#AAA] leading-relaxed uppercase tracking-widest whitespace-pre-wrap font-medium">
                 {profile.bio ? `[ ${profile.bio} ]` : "[ NO BIOMETRIC DATA TRANSMITTED. OPERATOR IS GHOSTING THE MATRIX. ]"}
               </p>
            )}
          </div>
        </div>

        {/* RIGHT COL: VAULT SYNC */}
        <div className="lg:col-span-2">
           <h3 className="font-oswald text-2xl uppercase text-white tracking-[0.2em] mb-8 font-bold flex items-center gap-3">
             <Globe className="text-[#E60000]" size={24} /> Public Ledger Submissions
           </h3>
           
           {submissions.length === 0 ? (
             <div className="border border-dashed border-[#333] bg-[#0a0a0a] py-32 text-center rounded-sm">
                <ShieldCheck size={48} className="mx-auto mb-6 text-[#333]" />
                <p className="text-xs uppercase tracking-[0.3em] text-[#555] font-bold">Vault is Empty</p>
                <p className="text-[9px] uppercase tracking-widest text-[#444] mt-2">No public artifacts have been syndicated by this node.</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 gap-4">
               {submissions.map((sub: any) => (
                  <div key={sub.id} className="bg-[#0a0a0a] border border-[#222] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-[#E60000]/60 hover:bg-[#110000] transition-all relative overflow-hidden">
                     
                     {/* Glow effect on hover */}
                     <div className="absolute inset-0 bg-gradient-to-r from-[#E60000]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                     <div className="flex items-center gap-6 relative z-10">
                       <div className="w-16 h-16 bg-black border border-[#333] flex items-center justify-center text-[#E60000] shrink-0 group-hover:border-[#E60000]/50 transition-colors">
                         <Disc3 size={28} className="group-hover:animate-spin-slow transition-all" />
                       </div>
                       <div>
                         <h4 className="font-oswald text-xl text-white uppercase tracking-widest mb-1 group-hover:text-[#E60000] transition-colors">{sub.title || 'Untitled Artifact'}</h4>
                         <div className="flex flex-wrap items-center gap-3">
                           <p className="font-mono text-[9px] text-[#555] uppercase tracking-widest bg-black px-2 py-1 border border-[#222]">
                             MINTED: {new Date(sub.created_at).toLocaleDateString()}
                           </p>
                           <p className="font-mono text-[9px] text-[#555] uppercase tracking-widest bg-black px-2 py-1 border border-[#222]">
                             HIT SCORE: <span className={sub.hit_score >= 85 ? 'text-green-500 font-bold' : 'text-white'}>{sub.hit_score || 0}</span>
                           </p>
                         </div>
                       </div>
                     </div>
                     
                     {/* Play Button */}
                     {sub.audio_url && (
                       <a href={sub.audio_url} target="_blank" rel="noopener noreferrer" className="relative z-10 w-12 h-12 rounded-full border border-[#444] bg-black flex items-center justify-center text-[#AAA] hover:text-white hover:bg-[#E60000] hover:border-[#E60000] transition-all shadow-lg shrink-0 self-start sm:self-auto group-hover:scale-110">
                         <Play size={18} className="ml-1" />
                       </a>
                     )}
                  </div>
               ))}
             </div>
           )}
        </div>
      </div>
    </div>
  );
}