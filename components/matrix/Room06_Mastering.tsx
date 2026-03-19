"use client";

import React, { useState, useEffect } from "react";
import { Sliders, CheckCircle2, Activity, ArrowRight, AudioWaveform, Disc3, Download, RefreshCw, FileArchive, Loader2, Lock, DollarSign, ShieldCheck } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";
import JSZip from 'jszip';
import jsPDF from 'jspdf';
import PremiumButton from "./PremiumButton";

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
  const { 
    audioData, vocalStems, generatedLyrics, setActiveRoom, 
    addToast, finalMaster, setFinalMaster, userSession, spendMasteringToken 
  } = useMatrixStore();
  
  const [lufs, setLufs] = useState(-14); 
  const [actualLUFS, setActualLUFS] = useState(-20); 
  const [status, setStatus] = useState<"idle" | "processing" | "success">(finalMaster ? "success" : "idle");
  const [isZipping, setIsZipping] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (userSession?.tier === "The Mogul") {
      setHasToken(true);
    } else {
      checkTokens();
    }
  }, [userSession]);

  const checkTokens = async () => {
    if (!userSession?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('mastering_tokens, tier')
      .eq('id', userSession.id)
      .single();

    if (data) {
      const isMogul = (data as any).tier === "The Mogul";
      const tokenBalance = (data as any).mastering_tokens || 0;
      setHasToken(isMogul || tokenBalance > 0);
    }
  };

  const handlePurchaseToken = async () => {
    if (!userSession?.id) return;
    if(addToast) addToast("Routing to Secure Payment...", "info");
    
    // Logic for testing/unblocking - replace with Stripe redirect in prod
    const { error } = await supabase
      .from('profiles')
      .update({ mastering_tokens: 1 })
      .eq('id', userSession.id);

    if (!error) {
      setHasToken(true);
      if(addToast) addToast("Mastering Token Acquired.", "success");
    }
  };

  const handleMastering = async () => {
    if (isProcessing || !audioData?.url) return;

    // 🛡️ THE BOUNCER: Burn token in DB BEFORE rendering
    const authorized = await spendMasteringToken();
    if (!authorized) {
      setStatus("idle");
      return;
    }

    setIsProcessing(true);
    setStatus("processing");

    try {
      const tmpCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const beatResp = await fetch(audioData.url);
      const beatArrayBuf = await beatResp.arrayBuffer();
      const beatBuf = await tmpCtx.decodeAudioData(beatArrayBuf);
      let maxDuration = beatBuf.duration;

      const channelData = beatBuf.getChannelData(0);
      let sumSquares = 0;
      for (let i = 0; i < channelData.length; i++) { sumSquares += channelData[i] * channelData[i]; }
      const measuredDB = 20 * Math.log10(Math.sqrt(sumSquares / channelData.length) || 0.0001);
      setActualLUFS(Math.round(measuredDB));

      const offlineCtx = new OfflineAudioContext(2, tmpCtx.sampleRate * maxDuration, tmpCtx.sampleRate);
      const mixBus = offlineCtx.createGain();
      mixBus.gain.value = Math.pow(10, ((lufs - measuredDB) / 20)); 

      const limiter = offlineCtx.createDynamicsCompressor();
      limiter.threshold.value = -0.5; limiter.ratio.value = 20; 

      mixBus.connect(limiter);
      limiter.connect(offlineCtx.destination);

      const beatSource = offlineCtx.createBufferSource(); 
      beatSource.buffer = beatBuf;
      beatSource.connect(mixBus); 
      beatSource.start(0);

      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(renderedBuffer);
      const finalUrl = URL.createObjectURL(wavBlob);

      setFinalMaster({ url: finalUrl, blob: wavBlob }); 
      if(addToast) addToast("Commercial Master generated.", "success");
      setStatus("success");
    } catch (err: any) {
      if(addToast) addToast("Mastering engine failed.", "error");
      setStatus("idle");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleArtifactExport = async () => {
    if (!finalMaster?.blob || !audioData?.url) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const trackName = audioData.fileName.replace(/\.[^/.]+$/, "");
      zip.file(`1_${trackName}_MASTER.wav`, finalMaster.blob);

      const doc = new jsPDF();
      doc.setFont("courier");
      const splitText = doc.splitTextToSize(generatedLyrics || "Instrumental / No Lyrics Documented.", 180);
      doc.text(splitText, 15, 20);
      zip.file(`2_${trackName}_LYRICS.pdf`, doc.output('blob'));

      const beatResp = await fetch(audioData.url);
      zip.file(`3_${trackName}_INSTRUMENTAL.wav`, await beatResp.blob());

      const stemsFolder = zip.folder("RAW_VOCAL_STEMS");
      vocalStems.forEach((stem, index) => {
        if (stem.blob && stemsFolder) stemsFolder.file(`Vocal_Take_${index + 1}.webm`, stem.blob);
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(zipBlob);
      a.download = `${trackName}_STUDIO_ARTIFACTS.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if(addToast) addToast("ZIP Artifact Ready.", "success");
    } catch (err) {
      if(addToast) addToast("Export failed.", "error");
    } finally {
      setIsZipping(false);
    }
  };

  const needleRotation = ((actualLUFS - (-20)) / ((-6) - (-20))) * 90 - 45;

  return (
    <div className="h-full flex flex-col items-center justify-center max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="text-center mb-12">
        <h2 className="font-oswald text-5xl uppercase tracking-widest mb-4 font-bold text-white">R06: Mastering Suite</h2>
        <p className="font-mono text-xs text-[#555] uppercase tracking-[0.2em]">Final Output Limiters // LUFS Normalization</p>
      </div>

      {status === "idle" && (
        <div className="w-full max-w-xl bg-[#050505] border border-[#222] p-10 flex flex-col items-center rounded-lg relative overflow-hidden group hover:border-[#E60000]/50 transition-all duration-500">
          <div className="w-48 h-24 overflow-hidden relative mb-8 flex justify-center items-end border-b-2 border-[#333] bg-[#0a0a0a] rounded-t-full">
             <div className="w-1 h-20 bg-[#E60000] origin-bottom transition-transform duration-300" style={{ transform: `rotate(${needleRotation}deg)` }}></div>
             <span className="absolute bottom-2 text-[8px] font-mono text-[#555] font-bold">LUFS METER</span>
          </div>

          {!hasToken ? (
            <div className="w-full text-center animate-in zoom-in mb-8 relative z-10">
               <Lock size={32} className="mx-auto text-yellow-600 mb-4" />
               <h3 className="font-oswald text-xl uppercase font-bold text-white mb-2">Mastering Gated</h3>
               <p className="font-mono text-[9px] text-[#888] uppercase mb-8">Node requires a <strong className="text-white">$4.99 Token</strong> per track.</p>
               <button onClick={handlePurchaseToken} className="w-full bg-[#E60000] text-white py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-2">Purchase Token <DollarSign size={18} /></button>
            </div>
          ) : (
            <div className="w-full mb-12 relative z-10">
              <div className="flex justify-between items-center mb-10">
                 <div className="flex items-center gap-2 text-green-500 font-mono text-[10px] uppercase font-bold tracking-widest border border-green-500/20 bg-green-500/5 px-3 py-1 rounded-full"><ShieldCheck size={14} /> Master Authorized</div>
                 <span className="font-oswald text-3xl font-bold text-white">{lufs} <span className="text-xs font-mono text-[#555]">LUFS</span></span>
              </div>
              <input type="range" min="-20" max="-6" step="0.5" value={lufs} onChange={(e) => setLufs(parseFloat(e.target.value))} className="w-full accent-[#E60000] h-2 bg-[#111] appearance-none cursor-pointer rounded-full" />
              <PremiumButton 
 	 cost={0} 
 	 isMogulOnly={true} 
  	onConfirm={handleStartMastering} // ✅ Change this to match your function name
 	 className="..."
	>
  	Finalize & Master Artifact
	</PremiumButton>
            </div>
          )}
        </div>
      )}

      {status === "processing" && (
        <div className="w-full max-w-xl bg-[#050505] border border-[#E60000]/30 p-10 rounded-lg flex flex-col items-center">
          <Activity size={64} className="text-[#E60000] animate-bounce mb-8" />
          <div className="w-full h-1 bg-[#111] overflow-hidden mb-4"><div className="h-full bg-[#E60000] w-full animate-pulse"></div></div>
          <span className="font-mono text-[9px] uppercase text-[#E60000]">Peak: -0.5dB Limit</span>
        </div>
      )}

      {status === "success" && (
        <div className="flex flex-col items-center animate-in zoom-in w-full max-w-xl space-y-4">
          <button onClick={handleArtifactExport} disabled={isZipping} className="w-full bg-[#0a0a0a] border border-[#333] p-6 flex justify-between items-center hover:border-[#E60000] transition-colors">
             <div className="text-left">
                <p className="text-[10px] text-green-500 font-mono uppercase font-bold">Studio Export Ready</p>
                <p className="font-oswald text-xl text-white truncate">DOWNLOAD ARTIFACTS (.ZIP)</p>
             </div>
             {isZipping ? <Loader2 size={24} className="animate-spin" /> : <FileArchive size={24} />}
          </button>
          <button onClick={() => setActiveRoom("07")} className="w-full bg-[#E60000] text-white py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex justify-center items-center gap-2">Route to Distribution <ArrowRight size={20} /></button>
          <button onClick={() => { setFinalMaster(null); setStatus("idle"); }} className="text-[#555] text-xs font-bold uppercase tracking-widest hover:text-white flex items-center gap-2"><RefreshCw size={14} /> Re-Master Track</button>
        </div>
      )}
    </div>
  );
}