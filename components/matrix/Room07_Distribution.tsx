"use client";

import React, { useState, useEffect } from "react";
import { Send, Loader2, CheckCircle2, BarChart, ArrowRight, ShieldAlert, Image as ImageIcon, Globe, Zap, FileText } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";
import Link from "next/link"; 

export default function Room07_Distribution() {
  // SURGICAL UPDATE: Added anrData and updateAnrData to securely persist the A&R scan globally
  const { 
    setActiveRoom, userSession, generatedLyrics, addToast, audioData, 
    finalMaster, blueprint, flowDNA, anrData, updateAnrData 
  } = useMatrixStore();
  
  const [trackId, setTrackId] = useState<string | null>(null);
  
  // Upsell States
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [execRollout, setExecRollout] = useState<string>("");
  const [isGeneratingRollout, setIsGeneratingRollout] = useState(false);

  // --- RECOVERY LOGIC: FETCH TRACK ID & ROLLOUT ON MOUNT IF ALREADY SUCCESSFUL ---
  useEffect(() => {
    if (anrData.status === 'success' && userSession?.id) {
      const fetchLatest = async () => {
        const { data } = await supabase
          .from('submissions')
          .select('id, exec_rollout')
          .eq('user_id', userSession.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          setTrackId(data.id);
          if (data.exec_rollout) setExecRollout(data.exec_rollout);
        }
      };
      fetchLatest();
    }
  }, [anrData.status, userSession?.id]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      
      // Catch Cover Art
      if (params.get('cover_purchased') === 'true') {
        const generatedCoverUrl = params.get('cover_url');
        window.history.replaceState({}, document.title, window.location.pathname);
        if (generatedCoverUrl) {
          updateAnrData({ coverUrl: generatedCoverUrl, status: "success" });
          if(addToast) addToast("DALL-E 3 Cover Art Generated & Attached.", "success");
        }
      }

      // Catch Exec Rollout
      if (params.get('rollout_purchased') === 'true') {
        const returnedTrackId = params.get('track_id');
        window.history.replaceState({}, document.title, window.location.pathname);
        if (returnedTrackId) {
          setTrackId(returnedTrackId);
          updateAnrData({ status: "success" });
          triggerRolloutGeneration(returnedTrackId);
        }
      }
    }
  }, [userSession, addToast, updateAnrData]);

  const handleAnalyze = async () => {
    if (!anrData.trackTitle.trim()) {
      if (addToast) addToast("A track title is required for distribution.", "error");
      return;
    }
    if (!finalMaster) {
      if (addToast) addToast("No master track found. Complete Room 06 first.", "error");
      return;
    }

    updateAnrData({ status: "analyzing" });

    try {
      const analyzeRes = await fetch('/api/distribution/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: anrData.trackTitle, 
          lyrics: generatedLyrics || "No lyrics provided",
          bpm: audioData?.bpm || 120,
          blueprint: blueprint,
          flowDNA: flowDNA
        })
      });
      
      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(analyzeData.error || "A&R Scan Failed");

      updateAnrData({
        hitScore: analyzeData.hitScore,
        coverUrl: analyzeData.coverUrl,
        tiktokSnippet: analyzeData.tiktokSnippet
      });
      
      handleFinalSubmit(analyzeData);
    } catch (error: any) {
      console.error("A&R Error:", error);
      if (addToast) addToast(error.message, "error");
      updateAnrData({ status: "idle" });
    }
  };

  const handleFinalSubmit = async (aAndRData: any) => {
    updateAnrData({ status: "submitting" });
    try {
      let persistentAudioUrl = finalMaster?.url;

      if (persistentAudioUrl?.startsWith('blob:')) {
        let blobData = (finalMaster as any).blob;
        
        if (!blobData) {
          const r = await fetch(persistentAudioUrl);
          blobData = await r.blob();
        }

        if (!blobData) throw new Error("Audio payload missing from local memory.");

        const safeStageName = (userSession?.stageName || 'UnknownNode').replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `${safeStageName}_${userSession?.id}/COMMERCIAL_MASTER_${Date.now()}.wav`;
        
        const { error: uploadErr } = await supabase.storage
          .from('mastered-audio') 
          .upload(fileName, blobData, { contentType: 'audio/wav', upsert: true });

        if (uploadErr) throw uploadErr;

        const { data: publicData } = supabase.storage.from('mastered-audio').getPublicUrl(fileName);
        persistentAudioUrl = publicData.publicUrl;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch('/api/distribution/submit', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          title: anrData.trackTitle,
          audioUrl: persistentAudioUrl, 
          coverUrl: aAndRData.coverUrl,
          hitScore: aAndRData.hitScore,
          tiktokSnippet: aAndRData.tiktokSnippet
        })
      });

      if (!res.ok) throw new Error("Failed to secure artifact in Ledger.");

      const { data: latestSub } = await supabase
        .from('submissions')
        .select('id')
        .eq('user_id', userSession?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (latestSub) setTrackId(latestSub.id);

      updateAnrData({ status: "success" });
      if (addToast) addToast("Artifact secured. Global Nodes synchronized.", "success");
    } catch (err: any) {
      console.error("Submission Error:", err);
      if (addToast) addToast(err.message, "error");
      updateAnrData({ status: "idle" });
    }
  };

  const handlePurchaseCoverArt = async () => {
    setIsGeneratingCover(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/stripe/cover-art', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ userId: userSession?.id, trackTitle: anrData.trackTitle })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url; 
      else throw new Error(data.error || "Failed to initialize Stripe.");
    } catch (err: any) {
      if (addToast) addToast("Checkout failed: " + err.message, "error");
      setIsGeneratingCover(false);
    }
  };

  const handlePurchaseRollout = async () => {
    if (!trackId) {
      if (addToast) addToast("Submission ID missing. Resubmit track.", "error");
      return;
    }
    setIsGeneratingRollout(true);
    try {
      const res = await fetch('/api/stripe/rollout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userSession?.id, trackTitle: anrData.trackTitle, trackId })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url; 
      else throw new Error(data.error || "Failed to initialize Stripe.");
    } catch (err: any) {
      if (addToast) addToast("Checkout failed: " + err.message, "error");
      setIsGeneratingRollout(false);
    }
  };

  const triggerRolloutGeneration = async (tId: string) => {
    setIsGeneratingRollout(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/distribution/rollout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ trackId: tId })
      });
      const data = await res.json();
      if (data.rollout) {
        setExecRollout(data.rollout);
        if(addToast) addToast("The Exec has deployed your 30-Day Strategy.", "success");
      }
    } catch (err) {
      console.error("Rollout Error:", err);
    } finally {
      setIsGeneratingRollout(false);
    }
  };

  return (
    <div className="h-full flex flex-col justify-center max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className={`bg-[#050505] border p-12 rounded-lg text-center relative overflow-hidden transition-all duration-500
        ${anrData.status === 'success' ? 'border-[#E60000] shadow-[0_0_30px_rgba(230,0,0,0.15)]' : 'border-[#222]'}`}>
        
        {(anrData.status === "analyzing" || anrData.status === "submitting") && (
          <div className="absolute inset-0 bg-[#E60000]/5 animate-pulse pointer-events-none" />
        )}

        <div className="relative z-10 mb-8">
          {anrData.status === "idle" && <Send size={64} className="mx-auto text-[#444]" />}
          {(anrData.status === "analyzing" || anrData.status === "submitting") && <Loader2 size={64} className="mx-auto text-[#E60000] animate-spin" />}
          {anrData.status === "success" && <CheckCircle2 size={64} className="mx-auto text-green-500 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full" />}
        </div>
        
        <h2 className="font-oswald text-4xl uppercase tracking-widest mb-10 font-bold text-white relative z-10">
          R07: Distribution Node
        </h2>
        
        {anrData.status === "idle" && (
          <div className="max-w-md mx-auto space-y-6 relative z-10">
            <div className="text-left">
              <label className="text-[10px] text-[#888] font-mono uppercase tracking-widest font-bold mb-2 block">
                Official Track Title
              </label>
              <input 
                type="text" 
                value={anrData.trackTitle}
                onChange={(e) => updateAnrData({ trackTitle: e.target.value })}
                className="w-full bg-black border border-[#222] p-4 font-mono text-xs uppercase text-white outline-none focus:border-[#E60000] transition-colors" 
                placeholder="E.g., MATRIX INFILTRATION..." 
              />
            </div>
            
            <button 
              onClick={handleAnalyze} 
              disabled={!anrData.trackTitle.trim() || !finalMaster}
              className="w-full bg-[#E60000] disabled:opacity-30 disabled:cursor-not-allowed text-white py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.2)]"
            >
              {!finalMaster ? "Master Required" : "Submit for A&R Review"}
            </button>
            
            <div className="flex items-start gap-3 mt-6 p-4 bg-[#110000] border border-[#330000]">
              <ShieldAlert size={16} className="text-[#E60000] shrink-0 mt-0.5" />
              <p className="text-[9px] text-[#888] uppercase font-mono text-left leading-relaxed">
                By submitting, the AI A&R algorithm will analyze your master and generate social media viral snippets. High Hit Scores unlock algorithmic advances in The Bank.
              </p>
            </div>
          </div>
        )}

        {anrData.status === "analyzing" && (
          <div className="space-y-6 py-10 relative z-10">
            <p className="font-oswald text-2xl text-[#E60000] uppercase tracking-widest font-bold">A&R Neural Scan In Progress...</p>
            <div className="font-mono text-[10px] text-[#888] uppercase tracking-widest space-y-2">
              <p>Extracting sonic features & BPM pockets...</p>
              <p>Analyzing structural hook geometry (CTR)...</p>
              <p>Evaluating cadence rhythm & pattern interrupts (AVP)...</p>
              <p>Isolating TikTok Viral Snippet...</p>
            </div>
          </div>
        )}

        {anrData.status === "submitting" && (
          <div className="space-y-6 py-10 relative z-10">
            <p className="font-oswald text-2xl text-white uppercase tracking-widest font-bold">Securing Artifact...</p>
            <div className="font-mono text-[10px] text-[#888] uppercase tracking-widest">
              Writing metadata to Supabase Ledger...
            </div>
          </div>
        )}

        {anrData.status === "success" && (
          <div className="py-6 animate-in zoom-in relative z-10">
             <h3 className="font-oswald text-3xl uppercase tracking-widest mb-8 text-white">Project Finalized</h3>
             
             {/* ROW 1: Art & Score */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
               <div className="flex flex-col md:flex-row gap-6">
                  <div className="w-full md:w-48 flex flex-col gap-2 shrink-0">
                    <div className="w-full h-48 bg-[#111] border border-[#333] relative overflow-hidden shadow-xl">
                      {anrData.coverUrl ? (
                        <img src={anrData.coverUrl} alt="Cover" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-[#333]">
                          <ImageIcon size={32} className="mb-2" />
                          <span className="font-mono text-[8px] uppercase tracking-widest text-center px-2">No Cover Art</span>
                        </div>
                      )}
                    </div>
                    
                    {!anrData.coverUrl && (
                      <button 
                        onClick={handlePurchaseCoverArt}
                        disabled={isGeneratingCover}
                        className="w-full flex items-center justify-center gap-2 bg-black border border-[#333] text-yellow-500 py-2 text-[9px] font-bold uppercase tracking-widest hover:border-yellow-500 transition-colors disabled:opacity-50"
                      >
                        {isGeneratingCover ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                        AI Cover Art ($2.99)
                      </button>
                    )}
                  </div>
                  <div className="flex-1 bg-black border border-[#222] p-6 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-mono text-[#888] uppercase tracking-widest mb-2 flex items-center gap-2">
                      <BarChart size={14} className="text-[#E60000]" /> A&R Score
                    </span>
                    <div className={`text-6xl font-oswald font-bold tracking-tighter
                      ${anrData.hitScore >= 85 ? 'text-green-500' : anrData.hitScore >= 70 ? 'text-yellow-500' : 'text-[#E60000]'}`}>
                      {anrData.hitScore}
                    </div>
                    <p className="text-[9px] font-mono uppercase mt-2 text-[#555]">
                       {anrData.hitScore >= 85 ? 'Platinum Potential' : anrData.hitScore >= 70 ? 'Gold Standard' : 'Underground Mix'}
                    </p>
                  </div>
               </div>
             </div>

             {/* ROW 2: Viral Intelligence & The Exec Rollout */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
               <div className="bg-[#110000] border border-[#330000] p-6 text-left relative overflow-hidden flex flex-col">
                  <div className="absolute top-0 right-0 p-2 opacity-10"><Zap size={64} className="text-[#E60000]" /></div>
                  <span className="text-[10px] font-mono text-[#E60000] uppercase tracking-[0.3em] font-bold mb-4 block">
                    Viral Intelligence // TikTok Slicer
                  </span>
                  <div className="font-mono text-xs text-gray-300 leading-relaxed italic whitespace-pre-wrap border-l-2 border-[#E60000] pl-4 flex-1">
                    {anrData.tiktokSnippet || "Instrumental artifact. No lyrical snippet isolated."}
                  </div>
                  <p className="mt-4 text-[8px] text-[#555] uppercase tracking-widest font-mono">
                    This selection is algorithmically optimized for 15-second audience retention.
                  </p>
               </div>

               <div className="bg-black border border-[#222] p-6 text-left relative overflow-hidden flex flex-col">
                  <span className="text-[10px] font-mono text-purple-500 uppercase tracking-[0.3em] font-bold mb-4 block">
                    The Exec // 30-Day Marketing Rollout
                  </span>
                  
                  {execRollout ? (
                    <div className="font-mono text-[10px] text-gray-300 leading-relaxed overflow-y-auto h-32 custom-scrollbar pr-2 whitespace-pre-wrap border-l-2 border-purple-500 pl-4 flex-1">
                      {execRollout}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center opacity-70">
                      <FileText size={32} className="mb-2 text-[#555]" />
                      <p className="text-[8px] font-mono uppercase tracking-widest text-[#888] mb-4">No algorithmic strategy attached.</p>
                      <button 
                        onClick={handlePurchaseRollout}
                        disabled={isGeneratingRollout}
                        className="flex items-center justify-center gap-2 bg-[#111] border border-[#333] text-purple-500 px-6 py-3 text-[9px] font-bold uppercase tracking-widest hover:border-purple-500 transition-colors disabled:opacity-50 shadow-lg"
                      >
                        {isGeneratingRollout ? <Loader2 size={12} className="animate-spin" /> : <BarChart size={12} />}
                        Unlock Rollout ($14.99)
                      </button>
                    </div>
                  )}
               </div>
             </div>

             {/* ROW 3: Navigation */}
             <div className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto">
               <button 
                  onClick={() => setActiveRoom("08")}
                  className="flex-1 flex justify-center items-center gap-3 bg-white text-black py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                >
                  Proceed to Bank <ArrowRight size={20} />
                </button>
                <Link 
                  href={`/${encodeURIComponent(userSession?.stageName || userSession?.id || "Artist")}`}
                  className="flex-1 flex items-center justify-center gap-3 border border-[#333] bg-black text-[#888] py-4 font-oswald text-sm font-bold uppercase tracking-widest hover:text-white hover:border-white transition-all"
                >
                  View on My Profile <Globe size={16} />
                </Link>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}