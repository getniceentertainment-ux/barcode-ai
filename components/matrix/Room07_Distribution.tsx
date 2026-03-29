"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  Send, Loader2, CheckCircle2, BarChart, ArrowRight, ShieldAlert, 
  Image as ImageIcon, Globe, Zap, FileText, RefreshCw, Lock, ShieldCheck, Activity, Music 
} from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function Room07_Distribution() {
  const { 
    setActiveRoom, userSession, generatedLyrics, addToast, audioData, 
    finalMaster, blueprint, flowDNA, anrData, updateAnrData 
  } = useMatrixStore();
  
  // SURGICAL FIX: Removed reactive useSearchParams, added static ref guard
  const interceptorFired = useRef(false);

  // --- STATE ---
  const [trackId, setTrackId] = useState<string | null>(null);
  const [submission, setSubmission] = useState<any>(null);
  
  // Upsell & UI States
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [execRollout, setExecRollout] = useState<string>("");
  const [isGeneratingRollout, setIsGeneratingRollout] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>(""); 

  const isFreestyle = !generatedLyrics || generatedLyrics.trim() === "";

  // --- RECOVERY LOGIC: FETCH TRACK ID & ROLLOUT ON MOUNT IF ALREADY SUCCESSFUL ---
  useEffect(() => {
    if (anrData.status === 'success' && userSession?.id) {
      const fetchLatest = async () => {
        const { data } = await supabase
          .from('submissions')
          .select('*')
          .eq('user_id', userSession.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          setSubmission(data);
          setTrackId(data.id);
          if (data.exec_rollout) setExecRollout(data.exec_rollout);
        }
      };
      fetchLatest();
    }
  }, [anrData.status, userSession?.id]);
  
  // --- STRIPE RETURN HANDLER (THE INTERCEPTOR) ---
  useEffect(() => {
    // 1. Guard against server-side rendering and double-fires
    if (typeof window === 'undefined' || interceptorFired.current) return;

    // 2. Use Vanilla JS to bypass Next.js reactive loop wipeouts
    const params = new URLSearchParams(window.location.search);
    const rolloutPurchased = params.get('rollout_purchased');
    const coverArtPurchased = params.get('cover_art_purchased');
    const searchTrackId = params.get('track_id') || params.get('trackId');              
    
    if (!searchTrackId) return;

    if (rolloutPurchased === 'true') {
      interceptorFired.current = true;
      
      // Actively poll the ledger to wait for the Stripe Webhook to flip the deal switch
      setLoadingStep("Awaiting Financial Handshake from Stripe...");
      updateAnrData({ status: "submitting" });
      
      const pollLedger = setInterval(async () => {
        const { data } = await supabase
          .from('submissions')
          .select('upstream_deal_signed')
          .eq('id', searchTrackId)
          .single();

        if (data?.upstream_deal_signed) {
          clearInterval(pollLedger);
          if (addToast) addToast("Upstream Deal Secured. Transferring to The Exec...", "success");
          setActiveRoom("11"); 
        }
      }, 2000);

      // Failsafe timeout after 15 seconds
      setTimeout(() => {
        clearInterval(pollLedger);
        if (addToast) addToast("Ledger sync delayed. Proceeding to Hub...", "info");
        setActiveRoom("11"); 
      }, 15000);
      
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (coverArtPurchased === 'true') {
      interceptorFired.current = true;
      if (addToast) addToast("Payment Secured. Initializing FLUX.1 Engine...", "success");
      
      updateAnrData({ status: "success" });
      triggerCoverArtGeneration(searchTrackId);
      
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []); // <-- Empty dependency array ensures this absolutely never loops

  // --- THE HYBRID INTELLIGENCE PIPELINE ---
  const handleDistributionSequence = async () => {
    if (!anrData.trackTitle.trim()) {
      if (addToast) addToast("A track title is required for distribution.", "error");
      return;
    }
    if (!finalMaster) {
      if (addToast) addToast("No master track found. Complete Room 06 first.", "error");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Security Exception: Missing Session Token.");

      // STEP 1: SECURE AUDIO TO THE VAULT FIRST
      updateAnrData({ status: "submitting" });
      setLoadingStep("Uploading master audio to encrypted vault...");
      
      let persistentAudioUrl = finalMaster?.url;
      let targetBlob: Blob | null = (finalMaster as any).blob || null;

      if (persistentAudioUrl?.startsWith('blob:')) {
        if (!targetBlob) {
          const r = await fetch(persistentAudioUrl);
          targetBlob = await r.blob();
        }
        if (!targetBlob) throw new Error("Audio payload missing from local memory.");

        const safeStageName = (userSession?.stageName || 'UnknownNode').replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `${safeStageName}_${userSession?.id}/COMMERCIAL_MASTER_${Date.now()}.wav`;
        
        const { error: uploadErr } = await supabase.storage
          .from('mastered-audio') 
          .upload(fileName, targetBlob, { contentType: 'audio/wav', upsert: true });

        if (uploadErr) throw uploadErr;

        const { data: publicData } = supabase.storage.from('mastered-audio').getPublicUrl(fileName);
        persistentAudioUrl = publicData.publicUrl;
      }

      // STEP 1.5: FORENSIC TRANSCRIPTION (If Freestyle Detected)
      let lyricsForScan = generatedLyrics || "No lyrics provided";

      if (isFreestyle && targetBlob) {
         setLoadingStep("Extracting freestyle vocals via Whisper DSP...");
         try {
            const formData = new FormData();
            formData.append('audio', targetBlob, 'master.wav');
            formData.append('bpm', audioData?.bpm?.toString() || '120');

            // Routing to our existing cadence endpoint to leverage Whisper Large V3
            const whisperRes = await fetch('/api/dsp/cadence', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${session.access_token}` },
              body: formData
            });

            if (whisperRes.ok) {
              const whisperData = await whisperRes.json();
              if (whisperData.transcription && whisperData.transcription.trim().length > 0) {
                 lyricsForScan = whisperData.transcription;
                 // Save the extracted lyrics to global state so the user can see them!
                 useMatrixStore.getState().setGeneratedLyrics(whisperData.transcription);
              }
            } else {
              console.warn("Whisper transcription rejected. Proceeding as instrumental.");
            }
         } catch (e) {
            console.warn("Forensic transcription bypassed.", e);
         }
      }

      // STEP 2: RUN THE A&R NEURAL SCAN
      updateAnrData({ status: "analyzing" });
      setLoadingStep("Scanning structural metrics...");
      
      const analyzeRes = await fetch('/api/distribution/analyze', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({ 
          title: anrData.trackTitle, 
          lyrics: lyricsForScan, // <-- INJECTS THE WRITTEN OR TRANSCRIBED LYRICS
          bpm: audioData?.bpm || 120,
          blueprint: blueprint,
          flowDNA: flowDNA
        })
      });
      
      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(analyzeData.error || "A&R Scan Failed");

      // STEP 3: WRITE TO THE LEDGER
      updateAnrData({ status: "submitting" });
      setLoadingStep("Writing metadata to Supabase Ledger...");

      const submitRes = await fetch('/api/distribution/submit', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title: anrData.trackTitle,
          audioUrl: persistentAudioUrl, 
          coverUrl: analyzeData.coverUrl,
          hitScore: analyzeData.hitScore,
          tiktokSnippet: analyzeData.tiktokSnippet
        })
      });

      if (!submitRes.ok) throw new Error("Failed to secure artifact in Ledger.");

      // STEP 4: FETCH NEW TRACK ID & SUBMISSION DATA
      const { data: latestSub } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', userSession?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (latestSub) {
          setTrackId(latestSub.id);
          setSubmission(latestSub);
      }

      // STEP 5: FINALIZE UI
      updateAnrData({
        hitScore: analyzeData.hitScore,
        coverUrl: analyzeData.coverUrl,
        tiktokSnippet: analyzeData.tiktokSnippet,
        status: "success"
      });
      if (addToast) addToast("Artifact secured. Global Nodes synchronized.", "success");

    } catch (error: any) {
      console.error("Distribution Error:", error);
      if (addToast) addToast(error.message, "error");
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
        body: JSON.stringify({ userId: userSession?.id, trackTitle: anrData.trackTitle, trackId: trackId })
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

  // SURGICAL FIX: The FLUX.1 Generation Engine Caller (Anti-304 & Hydration Guard)
  const triggerCoverArtGeneration = async (tId: string) => {
    setIsGeneratingCover(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Safely resolve the track title even if the UI memory wiped during Stripe redirect
      let safeTitle = anrData.trackTitle || submission?.title;
      if (!safeTitle) {
        const { data: subData } = await supabase.from('submissions').select('title').eq('id', tId).single();
        safeTitle = subData?.title || "Untitled Artifact";
      }

      const res = await fetch('/api/distribution/cover-art/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${session?.access_token}`,
          // Brutal anti-caching headers to kill the 304 error
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        body: JSON.stringify({ trackId: tId, trackTitle: safeTitle })
      });
      
      const data = await res.json();
      if (data.coverUrl) {
        // Append unique timestamp to bust browser image cache completely
        const cacheBustedUrl = `${data.coverUrl}?t=${Date.now()}`;
        
        setSubmission((prev: any) => ({ ...prev, cover_url: cacheBustedUrl }));
        updateAnrData({ coverUrl: cacheBustedUrl });
        if(addToast) addToast("AI Visuals rendered and attached.", "success");
      } else {
        throw new Error(data.error || "Generation failed.");
      }
    } catch (err: any) {
      console.error("Cover Art Error:", err);
      if(addToast) addToast(`Failed: ${err.message}`, "error");
    } finally {
      setIsGeneratingCover(false);
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
              onClick={handleDistributionSequence} 
              disabled={!anrData.trackTitle.trim() || !finalMaster}
              className="w-full bg-[#E60000] disabled:opacity-30 disabled:cursor-not-allowed text-white py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.2)] flex justify-center items-center gap-3"
            >
              {!finalMaster ? "Master Required" : isFreestyle ? <><Zap size={18}/> Extract Vocals & Submit (1 CRD)</> : "Submit for A&R Review"}
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
            <div className="font-mono text-[10px] text-[#E60000] font-bold uppercase tracking-widest">
              {loadingStep || "Writing data to secure storage nodes..."}
            </div>
          </div>
        )}

        {anrData.status === "success" && (
          <div className="py-6 animate-in zoom-in relative z-10 text-left">
             <div className="flex items-center justify-between mb-8 border-b border-[#222] pb-6">
               <div>
                 <h3 className="font-oswald text-3xl uppercase tracking-widest text-white glow-red">Project Finalized</h3>
                 <p className="font-mono text-[10px] text-[#888] uppercase tracking-widest mt-2">Node Synchronization Complete</p>
               </div>
               <CheckCircle2 size={40} className="text-green-500 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full bg-black" />
             </div>
             
             {/* ROW 1: Art & Score */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
               <div className="flex flex-col md:flex-row gap-6">
                  <div className="w-full md:w-48 flex flex-col gap-2 shrink-0">
                    <div className="w-full h-48 bg-[#050505] border border-[#222] relative overflow-hidden shadow-xl group">
                      {anrData.coverUrl ? (
                        <img src={anrData.coverUrl} alt="Cover" className="w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 m-2 border border-dashed border-[#333] flex flex-col items-center justify-center bg-black/50 transition-colors group-hover:border-[#555]">
                          <ImageIcon size={24} className="mb-2 text-[#444]" />
                          <span className="font-mono text-[8px] uppercase tracking-widest text-center px-2 text-[#666]">Visuals Unassigned</span>
                        </div>
                      )}
                    </div>
                    
                    {!anrData.coverUrl && (
                      <button 
                        onClick={handlePurchaseCoverArt}
                        disabled={isGeneratingCover}
                        className="w-full flex items-center justify-center gap-2 bg-yellow-500/5 border border-yellow-500/20 text-yellow-500 py-3 text-[9px] font-bold uppercase tracking-widest hover:bg-yellow-500 hover:text-black transition-all disabled:opacity-50"
                      >
                        {isGeneratingCover ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                        Unlock AI Art ($2.99)
                      </button>
                    )}
                  </div>
                  <div className="flex-1 bg-[#0a0a0a] border border-[#222] p-6 flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5"><BarChart size={80} className="text-[#E60000]" /></div>
                    <span className="text-[10px] font-mono text-[#888] uppercase tracking-widest mb-2 flex items-center gap-2 relative z-10">
                      <BarChart size={14} className="text-[#E60000]" /> A&R Score
                    </span>
                    <div className={`text-7xl font-oswald font-bold tracking-tighter relative z-10 drop-shadow-lg
                      ${anrData.hitScore >= 85 ? 'text-green-500' : anrData.hitScore >= 70 ? 'text-yellow-500' : 'text-[#E60000]'}`}>
                      {anrData.hitScore}
                    </div>
                    <p className="text-[9px] font-mono uppercase mt-2 text-[#555] relative z-10 font-bold tracking-widest border-t border-[#222] pt-2 w-1/2 text-center">
                       {anrData.hitScore >= 85 ? 'Algorithmic Priority' : anrData.hitScore >= 70 ? 'Gold Standard' : 'Underground Mix'}
                    </p>
                  </div>
               </div>
             </div>

             {/* ROW 2: Viral Intelligence & The Exec Rollout */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
               
               {/* TikTok Slicer */}
               <div className="bg-[#0a0000] border border-[#330000] p-6 text-left relative overflow-hidden flex flex-col">
                  <div className="absolute top-0 right-0 p-2 opacity-10"><Zap size={64} className="text-[#E60000]" /></div>
                  <span className="text-[10px] font-mono text-[#E60000] uppercase tracking-[0.3em] font-bold mb-4 block">
                    Viral Intelligence // Slicer
                  </span>
                  
                  {anrData.tiktokSnippet?.includes("Instrumental") ? (
                    <div className="flex-1 flex items-center justify-center border border-dashed border-[#E60000]/20 m-2 bg-black/50">
                      <p className="font-mono text-[9px] text-[#888] uppercase tracking-widest text-center px-4 py-8">
                        [ Instrumental Format ]<br/><br/>No lyrical extraction possible.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="font-mono text-xs text-gray-300 leading-relaxed italic whitespace-pre-wrap border-l-2 border-[#E60000] pl-4 flex-1">
                        "{anrData.tiktokSnippet}"
                      </div>
                      <p className="mt-4 text-[8px] text-[#555] uppercase tracking-widest font-mono border-t border-[#330000] pt-3">
                        Extracted via NLP for maximum 15-second audience retention.
                      </p>
                    </>
                  )}
               </div>

               {/* The Exec Rollout */}
               <div className="bg-black border border-[#222] p-6 text-left relative overflow-hidden flex flex-col">
                  <span className="text-[10px] font-mono text-purple-500 uppercase tracking-[0.3em] font-bold mb-4 block">
                    The Exec // 30-Day Rollout
                  </span>
                  
                  {execRollout ? (
                    <div className="font-mono text-[10px] text-gray-300 leading-relaxed overflow-y-auto h-32 custom-scrollbar pr-2 whitespace-pre-wrap border-l-2 border-purple-500 pl-4 flex-1 bg-[#110011]/30 p-2">
                      {execRollout}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center border border-dashed border-purple-500/20 m-2 bg-purple-900/5 relative py-6">
                      <Lock size={20} className="mb-3 text-purple-500/50" />
                      <p className="font-oswald text-sm text-purple-400 uppercase tracking-widest mb-1">Timeline Locked</p>
                      <p className="text-[8px] font-mono uppercase tracking-widest text-[#888] mb-5 max-w-[200px]">
                        Awaiting algorithmic strategy deployment.
                      </p>
                      <button 
                        onClick={handlePurchaseRollout}
                        disabled={isGeneratingRollout}
                        className="bg-purple-900/20 border border-purple-500/30 text-purple-400 px-6 py-2 text-[9px] font-bold uppercase tracking-widest hover:bg-purple-600 hover:text-white transition-colors disabled:opacity-50 shadow-lg flex items-center gap-2"
                      >
                        {isGeneratingRollout ? <Loader2 size={12} className="animate-spin" /> : <BarChart size={12} />}
                        Unlock Strategy ($14.99)
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

             {/* The Re-Scan Escape Hatch */}
             <div className="mt-8 text-center">
               <button 
                 onClick={() => {
                   if (window.confirm("This will discard the current A&R score and generate a new artifact submission. Proceed?")) {
                     updateAnrData({ status: "idle", hitScore: 0, tiktokSnippet: "", coverUrl: "" });
                     setTrackId(null);
                     setExecRollout("");
                   }
                 }}
                 className="text-[10px] font-mono text-[#555] hover:text-[#E60000] uppercase tracking-widest transition-colors flex items-center justify-center gap-2 mx-auto"
               >
                 <RefreshCw size={10} /> [ Force Neural Re-Scan ]
               </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}