"use client";

import React, { useState } from "react";
import { Mic2, Globe, ShieldCheck, Star, Edit2, Save, Loader2, Disc3, Play } from "lucide-react";
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

  // IDENTITY CHECK: Does the browser's active session match the profile being viewed?
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

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save bio");
      }

      setProfile({ ...profile, bio: editBio });
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      alert("Failed to update profile intel.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-mono selection:bg-[#E60000]">
      <div className="h-[45vh] relative overflow-hidden border-b border-[#222]">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-[#050505] z-10" />
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.stage_name} className="w-full h-full object-cover grayscale opacity-50" />
        ) : (
          <div className="w-full h-full bg-[#111] flex items-center justify-center opacity-10">
            <Mic2 size={160} />
          </div>
        )}
        <div className="absolute bottom-16 left-12 z-20">
          <div className="flex items-center gap-4 mb-6">
             <span className="bg-[#E60000] text-white text-[10px] px-4 py-1.5 font-bold uppercase tracking-[0.2em] shadow-lg">
               {profile.tier || "NODE"}
             </span>
             {profile.tier?.includes('Mogul') && <Star size={20} className="text-yellow-500 fill-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]" />}
             {isOwner && (
               <span className="bg-[#111] border border-[#333] text-[#888] text-[9px] px-3 py-1 font-bold uppercase tracking-widest">
                 Your Profile
               </span>
             )}
          </div>
          <h1 className="font-oswald text-6xl md:text-9xl uppercase font-bold tracking-tighter text-white leading-none">
            {profile.stage_name}
          </h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-12 py-20 grid grid-cols-1 lg:grid-cols-3 gap-20">
        
        {/* LEFT COL: INTEL & BIO */}
        <div className="lg:col-span-1 space-y-16">
          <div className="border-l-2 border-[#E60000] pl-8 relative group">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-oswald text-sm uppercase text-[#E60000] tracking-[0.4em] font-bold opacity-50">Node Intel</h3>
              {isOwner && !isEditing && (
                <button onClick={() => setIsEditing(true)} className="text-[10px] font-mono text-[#555] hover:text-white uppercase flex items-center gap-2 transition-opacity">
                  <Edit2 size={10}/> Edit Bio
                </button>
              )}
            </div>
            
            {isEditing ? (
               <div className="space-y-3 animate-in fade-in">
                 <textarea 
                    value={editBio} 
                    onChange={e => setEditBio(e.target.value)} 
                    className="w-full bg-black border border-[#333] p-4 text-xs font-mono text-white outline-none focus:border-[#E60000] resize-none h-32 custom-scrollbar" 
                    placeholder="Enter biometric data / artist bio..." 
                  />
                 <div className="flex gap-2">
                   <button onClick={handleSaveBio} disabled={isSaving} className="bg-[#E60000] text-white px-4 py-3 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-red-700 transition-colors shadow-[0_0_15px_rgba(230,0,0,0.3)]">
                     {isSaving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Save Intel
                   </button>
                   <button onClick={() => setIsEditing(false)} disabled={isSaving} className="bg-[#111] text-[#888] px-4 py-3 text-[10px] font-bold uppercase tracking-widest hover:text-white hover:bg-[#222] transition-colors border border-[#222]">
                     Cancel
                   </button>
                 </div>
               </div>
            ) : (
               <p className="text-sm text-[#AAA] leading-relaxed uppercase tracking-widest italic whitespace-pre-wrap">
                 "{profile.bio || "No biometric data transmitted. Operator is ghosting the matrix."}"
               </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6">
             <div className="bg-[#0a0a0a] border border-[#111] p-8 group hover:border-[#E60000]/30 transition-colors">
                <p className="text-[9px] text-[#555] uppercase mb-2 font-bold tracking-widest">Mogul Score</p>
                <p className="text-5xl font-oswald font-bold text-white group-hover:text-[#E60000] transition-colors">{profile.mogul_score || 0}</p>
             </div>
          </div>
        </div>

        {/* RIGHT COL: VAULT SYNC */}
        <div className="lg:col-span-2">
           <h3 className="font-oswald text-sm uppercase text-[#E60000] tracking-[0.4em] mb-10 font-bold opacity-50">Ledger Submissions</h3>
           
           {submissions.length === 0 ? (
             <div className="border border-dashed border-[#222] py-32 text-center rounded-sm">
                <Globe size={48} className="mx-auto mb-6 text-[#222]" />
                <p className="text-[11px] uppercase tracking-[0.3em] text-[#444] font-bold">No Public Artifacts Synchronized</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 gap-4">
               {submissions.map((sub: any) => (
                  <div key={sub.id} className="bg-[#0a0a0a] border border-[#222] p-6 flex justify-between items-center group hover:border-[#E60000]/50 transition-all">
                     <div className="flex items-center gap-6">
                       <div className="w-14 h-14 bg-black border border-[#333] flex items-center justify-center text-[#E60000] shrink-0">
                         <Disc3 size={24} className="group-hover:animate-spin-slow transition-all" />
                       </div>
                       <div>
                         <h4 className="font-oswald text-xl text-white uppercase tracking-widest mb-1">{sub.title || 'Untitled Artifact'}</h4>
                         <p className="font-mono text-[9px] text-[#555] uppercase tracking-widest">
                           MINTED: {new Date(sub.created_at).toLocaleDateString()} // HIT SCORE: <span className={sub.hit_score >= 85 ? 'text-green-500 font-bold' : 'text-white'}>{sub.hit_score || 0}</span>
                         </p>
                       </div>
                     </div>
                     
                     {/* If audio_url was saved during distribution, allow playback */}
                     {sub.audio_url && (
                       <a href={sub.audio_url} target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-full border border-[#333] flex items-center justify-center text-[#888] hover:text-white hover:bg-[#E60000] hover:border-[#E60000] transition-all shadow-lg shrink-0">
                         <Play size={16} className="ml-1" />
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