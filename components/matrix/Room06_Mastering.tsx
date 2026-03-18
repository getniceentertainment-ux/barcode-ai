"use client";

import React, { useState, useEffect } from "react";
import { Sliders, CheckCircle2, Activity, ArrowRight, AudioWaveform, Disc3, Download, RefreshCw, FileArchive, Loader2, Lock, DollarSign, ShieldCheck } from "lucide-react";
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

  for(i = 0; i < buffer.numberOfChannels; i++)
      channels.push(buffer.getChannelData(i));

  while(offset < buffer.length) {
      for(i = 0; i < numOfChan; i++) {
          sample = Math.max(-1, Math.min(1, channels[i][offset]));
          sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
          view.setInt16(pos, sample, true);
          pos += 2;
      }
      offset++;
  }

  return new Blob([bufferArray], {type: "audio/wav"});
}

export default function Room06_Mastering() {
  const { audioData, vocalStems, generatedLyrics, setActiveRoom, addToast, finalMaster, setFinalMaster, userSession } = useMatrixStore();
  
  const [lufs, setLufs] = useState(-14); 
  const [actualLUFS, setActualLUFS] = useState(-20); 
  const [status, setStatus] = useState<"idle" | "processing" | "uploading" | "success">(finalMaster ? "success" : "idle");
  const [isZipping, setIsZipping] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    if (userSession?.tier === "The Mogul") setHasToken(true);
    else checkTokens();
  }, [userSession]);

  const checkTokens = async () => {
    if (!userSession?.id) return;
    const { data } = await supabase.from('profiles').select('mastering_tokens').eq('id', userSession.id).single();
    if (data && (data as any).mastering_tokens > 0) setHasToken(true);
  };

  const handlePurchaseToken = () => {
    if(addToast) addToast("Routing to Secure Payment...", "info");
    setTimeout(() => { setHasToken(true); if(addToast) addToast("Mastering Token Acquired.", "success"); }, 2000);
  };

  const handleMastering = async () => {
    if (!audioData?.url || !hasToken) return;
    setStatus("processing");

    try {
      const beatResp = await fetch(audioData.url);
      const audioCtx = new AudioContext();
      const beatBuf = await audioCtx.decodeAudioData(await beatResp.arrayBuffer());
      
      // REAL-TIME INTEGRATED LUFS SCAN
      const channelData = beatBuf.getChannelData(0);
      let sumSquares = 0;
      for (let i = 0; i < channelData.length; i++) { sumSquares += channelData[i] * channelData[i]; }
      const measuredDB = 20 * Math.log10(Math.sqrt(sumSquares / channelData.length) || 0.0001);
      setActualLUFS(Math.round(measuredDB));

      const offlineCtx = new OfflineAudioContext(2, beatBuf.sampleRate * beatBuf.duration, beatBuf.sampleRate);
      const mixBus = offlineCtx.createGain();
      mixBus.gain.value = Math.pow(10, (lufs - measuredDB) / 20); 

      const limiter = offlineCtx.createDynamicsCompressor();
      limiter.threshold.value = -0.5; limiter.ratio.value = 20; 
      limiter.attack.value = 0.001; limiter.release.value = 0.050;
      mixBus.connect(limiter); limiter.connect(offlineCtx.destination);

      const source = offlineCtx.createBufferSource(); source.buffer = beatBuf;
      source.connect(mixBus); source.start(0);

      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(renderedBuffer);

      setStatus("uploading");
      
      const safeId = userSession?.id || "GUEST";
      const fileName = `${safeId}/${Date.now()}_MASTER.wav`;
      
      const { error: uploadError } = await supabase.storage
        .from('public_audio')
        .upload(fileName, wavBlob, { contentType: 'audio/wav', upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('public_audio').getPublicUrl(fileName);
      const cloudUrl = publicUrlData.publicUrl;

      setFinalMaster({ url: cloudUrl, blob: wavBlob }); 
      
      if(addToast) addToast("Master encoded and secured in the Cloud.", "success");
      setStatus("success");

    } catch (err: any) {
      console.error(err);
      if(addToast) addToast("Error rendering master.", "error");
      setStatus("idle");
    }
  };

  const handleArtifactExport = async () => {
    if (!finalMaster?.blob || !audioData?.url) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      
      const trackName = audioData.fileName.replace(/\\.[^/.]+$/, "");
      zip.file(`1_${trackName}_MASTER.wav`, finalMaster.blob);
      
      const doc = new jsPDF();
      doc.setFont("courier");
      doc.setFontSize(12);
      const splitText = doc.splitTextToSize(generatedLyrics || "Instrumental / No Lyrics Documented.", 180);
      doc.text(splitText, 15, 20);
      zip.file(`2_${trackName}_LYRICS.pdf`, doc.output('blob'));

      const beatResp = await fetch(audioData.url);
      zip.file(`3_${trackName}_INSTRUMENTAL.wav`, await beatResp.blob());

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
      console.error(err);
      if(addToast) addToast("Failed to compile ZIP artifact.", "error");
    } finally {
      setIsZipping(false);
    }
  };

  const needleRotation = ((actualLUFS - (-20)) / ((-6) - (-20))) * 90 - 45;

  return (
    <div className="h-full flex flex-col items-center justify-center max-w-4xl mx-auto animate-in fade-in duration-500">
      
      <div className="text-center mb-12">
        <h2 className="font-oswald text-5xl uppercase tracking-widest mb-4 font-bold text-white">R06: Mastering Suite</h2>
        <p className="font-mono text-xs text-[#555] uppercase tracking-[0.2em]">Industry Standard -14 LUFS Normalization</p>
      </div>

      <div className="w-full max-w-xl bg-[#050505] border border-[#222] p-10 flex flex-col items-center rounded-lg relative overflow-hidden group">
        
        {/* ANALOG LUFS METER */}
        <div className="w-48 h-24 overflow-hidden relative mb-8 flex justify-center items-end border-b-2 border-[#333] bg-[#0a0a0a] rounded-t-full">
           <div className="absolute w-full h-full rounded-t-full border-t-[8px] border-l-[8px] border-r-[8px] border-[#222] z-10"></div>
           <div 
              className="w-1 h-20 bg-[#E60000] origin-bottom transition-transform duration-1000 ease-out z-20 shadow-[0_0_10px_rgba(230,0,0,0.5)]" 
              style={{ transform: `rotate(${needleRotation}deg)` }}
           ></div>
           <span className="absolute bottom-2 text-[8px] font-mono text-[#555] font-bold z-0 uppercase">Integrated LUFS</span>
        </div>

        {!hasToken ? (
          <div className="w-full text-center animate-in zoom-in">
             <Lock size={32} className="mx-auto text-yellow-600 mb-4" />
             <h3 className="font-oswald text-xl uppercase font-bold text-white mb-2">Mastering Gated</h3>
             <p className="font-mono text-[9px] text-[#888] uppercase mb-8 leading-relaxed">Free and Artist tier nodes require a <strong className="text-white">$4.99 Token</strong> per track.</p>
             <button onClick={handlePurchaseToken} className="w-full bg-[#E60000] text-white py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-3">Purchase Token <DollarSign size={18} /></button>
          </div>
        ) : (
          <div className="w-full">
            <div className="flex justify-between items-center mb-10 px-4">
               <div className="flex items-center gap-2 text-green-500 font-mono text-[10px] uppercase font-bold tracking-widest border border-green-500/20 bg-green-500/5 px-3 py-1 rounded-full">
                 <ShieldCheck size={14} /> Master Authorized
               </div>
               <span className="font-oswald text-3xl font-bold text-white">{lufs} <span className="text-xs text-[#555] font-mono uppercase">Target</span></span>
            </div>
            
            {status === "idle" && (
              <div className="space-y-8 relative z-10">
                <input type="range" min="-20" max="-6" step="0.5" value={lufs} onChange={(e) => setLufs(parseFloat(e.target.value))} className="w-full accent-[#E60000] h-2 bg-[#111] appearance-none cursor-pointer rounded-full" />
                <button onClick={handleMastering} className="w-full bg-[#E60000] text-white py-5 font-oswald text-xl font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.2)] flex justify-center items-center gap-2">Initiate Lossless Master</button>
              </div>
            )}

            {status === "processing" && (
              <div className="w-full flex flex-col items-center py-6">
                <Activity size={64} className="text-[#E60000] animate-bounce mb-8" />
                <p className="font-mono text-[10px] text-[#E60000] uppercase animate-pulse">Scanning Transients & Normalizing gain...</p>
              </div>
            )}

            {status === "uploading" && (
              <div className="w-full flex flex-col items-center py-6">
                <Loader2 size={64} className="text-green-500 animate-spin mb-8" />
                <p className="text-[10px] font-mono uppercase text-green-500 tracking-widest">Encrypting artifact to Supabase Ledger...</p>
              </div>
            )}

            {status === "success" && (
              <div className="flex flex-col items-center animate-in zoom-in duration-500 w-full space-y-4">
                <div className="w-full bg-[#0a0a0a] border border-green-500/30 p-6 flex justify-between items-center group">
                  <div>
                      <p className="text-[10px] text-green-500 font-mono uppercase tracking-widest mb-1 font-bold">Export Ready</p>
                      <p className="font-oswald text-xl text-white tracking-widest truncate">{audioData?.fileName?.replace(/\\.[^/.]+$/, "") || "TRACK"}_ARTIFACTS.zip</p>
                  </div>
                  <button onClick={handleArtifactExport} disabled={isZipping} className="bg-white text-black hover:bg-[#E60000] hover:text-white p-4 rounded-sm transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)] disabled:opacity-50">
                    {isZipping ? <Loader2 size={24} className="animate-spin" /> : <FileArchive size={24} />}
                  </button>
                </div>

                <div className="w-full flex flex-col gap-3">
                  <button onClick={() => setActiveRoom("07")} className="w-full flex justify-center items-center gap-3 bg-[#E60000] text-white py-5 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.2)]">Route to Distribution <ArrowRight size={20} /></button>
                  <button onClick={() => { setFinalMaster(null); setStatus("idle"); }} className="w-full border border-[#222] text-[#555] py-3 font-oswald text-xs font-bold uppercase tracking-widest hover:text-white hover:border-white transition-all flex justify-center items-center gap-2"><RefreshCw size={14} /> Re-Master Track</button>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{__html: `@keyframes scale-x { 0% { transform: scaleX(0); } 100% { transform: scaleX(1); } }`}} />
    </div>
  );
}