"use client";

import React, { useState, useEffect } from "react";
import { Send, Loader2, CheckCircle2, BarChart, ArrowRight, ShieldAlert, Image as ImageIcon, Globe, Zap, Music } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";
import Link from "next/link"; 

export default function Room07_Distribution() {
  const { setActiveRoom, userSession, generatedLyrics, addToast, audioData, finalMaster, anrData, updateAnrData } = useMatrixStore();
  const { trackTitle, status, hitScore, coverUrl, tiktokSnippet } = anrData;

  const [isGeneratingCover, setIsGeneratingCover] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('cover_purchased') === 'true') {
        const generatedCoverUrl = params.get('cover_url');
        window.history.replaceState({}, document.title, window.location.pathname);
        if (generatedCoverUrl) {
          updateAnrData({ coverUrl: generatedCoverUrl, status: "success" });
          if(addToast) addToast("DALL-E 3 Cover Art Generated & Attached.", "success");
        }
      }
    }
  }, [userSession, addToast, updateAnrData]);

  const handleAnalyze = async () => {
    if (!trackTitle.trim()) {
      if (addToast) addToast("A track title is required for distribution.", "error");
      return;
    }
    if (!finalMaster?.url) {
      if (addToast) addToast("No master track found. Complete Room 06 first.", "error");
      return;
    }

    updateAnrData({ status: "analyzing" });

    try {
      // 1. Trigger Backend: Groq determines the Snippet Timestamp & DSP calculates the Score
      const analyzeRes = await fetch('/api/distribution/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ 
          title: trackTitle, 
          lyrics: generatedLyrics || "",
          bpm: audioData?.bpm || 120,
          energy: audioData?.energy || 0.8 // Using actual DSP data!        })
      });
      
      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(analyzeData.error || "A&R Scan Failed");

      // 2. Local Web Audio Slicer (Now powered by Groq's timestamp!)
      let snippetBlobUrl = "";
      try {
        if (finalMaster?.url) {
          // Pass the exact second Groq said the hook starts (default to 15 if missing)
          const targetStartTime = analyzeData.snippetStartTime || 15;
          snippetBlobUrl = await extractTikTokSnippet(finalMaster.url, targetStartTime);
        }
      } catch (sliceErr) {
        console.error("Local audio slicing failed:", sliceErr);
        if (addToast) addToast("Snippet isolation bypassed. Securing artifact.", "info");
      }

      // 3. Update UI State (NO MORE MOCKING)
      updateAnrData({
        hitScore: analyzeData.hitScore, 
        coverUrl: analyzeData.coverUrl || "",
        tiktokSnippet: snippetBlobUrl
      });
      
      // 4. Move to Final Ledger Submission
      handleFinalSubmit({ ...analyzeData, tiktokSnippet: snippetBlobUrl });

    } catch (error: any) {
      console.error("A&R Error:", error);
      if (addToast) addToast(error.message, "error");
      updateAnrData({ status: "idle" });
    }
  };

  const handleFinalSubmit = async (aAndRData: any) => {
    updateAnrData({ status: "submitting" });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch('/api/distribution/submit', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          title: trackTitle,
          audioUrl: finalMaster?.url,
          coverUrl: aAndRData.coverUrl,
          hitScore: aAndRData.hitScore,
          tiktokSnippet: aAndRData.tiktokSnippet
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Unknown API Crash" }));
        throw new Error(`API Error: ${errorData.error || "Failed to secure artifact"}`);
      }

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
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ userId: userSession?.id, trackTitle })
      });
      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url; 
      } else {
        throw new Error(data.error || "Failed to initialize Stripe.");
      }
    } catch (err: any) {
      console.error("Cover Art Checkout Error:", err);
      if (addToast) addToast("Checkout failed: " + err.message, "error");
      setIsGeneratingCover(false);
    }
  };

  return (
    <div className="h-full flex flex-col justify-center max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className={`bg-[#050505] border p-12 rounded-lg text-center relative overflow-hidden transition-all duration-500
        ${status === 'success' ? 'border-[#E60000] shadow-[0_0_30px_rgba(230,0,0,0.15)]' : 'border-[#222]'}`}>
        
        {(status === "analyzing" || status === "submitting") && (
          <div className="absolute inset-0 bg-[#E60000]/5 animate-pulse pointer-events-none" />
        )}

        <div className="relative z-10 mb-8">
          {status === "idle" && <Send size={64} className="mx-auto text-[#444]" />}
          {(status === "analyzing" || status === "submitting") && <Loader2 size={64} className="mx-auto text-[#E60000] animate-spin" />}
          {status === "success" && <CheckCircle2 size={64} className="mx-auto text-green-500 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full" />}
        </div>
        
        <h2 className="font-oswald text-4xl uppercase tracking-widest mb-10 font-bold text-white relative z-10">
          R07: Distribution Node
        </h2>
        
        {status === "idle" && (
          <div className="max-w-md mx-auto space-y-6 relative z-10">
            <div className="text-left">
              <label className="text-[10px] text-[#888] font-mono uppercase tracking-widest font-bold mb-2 block">
                Official Track Title
              </label>
              <input 
                type="text" 
                value={trackTitle}
                onChange={(e) => updateAnrData({ trackTitle: e.target.value })}
                className="w-full bg-black border border-[#222] p-4 font-mono text-xs uppercase text-white outline-none focus:border-[#E60000] transition-colors" 
                placeholder="E.g., MATRIX INFILTRATION..." 
              />
            </div>
            
            <button 
              onClick={handleAnalyze} 
              disabled={!trackTitle.trim() || !finalMaster}
              className="w-full bg-[#E60000] disabled:opacity-30 disabled:cursor-not-allowed text-white py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.2)]"
            >
              {!finalMaster ? "Master Required" : "Submit for A&R Review"}
            </button>
            
            <div className="flex items-start gap-3 mt-6 p-4 bg-[#110000] border border-[#330000]">
              <ShieldAlert size={16} className="text-[#E60000] shrink-0 mt-0.5" />
              <p className="text-[9px] text-[#888] uppercase font-mono text-left leading-relaxed">
                By submitting, Groq will scan your lyrics to find the viral hook, and DSP intelligence will calculate your global A&R Score.
              </p>
            </div>
          </div>
        )}

        {status === "analyzing" && (
          <div className="space-y-6 py-10 relative z-10 flex flex-col items-center">
            <p className="font-oswald text-2xl text-[#E60000] uppercase tracking-widest font-bold">A&R Neural Scan In Progress...</p>
            <div className="font-mono text-[10px] text-[#888] uppercase tracking-widest space-y-2 text-center">
              <p>Analyzing DSP frequencies...</p>
              <p className="text-[#E60000] font-bold">Groq AI identifying viral hook timestamp...</p>
              <p>Generating Cover Art via DALL-E 3...</p>
            </div>
          </div>
        )}

        {status === "submitting" && (
          <div className="space-y-6 py-10 relative z-10">
            <p className="font-oswald text-2xl text-white uppercase tracking-widest font-bold">Securing Artifact...</p>
            <div className="font-mono text-[10px] text-[#888] uppercase tracking-widest">
              Writing metadata to Supabase Ledger...
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="py-6 animate-in zoom-in relative z-10">
             <h3 className="font-oswald text-3xl uppercase tracking-widest mb-8 text-white">Project Finalized</h3>
             
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
               
               <div className="flex flex-col md:flex-row gap-6">
                  <div className="w-full md:w-48 flex flex-col gap-2 shrink-0">
                    <div className="w-full h-48 bg-[#111] border border-[#333] relative overflow-hidden shadow-xl">
                      {coverUrl ? (
                        <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-[#333]">
                          <ImageIcon size={32} className="mb-2" />
                          <span className="font-mono text-[8px] uppercase tracking-widest text-center px-2">No Cover Art</span>
                        </div>
                      )}
                    </div>
                    
                    {!coverUrl && (
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
                      ${hitScore >= 85 ? 'text-green-500' : hitScore >= 70 ? 'text-yellow-500' : 'text-[#E60000]'}`}>
                      {hitScore}
                    </div>
                    <p className="text-[9px] font-mono uppercase mt-2 text-[#555]">
                       {hitScore >= 85 ? 'Platinum Potential' : hitScore >= 70 ? 'Gold Standard' : 'Underground Mix'}
                    </p>
                  </div>
               </div>

               {/* TikTok Viral Snippet Display */}
               <div className="bg-[#110000] border border-[#330000] p-6 text-left relative overflow-hidden flex flex-col justify-center">
                  <div className="absolute top-0 right-0 p-2 opacity-10">
                    <Zap size={64} className="text-[#E60000]" />
                  </div>
                  <span className="text-[10px] font-mono text-[#E60000] uppercase tracking-[0.3em] font-bold mb-4 block">
                    Viral Intelligence // TikTok Snippet
                  </span>
                  
                  {tiktokSnippet ? (
                    <div className="z-10 bg-black/50 p-4 border border-[#E60000]/30 rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <Music size={16} className="text-white" />
                        <span className="text-xs font-mono uppercase text-white">Groq-Isolated Hook</span>
                      </div>
                      <audio controls src={tiktokSnippet} className="w-full h-8 mb-3 outline-none" />
                      <a 
                        href={tiktokSnippet} 
                        download={`${trackTitle.replace(/\s+/g, '_')}_TikTok_Snippet.wav`} 
                        className="text-[9px] font-mono bg-[#E60000] text-white px-3 py-1 uppercase tracking-widest hover:bg-red-700 transition-colors inline-block text-center"
                      >
                        Download WAV
                      </a>
                    </div>
                  ) : (
                    <div className="font-mono text-xs text-gray-300 leading-relaxed italic whitespace-pre-wrap border-l-2 border-[#E60000] pl-4 z-10">
                      Instrumental artifact. No snippet isolated.
                    </div>
                  )}

                  <p className="mt-4 text-[8px] text-[#555] uppercase tracking-widest font-mono z-10">
                    This timestamp was identified by Groq LLM for maximum virality.
                  </p>
               </div>

             </div>

             <div className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto">
               <button 
                  onClick={() => setActiveRoom("08")}
                  className="flex-1 flex justify-center items-center gap-3 bg-white text-black py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                >
                  Proceed to Bank <ArrowRight size={20} />
                </button>
                <Link 
                  href={`/${encodeURIComponent(userSession?.stageName || "Artist")}`}
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

