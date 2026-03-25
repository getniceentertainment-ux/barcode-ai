"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sliders, CheckCircle2, Activity, ArrowRight, AudioWaveform, Disc3, Download, RefreshCw, FileArchive, Loader2, Lock, DollarSign, ShieldCheck, Trash2 } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";
import JSZip from 'jszip';
import jsPDF from 'jspdf';

function audioBufferToWav(buffer: AudioBuffer) {
  let numOfChan = buffer.numberOfChannels, length = buffer.length * numOfChan * 2 + 44,
      bufferArray = new ArrayBuffer(length), view = new DataView(bufferArray),
      channels = [], i, sample, offset = 0, pos = 0;

  function setUint16(data: number) { view.setUint16(pos, data, true); pos += 2; }
  function setUint32(data: number) { view.setUint32(pos, data, true); pos += 4; }

  setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157);
  setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
  setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164); setUint32(length - pos - 4);

  for(i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
  while(offset < buffer.length) {
      for(i = 0; i < numOfChan; i++) {
          sample = Math.max(-1, Math.min(1, channels[i][offset]));
          sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
          view.setInt16(pos, sample, true); pos += 2;
      }
      offset++;
  }
  return new Blob([bufferArray], {type: "audio/wav"});
}

export default function Room06_Mastering() {
  const { audioData, vocalStems, generatedLyrics, setActiveRoom, addToast, finalMaster, setFinalMaster, userSession, clearMatrix } = useMatrixStore();
  
  const [lufs, setLufs] = useState(-14); 
  const [actualLUFS, setActualLUFS] = useState(-20); 
  const [status, setStatus] = useState<"idle" | "processing" | "success">(finalMaster ? "success" : "idle");
  const [masterUrl, setMasterUrl] = useState<string | null>(finalMaster?.url || null);
  const [isZipping, setIsZipping] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  const isFreeLoader = (userSession?.tier as string) === "The Free Loader";

  useEffect(() => {
    // Both Moguls AND Artists get Mastering included in their tier.
    if ((userSession?.tier as string) === "The Mogul" || (userSession?.tier as string) === "The Artist") {
      setHasToken(true);
    } else {
      checkTokens();
    }

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('token_purchased') === 'true') {
        window.history.replaceState({}, document.title, window.location.pathname);
        setHasToken(true);
        if (addToast) addToast("Mastering Token Secured. System unlocked.", "success");
      }
    }
  }, [userSession]);

  const checkTokens = async () => {
    if (!userSession?.id) return;
    const { data } = await supabase.from('profiles').select('has_mastering_token').eq('id', userSession.id).single();
    if (data && (data as any).has_mastering_token) setHasToken(true);
  };

  const handlePurchaseToken = async () => {
    if (!userSession?.id) return;
    if(addToast) addToast("Routing to Secure Checkout...", "info");
    
    try {
      const res = await fetch('/api/stripe/master-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userSession.id })
      });
      const data = await res.json();
      
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error || "Failed to route to checkout.");
    } catch (err: any) {
      if(addToast) addToast("Checkout failed: " + err.message, "error");
    }
  };

  const handleMastering = async () => {
    if (!audioData?.url) { 
      if(addToast) addToast("Audio required.", "error"); 
      return; 
    }
    
    // --- SURGICAL GATE: BLOCK INITIATION IF LOCKED ---
    if (isFreeLoader && !hasToken) {
      if(addToast) addToast("Mastering Token Required.", "error");
      return;
    }

    setStatus("processing");

    try {
      const beatUrl = audioData.url;
      const vocalUrl = vocalStems.length > 0 ? vocalStems[0].url : null;

      const tmpCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

      const beatResp = await fetch(beatUrl);
      const beatArrayBuf = await beatResp.arrayBuffer();
      const beatBuf = await tmpCtx.decodeAudioData(beatArrayBuf);
      let maxDuration = beatBuf.duration;

      const channelData = beatBuf.getChannelData(0);
      let sumSquares = 0;
      for (let i = 0; i < channelData.length; i++) { sumSquares += channelData[i] * channelData[i]; }
      const measuredDB = 20 * Math.log10(Math.sqrt(sumSquares / channelData.length) || 0.0001);
      setActualLUFS(Math.round(measuredDB));

      let vocalBuf: AudioBuffer | null = null;
      if (vocalUrl) {
        const vocalResp = await fetch(vocalUrl);
        const vocalArrayBuf = await vocalResp.arrayBuffer();
        vocalBuf = await tmpCtx.decodeAudioData(vocalArrayBuf);
        if (vocalBuf.duration > maxDuration) maxDuration = vocalBuf.duration;
      }

      const offlineCtx = new OfflineAudioContext(2, tmpCtx.sampleRate * maxDuration, tmpCtx.sampleRate);
      const mixBus = offlineCtx.createGain();
      const targetGain = Math.pow(10, ((lufs - measuredDB) / 20)); 
      mixBus.gain.value = targetGain;

      const limiter = offlineCtx.createDynamicsCompressor();
      limiter.threshold.value = -0.5; limiter.knee.value = 0; limiter.ratio.value = 20; 
      limiter.attack.value = 0.001; limiter.release.value = 0.050;

      mixBus.connect(limiter);
      limiter.connect(offlineCtx.destination);

      const beatSource = offlineCtx.createBufferSource(); beatSource.buffer = beatBuf;
      const beatGain = offlineCtx.createGain(); beatGain.gain.value = vocalBuf ? 0.75 : 1.0; 
      beatSource.connect(beatGain); beatGain.connect(mixBus); beatSource.start(0);

      if (vocalBuf) {
        const vocalSource = offlineCtx.createBufferSource(); vocalSource.buffer = vocalBuf;
        const vocalGain = offlineCtx.createGain(); vocalGain.gain.value = 1.2; 
        vocalSource.connect(vocalGain); vocalGain.connect(mixBus); vocalSource.start(0);
      }

      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(renderedBuffer);
      
      const fileName = `${userSession?.id || 'ANON'}/${Date.now()}_MASTER.wav`;
      const { data, error } = await supabase.storage
        .from('mastered-audio')
        .upload(fileName, wavBlob, { contentType: 'audio/wav', upsert: true });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('mastered-audio').getPublicUrl(fileName);

      setMasterUrl(publicUrl);
      setFinalMaster({ url: publicUrl, blob: wavBlob }); 
      
      useMatrixStore.setState({
        audioData: { ...audioData, url: publicUrl },
        isProjectFinalized: true
      });

      if(addToast) addToast("Master encoded & permanently secured. Session locked.", "success");
      setStatus("success");
    } catch (err: any) {
      console.error("Mastering/Upload Error:", err);
      if(addToast) addToast("Error rendering or uploading master.", "error");
      setStatus("idle");
    }
  };

  const handleArtifactExport = async () => {
    if (!finalMaster?.blob || !audioData?.url) return;
    const trackName = audioData.fileName.replace(/\.[^/.]+$/, "");

    // --- SURGICAL FIX: FREE LOADER EXPORT (SINGLE FILE) ---
    if (isFreeLoader) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(finalMaster.blob);
      a.download = `${trackName}_MASTER.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      if (addToast) addToast("Free Tier Export: Master Audio Downloaded. Upgrade for ZIP with Stems & Lyrics.", "info");
      return;
    }

    // --- STANDARD ZIP EXPORT (ARTIST/MOGUL) ---
    setIsZipping(true);
    try {
      const zip = new JSZip();

      zip.file(`1_${trackName}_MASTER.wav`, finalMaster.blob);

      const doc = new jsPDF();
      doc.setFont("courier");
      doc.setFontSize(12);
      const splitText = doc.splitTextToSize(generatedLyrics || "Instrumental / No Lyrics Documented.", 180);
      doc.text(splitText, 15, 20);
      const pdfBlob = doc.output('blob');
      zip.file(`2_${trackName}_LYRICS.pdf`, pdfBlob);

      const beatResp = await fetch(audioData.url);
      const beatBlob = await beatResp.blob();
      zip.file(`3_${trackName}_INSTRUMENTAL.wav`, beatBlob);

      const stemsFolder = zip.folder("RAW_VOCAL_STEMS");
      vocalStems.forEach((stem, index) => {
        if (stem.blob && stemsFolder) {
            stemsFolder.file(`Vocal_Take_${index + 1}.webm`, stem.blob);
        }
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(zipBlob);
      a.download = `${trackName}_STUDIO_ARTIFACTS.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      if(addToast) addToast("Studio Artifact ZIP Downloaded.", "success");
    } catch (err) {
      if(addToast) addToast("Failed to compile ZIP artifact.", "error");
    } finally {
      setIsZipping(false);
    }
  };

  const handleStartNewProject = () => {
    if(confirm("This will permanently clear the current session and send you to The Lab. Are you sure?")) {
      clearMatrix();
    }
  };

  const needleRotation = ((actualLUFS - (-20)) / ((-6) - (-20))) * 90 - 45;

  return (
    <div className="h-full flex flex-col items-center justify-center max-w-4xl mx-auto animate-in fade-in duration-500">
      
      <div className="text-center mb-12">
        <h2 className="font-oswald text-5xl uppercase tracking-widest mb-4 font-bold text-white">
          R06: Mastering Suite
        </h2>
        {status === "idle" && <p className="font-mono text-xs text-[#555] uppercase tracking-[0.2em]">Final Output Limiters // LUFS Normalization</p>}
        {status === "success" && <p className="font-mono text-xs text-green-500 uppercase tracking-[0.2em]">Commercial Standard Reached // Ready for Distribution</p>}
      </div>

      {status === "idle" && (
        <div className="w-full max-w-xl bg-[#050505] border border-[#222] p-10 flex flex-col items-center rounded-lg relative overflow-hidden group hover:border-[#E60000]/50 transition-all duration-500">
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#222 1px, transparent 1px), linear-gradient(90deg, #222 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          
          <div className="w-48 h-24 overflow-hidden relative mb-8 flex justify-center items-end border-b-2 border-[#333] bg-[#0a0a0a] rounded-t-full">
             <div className="absolute w-full h-full rounded-t-full border-t-[8px] border-l-[8px] border-r-[8px] border-[#222] z-10"></div>
             <div className="w-1 h-20 bg-[#E60000] origin-bottom transition-transform duration-300 ease-out z-20 shadow-[0_0_10px_rgba(230,0,0,0.5)]" style={{ transform: `rotate(${needleRotation}deg)` }}></div>
             <span className="absolute bottom-2 text-[8px] font-mono text-[#555] font-bold z-0">LUFS METER</span>
          </div>

          {!hasToken ? (
            <div className="w-full text-center animate-in zoom-in mb-8 relative z-10">
               <Lock size={32} className="mx-auto text-yellow-600 mb-4" />
               <h3 className="font-oswald text-xl uppercase font-bold text-white mb-2">Mastering Gated</h3>
               <p className="font-mono text-[9px] text-[#888] uppercase mb-8 leading-relaxed">Free Tier nodes require a <strong className="text-white">$4.99 Token</strong> per track.</p>
               <button onClick={handlePurchaseToken} className="w-full bg-[#E60000] text-white py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(230,0,0,0.2)]">Purchase Token <DollarSign size={18} /></button>
            </div>
          ) : (
            <div className="w-full mb-12 relative z-10">
              <div className="flex justify-between items-center mb-10">
                 <div className="flex items-center gap-2 text-green-500 font-mono text-[10px] uppercase font-bold tracking-widest border border-green-500/20 bg-green-500/5 px-3 py-1 rounded-full"><ShieldCheck size={14} /> Master Authorized</div>
                 <span className={`font-oswald text-3xl font-bold ${lufs > -10 ? 'text-[#E60000]' : lufs > -12 ? 'text-yellow-500' : 'text-white'}`}>
                   {lufs} <span className="text-xs font-mono text-[#555]">LUFS</span>
                 </span>
              </div>
              <div className="relative">
                <input type="range" min="-20" max="-6" step="0.5" value={lufs} onChange={(e) => setLufs(parseFloat(e.target.value))} className="w-full accent-[#E60000] h-2 bg-[#111] appearance-none cursor-pointer rounded-full relative z-10" />
                <div className="flex justify-between text-[8px] font-mono text-[#444] mt-3 absolute w-full -bottom-6">
                  <span>-20 (VINYL)</span>
                  <span className="text-white border-b border-white">-14 (SPOTIFY)</span>
                  <span className="text-[#E60000]">-6 (BRICK)</span>
                </div>
              </div>
              <button onClick={handleMastering} className="mt-12 w-full bg-[#E60000] text-white py-5 font-oswald text-xl font-bold uppercase tracking-[0.3em] hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.2)] flex justify-center items-center gap-2">Initiate Final Master</button>
            </div>
          )}
        </div>
      )}

      {status === "processing" && (
        <div className="w-full max-w-xl bg-[#050505] border border-[#E60000]/30 p-10 rounded-lg relative overflow-hidden flex flex-col items-center">
          <Activity size={64} className="text-[#E60000] animate-bounce mb-8" />
          <div className="w-full h-1 bg-[#111] overflow-hidden mb-4"><div className="h-full bg-[#E60000] w-full animate-[pulse_1s_ease-in-out_infinite]" style={{ transformOrigin: "left", animationName: "scale-x" }}></div></div>
          <div className="w-full flex justify-between text-[9px] font-mono uppercase text-[#555]">
            <span>Rendering OfflineAudioContext</span>
            <span className="text-[#E60000]">Peak: -0.5dB Limit</span>
          </div>
        </div>
      )}

      {status === "success" && (
        <div className="flex flex-col items-center animate-in zoom-in duration-500 w-full max-w-xl space-y-4">
          <div className="w-full bg-[#0a0a0a] border border-[#333] p-6 flex justify-between items-center group hover:border-[#E60000] transition-colors">
             <div>
                <p className="text-[10px] text-[#E60000] font-mono uppercase tracking-widest mb-1 font-bold">Studio Export Ready</p>
                <p className="font-oswald text-xl text-white tracking-widest truncate">{audioData?.fileName?.replace(/\.[^/.]+$/, "") || "TRACK"}</p>
                <p className="text-[9px] text-[#555] font-mono uppercase mt-2">
                  {isFreeLoader ? "Contains: Master WAV Audio" : "Contains: Master WAV, Instrumentals, Vocal Stems, Lyrics PDF"}
                </p>
             </div>
             <button 
               onClick={handleArtifactExport}
               disabled={isZipping}
               className="bg-white text-black hover:bg-[#E60000] hover:text-white p-4 rounded-sm transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)] disabled:opacity-50 flex items-center justify-center"
             >
               {isZipping ? <Loader2 size={24} className="animate-spin" /> : 
                 isFreeLoader ? <Download size={24} /> : <FileArchive size={24} />
               }
             </button>
          </div>

          <div className="w-full flex flex-col gap-3">
            <button onClick={() => setActiveRoom("07")} className="w-full flex justify-center items-center gap-3 bg-[#E60000] text-white py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.2)]">Route to Distribution <ArrowRight size={20} /></button>
            
            <button 
              onClick={handleStartNewProject} 
              className="w-full border border-red-900/30 text-[#555] py-3 font-oswald text-xs font-bold uppercase tracking-widest hover:text-[#E60000] hover:border-[#E60000] transition-all flex justify-center items-center gap-2"
            >
              <Trash2 size={14} /> Start New Project (Purge Matrix)
            </button>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `@keyframes scale-x { 0% { transform: scaleX(0); } 100% { transform: scaleX(1); } }`}} />
    </div>
  );
}