import React from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Mic2, Trophy, Users, Globe, ExternalLink, ShieldCheck, Star } from "lucide-react";

// --- RESERVED SYSTEM KEYWORDS ---
// This prevents the dynamic route from trying to "lookup" system pages as artists
const RESERVED_NAMES = ["studio", "dev-portal", "admin-node", "api", "auth", "login", "signup"];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ProfilePageProps {
  params: { stageName: string };
}

export default async function ArtistProfilePage({ params }: ProfilePageProps) {
  const decodedName = decodeURIComponent(params.stageName);

  // 1. HARD GUARD: If the alias is a reserved system route, abort profile lookup
  if (RESERVED_NAMES.includes(decodedName.toLowerCase())) {
    // Returning null or redirecting ensures the actual folder-based route (app/studio/page.tsx) handles it
    return null; 
  }

  // 2. REAL DATABASE LOOKUP
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("stage_name", decodedName)
    .maybeSingle();

  // 3. Fallback to 404 if user really doesn't exist
  if (!profile || error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
        <div className="max-w-md border border-[#222] p-12 bg-[#050505]">
          <ShieldCheck size={48} className="mx-auto text-[#E60000] mb-6 opacity-50" />
          <h1 className="font-oswald text-2xl text-white uppercase tracking-widest mb-4">Registry Error</h1>
          <p className="font-mono text-[10px] text-[#555] uppercase leading-relaxed">
            The requested artist alias <span className="text-[#E60000]">"{decodedName}"</span> does not exist in the Bar-Code registry.
          </p>
          <a href="/" className="mt-8 inline-block border border-[#333] px-6 py-2 text-[10px] text-white uppercase font-bold hover:bg-white hover:text-black transition-all">
            Return to Matrix
          </a>
        </div>
      </div>
    );
  }

  // 4. RENDER VALID PROFILE
  return (
    <div className="min-h-screen bg-[#050505] text-white font-mono selection:bg-[#E60000]">
      {/* Profile Header */}
      <div className="h-[40vh] relative overflow-hidden border-b border-[#222]">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black z-10" />
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.stage_name} className="w-full h-full object-cover grayscale opacity-40" />
        ) : (
          <div className="w-full h-full bg-[#111] flex items-center justify-center opacity-20">
            <Mic2 size={120} />
          </div>
        )}
        
        <div className="absolute bottom-12 left-12 z-20">
          <div className="flex items-center gap-4 mb-4">
             <span className="bg-[#E60000] text-white text-[10px] px-3 py-1 font-bold uppercase tracking-widest">
               {profile.tier || "NODE"}
             </span>
             {profile.tier === 'The Mogul' && <Star size={16} className="text-yellow-500 fill-yellow-500" />}
          </div>
          <h1 className="font-oswald text-6xl md:text-8xl uppercase font-bold tracking-tighter text-white">
            {profile.stage_name}
          </h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-12 py-16 grid grid-cols-1 lg:grid-cols-3 gap-16">
        
        {/* Left: Bio & Stats */}
        <div className="lg:col-span-1 space-y-12">
          <div>
            <h3 className="font-oswald text-sm uppercase text-[#E60000] tracking-[0.3em] mb-6 font-bold">Node Intel</h3>
            <p className="text-xs text-[#888] leading-relaxed uppercase tracking-widest italic">
              "{profile.bio || "No biometric data transmitted."}"
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="bg-black border border-[#111] p-6">
                <p className="text-[8px] text-[#555] uppercase mb-1">Mogul Score</p>
                <p className="text-3xl font-oswald font-bold text-white">{profile.mogul_score || 0}</p>
             </div>
             <div className="bg-black border border-[#111] p-6">
                <p className="text-[8px] text-[#555] uppercase mb-1">Total Referrals</p>
                <p className="text-3xl font-oswald font-bold text-white">{profile.total_referrals || 0}</p>
             </div>
          </div>
        </div>

        {/* Right: Activity / Artifacts placeholder */}
        <div className="lg:col-span-2">
           <h3 className="font-oswald text-sm uppercase text-[#E60000] tracking-[0.3em] mb-8 font-bold">Ledger Submissions</h3>
           <div className="border border-dashed border-[#222] p-20 text-center opacity-20">
              <Globe size={40} className="mx-auto mb-4" />
              <p className="text-[10px] uppercase tracking-widest">No Public Artifacts Synchronized</p>
           </div>
        </div>

      </div>
    </div>
  );
}