import React from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ShieldCheck, Lock } from "lucide-react";
import ProfileClient from "./ProfileClient"; 

// --- SURGICAL FIX: EXPANDED RESERVED SYSTEM KEYWORDS ---
// Added drop, storage, _next, and public to prevent Next.js from mistaking system folders for Artist Profiles!
const RESERVED_NAMES = [
  "studio", "dev-portal", "admin-node", "api", "auth", 
  "login", "signup", "undefined", "null", "favicon.ico", "robots.txt",
  "drop", "storage", "_next", "public", "assets", "images", "terms"
];

// Admin Client securely fetches public info regardless of RLS blocks
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ProfilePageProps {
  params: Promise<{ stageName: string }>;
}

export default async function ArtistProfilePage({ params }: ProfilePageProps) {
  const resolvedParams = await params;
  const decodedName = decodeURIComponent(resolvedParams.stageName);

  // 1. HARD GUARDS
  if (decodedName.toLowerCase() === "undefined") redirect("/");
  if (RESERVED_NAMES.includes(decodedName.toLowerCase())) notFound();

  // 2. PROFILE DATABASE LOOKUP
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decodedName);

  let query = supabaseAdmin.from("profiles").select("*");
  if (isUUID) {
    query = query.eq("id", decodedName);
  } else {
    query = query.ilike("stage_name", decodedName).limit(1);
  }

  const { data: profiles, error: profileErr } = await query;
  const profile = profiles?.[0];

  // 3. REGISTRY ERROR UI (If artist is not found)
  if (!profile || profileErr) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
        <div className="max-w-md border border-[#222] p-12 bg-[#050505] shadow-[0_0_50px_rgba(230,0,0,0.1)]">
          <ShieldCheck size={48} className="mx-auto text-[#E60000] mb-6 opacity-50" />
          <h1 className="font-oswald text-2xl text-white uppercase tracking-widest mb-4">Registry Error</h1>
          <p className="font-mono text-[10px] text-[#555] uppercase leading-relaxed">
            The requested artist alias <span className="text-[#E60000]">"{decodedName}"</span> does not exist in the Bar-Code registry.
          </p>
          <a href="/studio" className="mt-8 inline-block border border-[#333] px-8 py-3 text-[10px] text-white uppercase font-bold hover:bg-white hover:text-black transition-all">
            Return to Matrix
          </a>
        </div>
      </div>
    );
  }

  // 4. FREE TIER RESTRICTION
  if (profile.tier === "Free Loader") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
        <div className="max-w-md border border-[#E60000]/30 p-12 bg-[#110000] shadow-[0_0_50px_rgba(230,0,0,0.2)] rounded-sm">
          <Lock size={48} className="mx-auto text-[#E60000] mb-6" />
          <h1 className="font-oswald text-2xl text-white uppercase tracking-widest mb-4">Node Restricted</h1>
          <p className="font-mono text-[10px] text-[#888] uppercase leading-relaxed">
            The requested alias <span className="text-white font-bold">"{profile.stage_name}"</span> belongs to a Free Loader node. <br/><br/>
            Free tier nodes are strictly invisible to the GetNice Records public registry.
          </p>
          <a href="/studio" className="mt-8 inline-block bg-[#E60000] px-8 py-3 text-[10px] text-white uppercase font-bold tracking-widest hover:bg-red-700 transition-all">
            Return to Matrix
          </a>
        </div>
      </div>
    );
  }

  // 5. SYNC VAULT
  const { data: submissions } = await supabaseAdmin
    .from("submissions")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  // 6. RENDER INTERACTIVE CLIENT UI
  return <ProfileClient initialProfile={profile} submissions={submissions || []} />;
}