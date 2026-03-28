"use client";

import React, { useState } from "react";
import { User, Edit3, Save, X, Activity, Disc3, ShieldCheck, Globe, BarChart2, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useMatrixStore } from "../../store/useMatrixStore";
import Link from "next/link";

export default function ProfileClient({ initialProfile, submissions }: { initialProfile: any, submissions: any[] }) {
  const { userSession } = useMatrixStore();
  const isOwner = userSession?.id === initialProfile.id;

  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState(initialProfile.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatar_url || "");
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState(initialProfile);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ bio, avatar_url: avatarUrl })
      });
      
      if (!res.ok) throw new Error("Update failed");
      
      setProfile({ ...profile, bio, avatar_url: avatarUrl });
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-mono selection:bg-[#E60000]">
      
      {/* HEADER */}
      <div className="border-b border-[#222] bg-black sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/studio" className="text-[#888] hover:text-white uppercase tracking-widest text-xs font-bold transition-colors">
            ← Return to Matrix
          </Link>
          <div className="flex items-center gap-2">
            <Globe className="text-[#E60000]" size={18} />
            <span className="font-oswald text-xl uppercase tracking-[0.2em] font-bold">Public Node</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col lg:flex-row gap-8">
        
        {/* LEFT COL: IDENTITY */}
        <div className="w-full lg:w-1/3 space-y-6">
          <div className="bg-black border border-[#222] p-8 relative overflow-hidden group hover:border-[#E60000]/30 transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-10"><ShieldCheck size={64} className="text-[#E60000]" /></div>
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-32 h-32 bg-[#111] border-2 border-[#333] mb-6 overflow-hidden relative group-hover:border-[#E60000] transition-colors shadow-lg">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={48} className="text-[#555] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                )}
              </div>
              
              <h1 className="font-oswald text-4xl uppercase tracking-widest font-bold text-white mb-2">
                {profile.stage_name}
              </h1>
              <span className={`text-[10px] uppercase font-bold tracking-widest px-3 py-1 border mb-6 ${profile.tier?.includes('Mogul') ? 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30' : 'text-blue-500 bg-blue-500/10 border-blue-500/30'}`}>
                {profile.tier}
              </span>

              <div className="w-full grid grid-cols-2 gap-4 border-t border-[#222] pt-6 mb-6">
                <div>
                  <p className="text-[9px] text-[#555] uppercase tracking-widest mb-1">A&R Score</p>
                  <p className="font-oswald text-2xl text-white">{profile.mogul_score || 0}</p>
                </div>
                <div>
                  <p className="text-[9px] text-[#555] uppercase tracking-widest mb-1">Artifacts</p>
                  <p className="font-oswald text-2xl text-white">{submissions.length}</p>
                </div>
              </div>
            </div>

            <div className="relative z-10 border-t border-[#222] pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-oswald text-sm uppercase text-[#888] tracking-widest">Biometric Data</h3>
                {isOwner && !isEditing && (
                  <button onClick={() => setIsEditing(true)} className="text-[#555] hover:text-[#E60000] transition-colors">
                    <Edit3 size={14} />
                  </button>
                )}
              </div>
              
              {isEditing ? (
                <div className="space-y-4 animate-in fade-in">
                  <div>
                    <label className="text-[9px] text-[#E60000] uppercase tracking-widest block mb-1 font-bold">Avatar Image URL</label>
                    <input 
                      type="text" 
                      value={avatarUrl} 
                      onChange={e => setAvatarUrl(e.target.value)} 
                      className="w-full bg-[#111] border border-[#333] p-3 text-xs text-white outline-none focus:border-[#E60000] transition-colors" 
                      placeholder="https://..." 
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-[#E60000] uppercase tracking-widest block mb-1 font-bold">Node Biography</label>
                    <textarea 
                      value={bio} 
                      onChange={e => setBio(e.target.value)} 
                      className="w-full bg-[#111] border border-[#333] p-3 text-xs text-white outline-none focus:border-[#E60000] h-24 resize-none transition-colors" 
                      placeholder="Enter node history..."
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleSave} disabled={isSaving} className="flex-1 bg-[#E60000] text-white py-3 text-[10px] uppercase font-bold tracking-widest flex justify-center items-center gap-2 hover:bg-red-700 transition-colors">
                      {isSaving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Save
                    </button>
                    <button onClick={() => setIsEditing(false)} disabled={isSaving} className="flex-1 bg-[#111] border border-[#333] text-[#888] py-3 text-[10px] uppercase font-bold tracking-widest hover:text-white flex justify-center items-center gap-2 transition-colors">
                      <X size={14}/> Cancel
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
        </div>

        {/* RIGHT COL: ARTIFACTS */}
        <div className="flex-1 space-y-6">
          <div className="flex items-center gap-3 mb-8 border-b border-[#222] pb-4">
            <Disc3 className="text-[#E60000]" size={24} />
            <h2 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white">Verified Artifacts</h2>
          </div>

          {submissions.length === 0 ? (
            <div className="bg-black border border-dashed border-[#333] p-12 text-center opacity-50">
              <Activity size={48} className="mx-auto text-[#444] mb-4" />
              <p className="font-mono text-xs uppercase tracking-widest text-[#888]">No public artifacts detected on this node.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {submissions.map((sub) => (
                <div key={sub.id} className="bg-black border border-[#222] p-5 group hover:border-[#E60000]/50 transition-colors shadow-lg">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-[#111] border border-[#333] shrink-0 shadow-md">
                        {sub.cover_url ? (
                          <img src={sub.cover_url} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#555]"><Disc3 size={16}/></div>
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <h3 className="font-oswald text-lg text-white uppercase tracking-widest truncate group-hover:text-[#E60000] transition-colors">{sub.title}</h3>
                        <p className="text-[9px] font-mono text-[#555] uppercase mt-1">{new Date(sub.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-[#111] pt-4 mt-2">
                    <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest text-[#888]">
                      <BarChart2 size={12} className="text-[#E60000]" /> Score: <span className="text-white font-bold">{sub.hit_score}</span>
                    </div>
                    {sub.audio_url && (
                      <audio controls src={sub.audio_url} className="h-6 w-32 outline-none grayscale invert opacity-70 hover:opacity-100 transition-opacity" controlsList="nodownload noplaybackrate" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}