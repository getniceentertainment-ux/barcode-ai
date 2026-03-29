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
  
  const interceptorFired = useRef(false); 

  // --- STATE ---
  const [trackId, setTrackId] = useState<string | null>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [execRollout, setExecRollout] = useState<string>("");
  const [isGeneratingRollout, setIsGeneratingRollout] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>(""); 
  const [isUnlocked, setIsUnlocked] = useState(false);

  const isFreestyle = !generatedLyrics || generatedLyrics.trim() === "";

  // --- NEW PRO-RATED MATCH CALCULATION ---
  const score = anrData.hitScore || 0;
  const proRatedAdvance = Math.floor(1500 * (score / 100));

  useEffect(() => {
    if (anrData.status === 'success' && userSession?.id) {
      const fetchLatest = async () => {
        const { data } = await supabase.from('submissions').select('*').eq('user_id', userSession.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (data) {
          setSubmission(data);
          setTrackId(data.id);
          if (data.exec_rollout) setExecRollout(data.exec_rollout);
          if (data.upstream_deal_signed || data.rollout_purchased || data.exec_bypass) setIsUnlocked(true);
        }
      };
      fetchLatest();
    }
  }, [anrData.status, userSession?.id]);
  
  useEffect(() => {
    if (typeof window === 'undefined' || interceptorFired.current) return;
    const params = new URLSearchParams(window.location.search);
    const coverArtPurchased = params.get('cover_art_purchased');
    const searchTrackId = params.get('track_id') || params.get('trackId');              
    
    if (!searchTrackId) return;

    if (coverArtPurchased === 'true') {
      interceptorFired.current = true;
      updateAnrData({ status: "success" });
      triggerCoverArtGeneration(searchTrackId);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleDistributionSequence = async () => {
    if (!anrData.trackTitle.trim() || !finalMaster) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      updateAnrData({ status: "submitting" });
      setLoadingStep("Uploading master to encrypted vault...");
      
      let persistentAudioUrl = finalMaster?.url;
      let targetBlob: Blob | null = (finalMaster as any).blob || null;

      if (persistentAudioUrl?.startsWith('blob:')) {
        if (!targetBlob) targetBlob = await (await fetch(persistentAudioUrl)).blob();
        const fileName = `${userSession?.id}/MASTER_${Date.now()}.wav`;
        const { error: uploadErr } = await supabase.storage.from('mastered-audio').upload(fileName, targetBlob, { contentType: 'audio/wav', upsert: true });
        if (uploadErr) throw uploadErr;
        persistentAudioUrl = supabase.storage.from('mastered-audio').getPublicUrl(fileName).data.publicUrl;
      }

      updateAnrData({ status: "analyzing" });
      const analyzeRes = await fetch('/api/distribution/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ title: anrData.trackTitle, lyrics: generatedLyrics || "Instrumental", bpm: audioData?.bpm || 120, blueprint, flowDNA })
      });
      const analyzeData = await analyzeRes.json();
      
      const submitRes = await fetch('/api/distribution/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}`},
        body: JSON.stringify({ title: anrData.trackTitle, audioUrl: persistentAudioUrl, hitScore: analyzeData.hitScore, tiktokSnippet: analyzeData.tiktokSnippet })
      });

      updateAnrData({ hitScore: analyzeData.hitScore, tiktokSnippet: analyzeData.tiktokSnippet, status: "success" });
    } catch (error: any) {
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
        body: JSON.stringify({ userId: userSession?.id, trackTitle: anrData.trackTitle, trackId })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) { setIsGeneratingCover(false); }
  };

  const handlePurchaseRollout = async () => {
    setIsGeneratingRollout(true);
    try {
      const res = await fetch('/api/stripe/rollout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userSession?.id, trackTitle: anrData.trackTitle, trackId, hitScore: anrData.hitScore })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) { setIsGeneratingRollout(false); }
  };

  const triggerCoverArtGeneration = async (tId: string) => {
    setIsGeneratingCover(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/distribution/cover-art/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}`, 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ trackId: tId, trackTitle: anrData.trackTitle || "Artifact" })
      });
      const data = await res.json();
      if (data.coverUrl) {
        updateAnrData({ coverUrl: `${data.coverUrl}?t=${Date.now()}` });
        if(addToast) addToast("AI Visuals rendered.", "success");
      }
    } finally { setIsGeneratingCover(false); }
  };

  return (
    <div className="h-full flex flex-col justify-center max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className={`bg-[#050505] border p-12 rounded-lg text-center relative overflow-hidden transition-all duration-500 ${anrData.status === 'success' ? 'border-[#E60000] shadow-[0_0_30px_rgba(230,0,0,0.15)]' : 'border-[#222]'}`}>
        
        {(anrData.status === "analyzing" || anrData.status === "submitting") && <div className="absolute inset-0 bg-[#E60000]/5 animate-pulse pointer-events-none" />}

        <div className="relative z-10 mb-8">
          {anrData.status === "idle" && <Send size={64} className="mx-auto text-[#444]" />}
          {(anrData.status === "analyzing" || anrData.status === "submitting") && <Loader2 size={64} className="mx-auto text-[#E60000] animate-spin" />}
          {anrData.status === "success" && <CheckCircle2 size={64} className="mx-auto text-green-500 rounded-full" />}
        </div>
        
        <h2 className="font-oswald text-4xl uppercase tracking-widest mb-10 font-bold text-white relative z-10">R07: Distribution</h2>
        
        {anrData.status === "idle" && (
          <div className="max-w-md mx-auto space-y-6 relative z-10">
            <div className="text-left">
              <label className="text-[10px] text-[#888] font-mono uppercase tracking-widest font-bold mb-2 block">Track Title</label>
              <input type="text" value={anrData.trackTitle} onChange={(e) => updateAnrData({ trackTitle: e.target.value })} className="w-full bg-black border border-[#222] p-4 font-mono text-xs uppercase text-white outline-none focus:border-[#E60000]" placeholder="Enter Title..." />
            </div>
            <button onClick={handleDistributionSequence} disabled={!anrData.trackTitle.trim() || !finalMaster} className="w-full bg-[#E60000] disabled:opacity-30 text-white py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex justify-center items-center gap-3">Submit for A&R Review</button>
          </div>
        )}

        {anrData.status === "success" && (
          <div className="py-6 animate-in zoom-in relative z-10 text-left">
             <div className="flex items-center justify-between mb-8 border-b border-[#222] pb-6">
               <h3 className="font-oswald text-3xl uppercase tracking-widest text-white">Project Finalized</h3>
               <CheckCircle2 size={40} className="text-green-500 bg-black" />
             </div>
             
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
               <div className="flex flex-col md:flex-row gap-6">
                  <div className="w-full md:w-48 flex flex-col gap-2 shrink-0">
                    <div className="w-full h-48 bg-black border border-[#222] relative overflow-hidden">
                      {anrData.coverUrl ? <img src={anrData.coverUrl} className="w-full h-full object-cover" /> : <div className="absolute inset-0 flex flex-col items-center justify-center opacity-20"><ImageIcon size={24}/><span className="text-[8px] uppercase">Unassigned</span></div>}
                    </div>
                    {!anrData.coverUrl && <button onClick={handlePurchaseCoverArt} disabled={isGeneratingCover} className="w-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 py-3 text-[9px] font-bold uppercase tracking-widest hover:bg-yellow-500 hover:text-black transition-all">Unlock AI Art ($2.99)</button>}
                  </div>
                  <div className="flex-1 bg-[#0a0a0a] border border-[#222] p-6 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-mono text-[#888] uppercase mb-2">A&R Score</span>
                    <div className={`text-7xl font-oswald font-bold ${score >= 90 ? 'text-green-500' : 'text-yellow-500'}`}>{score}</div>
                    <p className="text-[9px] font-mono uppercase mt-2 text-[#555] tracking-widest">{score >= 90 ? 'Upstream Target' : 'Independent Ready'}</p>
                  </div>
               </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
               <div className="bg-[#0a0000] border border-[#330000] p-6">
                  <span className="text-[10px] font-mono text-[#E60000] uppercase tracking-widest font-bold mb-4 block">Viral Intelligence</span>
                  <div className="font-mono text-xs text-gray-300 leading-relaxed italic border-l-2 border-[#E60000] pl-4">"{anrData.tiktokSnippet}"</div>
               </div>

               {/* SURGICAL FIX: The Algorithmic Match Pitch */}
               <div className="bg-black border border-[#222] p-6 flex flex-col">
                  <span className="text-[10px] font-mono text-purple-500 uppercase tracking-widest font-bold mb-4 block">Algorithmic Ad Match</span>
                  {isUnlocked ? (
                    <button onClick={() => setActiveRoom("11")} className="w-full bg-green-600/20 border border-green-500 text-green-400 py-4 text-[10px] font-bold uppercase tracking-widest hover:bg-green-600 hover:text-white transition-all flex items-center justify-center gap-2 mt-auto">Enter Command Center <ArrowRight size={14} /></button>
                  ) : (
                    <div className="flex flex-col mt-auto">
                      <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 mb-4 rounded-sm">
                           <p className="text-[9px] font-mono text-yellow-500 uppercase tracking-widest font-bold flex items-center">
                             <Zap size={10} className="mr-1.5" /> Merit-Based Advance
                           </p>
                           <p className="text-[8px] font-mono text-[#888] mt-1.5 uppercase leading-relaxed">
                             Your score of {score} unlocks a <span className="text-white font-bold">{score}% match</span> of the Label's $1,500 marketing advance.
                           </p>
                           <p className="text-xs font-oswald text-green-500 tracking-widest mt-2 block">
                             Unlock ${proRatedAdvance}.00 in Ad Spend
                           </p>
                      </div>
                      <button onClick={handlePurchaseRollout} disabled={isGeneratingRollout} className="bg-purple-900/20 border border-purple-500/30 text-purple-400 py-4 text-[10px] font-bold uppercase tracking-widest hover:bg-purple-600 hover:text-white transition-all flex items-center justify-center gap-2">Unlock Exec AI ($14.99)</button>
                    </div>
                  )}
               </div>
             </div>

             <div className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto">
               <button onClick={() => setActiveRoom("08")} className="flex-1 bg-white text-black py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all">Proceed to Bank <ArrowRight size={20} /></button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}