// ============================================================================
// WEB AUDIO API ENGINE: AUTOMATIC 15-SECOND WAV SLICER (DYNAMIC START TIME)
// ============================================================================
// SURGICAL FIX: We now accept 'targetStartTime' from Groq
async function extractTikTokSnippet(audioUrl: string, targetStartTime: number): Promise<string> {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const snippetLength = 15; 
  
  // Ensure Groq's timestamp doesn't accidentally exceed the track length
  const maxAllowedStart = Math.max(0, audioBuffer.duration - snippetLength);
  const startOffset = Math.min(targetStartTime, maxAllowedStart);

  const frameCount = audioCtx.sampleRate * snippetLength;
  const offlineCtx = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    frameCount,
    audioBuffer.sampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0, startOffset, snippetLength);

  const renderedBuffer = await offlineCtx.startRendering();

  const interleaved = interleave(renderedBuffer);
  const wavBlob = encodeWAV(interleaved, renderedBuffer.sampleRate, renderedBuffer.numberOfChannels);
  
  return URL.createObjectURL(wavBlob);
}

function interleave(buffer: AudioBuffer) {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length * numChannels;
  const result = new Float32Array(length);
  const channels = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }
  let index = 0;
  let inputIndex = 0;
  while (index < length) {
    for (let i = 0; i < numChannels; i++) {
      result[index++] = channels[i][inputIndex];
    }
    inputIndex++;
  }
  return result;
}

function encodeWAV(samples: Float32Array, sampleRate: number, numChannels: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);
  
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}