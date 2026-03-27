import React from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Mic2, Globe, ShieldCheck, Star } from "lucide-react";

// --- RESERVED SYSTEM KEYWORDS ---
const RESERVED_NAMES = [
  "studio", 
  "dev-portal", 
  "admin-node", 
  "api", 
  "auth", 
  "login", 
  "signup",
  "undefined",
  "null",
  "favicon.ico",
  "robots.txt"
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ProfilePageProps {
  params: Promise<{ stageName: string }>;
}

export default async function ArtistProfilePage({ params }: ProfilePageProps) {
  const resolvedParams = await params;
  const decodedName = decodeURIComponent(resolvedParams.stageName);

  // 1. HARD GUARD: If the alias is "undefined" (broken link), redirect to root
  if (decodedName.toLowerCase() === "undefined") {
    redirect("/");
  }

  // 2. SYSTEM PROTECTION: If the alias is a reserved system path, 
  // we trigger notFound() so this dynamic route stops capturing the request.
  // Static folders like /studio will still take precedence in the Next.js router.
  if (RESERVED_NAMES.includes(decodedName.toLowerCase())) {
    notFound();
  }

  // 3. DATABASE LOOKUP
  // FIX: .eq() is strictly case-sensitive, and .maybeSingle() crashes if there are duplicate stage names.
  // We use a regex to check if it's a UUID, and .ilike() + .limit(1) for robust name lookups.
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decodedName);

  let query = supabase.from("profiles").select("*");

  if (isUUID) {
    query = query.eq("id", decodedName);
  } else {
    query = query.ilike("stage_name", decodedName).limit(1);
  }

  const { data: profiles, error } = await query;
  const profile = profiles?.[0];

  // 4. REGISTRY ERROR UI
  if (!profile || error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
        <div className="max-w-md border border-[#222] p-12 bg-[#050505] shadow-[0_0_50px_rgba(230,0,0,0.1)]">
          <ShieldCheck size={48} className="mx-auto text-[#E60000] mb-6 opacity-50" />
          <h1 className="font-oswald text-2xl text-white uppercase tracking-widest mb-4">Registry Error</h1>
          <p className="font-mono text-[10px] text-[#555] uppercase leading-relaxed">
            The requested artist alias <span className="text-[#E60000]">"{decodedName}"</span> does not exist in the Bar-Code registry.
          </p>
          <a href="/""" className="mt-8 inline-block border border-[#333] px-8 py-3 text-[10px] text-white uppercase font-bold hover:bg-white hover:text-black transition-all">
            Return to Matrix
          </a>
        </div>
      </div>
    );
  }

  // 5. VALID PROFILE RENDER
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
          </div>
          <h1 className="font-oswald text-6xl md:text-9xl uppercase font-bold tracking-tighter text-white leading-none">
            {profile.stage_name}
          </h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-12 py-20 grid grid-cols-1 lg:grid-cols-3 gap-20">
        <div className="lg:col-span-1 space-y-16">
          <div className="border-l-2 border-[#E60000] pl-8">
            <h3 className="font-oswald text-sm uppercase text-[#E60000] tracking-[0.4em] mb-6 font-bold opacity-50">Node Intel</h3>
            <p className="text-sm text-[#AAA] leading-relaxed uppercase tracking-widest italic">
              "{profile.bio || "No biometric data transmitted. Operator is ghosting the matrix."}"
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6">
             <div className="bg-[#0a0a0a] border border-[#111] p-8 group hover:border-[#E60000]/30 transition-colors">
                <p className="text-[9px] text-[#555] uppercase mb-2 font-bold tracking-widest">Mogul Score</p>
                <p className="text-5xl font-oswald font-bold text-white group-hover:text-[#E60000] transition-colors">{profile.mogul_score || 0}</p>
             </div>
          </div>
        </div>
        <div className="lg:col-span-2">
           <h3 className="font-oswald text-sm uppercase text-[#E60000] tracking-[0.4em] mb-10 font-bold opacity-50">Ledger Submissions</h3>
           <div className="border border-dashed border-[#222] py-32 text-center rounded-sm">
              <Globe size={48} className="mx-auto mb-6 text-[#222]" />
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#444] font-bold">No Public Artifacts Synchronized</p>
           </div>
        </div>
      </div>
    </div>
  );
}