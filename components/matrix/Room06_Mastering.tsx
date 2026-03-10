"use client";

import React, { useState } from "react";
import { Sliders, CheckCircle2, Activity, ArrowRight, RefreshCw, FileArchive, Loader2 } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import JSZip from 'jszip';
import jsPDF from 'jspdf';
// @ts-ignore
import lamejs from 'lamejs';
// @ts-ignore
import { ID3Writer } from 'browser-id3-writer';

function encodeMP3AndTag(buffer: AudioBuffer, title: string, artistId: string, bpm: number, lyrics: string): Blob {
  const sampleRate = buffer.sampleRate;
  const mp3encoder = new lamejs.Mp3Encoder(buffer.numberOfChannels, sampleRate, 192); // 192kbps MP3
  const mp3Data = [];

  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  const sampleBlockSize = 1152; 

  // Convert Float32 to Int16
  const leftInt16 = new Int16Array(left.length);
  const rightInt16 = new Int16Array(right.length);
  for (let i = 0; i < left.length; i++) {
    leftInt16[i] = left[i] < 0 ? left[i] * 32768 : left[i] * 32767;
    rightInt16[i] = right[i] < 0 ? right[i] * 32768 : right[i] * 32767;
  }

  for (let i = 0; i < leftInt16.length; i += sampleBlockSize) {
    const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
    const rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
    const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    if (mp3buf.length > 0) mp3Data.push(mp3buf);
  }
  
  const finalBuf = mp3encoder.flush();
  if (finalBuf.length > 0) mp3Data.push(finalBuf);

  // Combine MP3 chunks into an ArrayBuffer
  const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
  const reader = new FileReader();
  
  // We use synchronous-like behavior by awaiting the file read in the main handler, 
  // but for simplicity in the blob generator, we return the raw blob and tag it later.
  return mp3Blob;
}

export default function Room06_Mastering() {
  const { audioData, vocalStems, generatedLyrics, userSession, setActiveRoom, addToast, finalMaster, setFinalMaster } = useMatrixStore();
  
  const [lufs, setLufs] = useState(-14); 
  const [status, setStatus] = useState<"idle" | "processing" | "success">(finalMaster ? "success" : "idle");
  const [isZipping, setIsZipping] = useState(false);

  const handleMastering = async () => {
    if (!audioData?.url) { addToast("No instrumental beat detected.", "error"); return; }
    setStatus("processing");

    try {
      const beatUrl = audioData.url;
      const vocalUrl = vocalStems.length > 0 ? vocalStems[0].url : null;
      const tmpCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

      const beatResp = await fetch(beatUrl);
      const beatBuf = await tmpCtx.decodeAudioData(await beatResp.arrayBuffer());
      let maxDuration = beatBuf.duration;

      let vocalBuf: AudioBuffer | null = null;
      if (vocalUrl) {
        const vocalResp = await fetch(vocalUrl);
        vocalBuf = await tmpCtx.decodeAudioData(await vocalResp.arrayBuffer());
        if (vocalBuf.duration > maxDuration) maxDuration = vocalBuf.duration;
      }

      const offlineCtx = new OfflineAudioContext(2, tmpCtx.sampleRate * maxDuration, tmpCtx.sampleRate);
      const mixBus = offlineCtx.createGain();
      mixBus.gain.value = Math.pow(10, ((lufs - (-14)) / 20)); 

      const limiter = offlineCtx.createDynamicsCompressor();
      limiter.threshold.value = -0.5; limiter.knee.value = 0; limiter.ratio.value = 20; 
      limiter.attack.value = 0.001; limiter.release.value = 0.050;

      mixBus.connect(limiter); limiter.connect(offlineCtx.destination);

      const beatSource = offlineCtx.createBufferSource(); beatSource.buffer = beatBuf;
      const beatGain = offlineCtx.createGain(); beatGain.gain.value = vocalBuf ? 0.75 : 1.0; 
      beatSource.connect(beatGain); beatGain.connect(mixBus); beatSource.start(0);

      if (vocalBuf) {
        const vocalSource = offlineCtx.createBufferSource(); vocalSource.buffer = vocalBuf;
        const vocalGain = offlineCtx.createGain(); vocalGain.gain.value = 1.2; 
        vocalSource.connect(vocalGain); vocalGain.connect(mixBus); vocalSource.start(0);
      }

      const renderedBuffer = await offlineCtx.startRendering();
      
      // 1. Encode to MP3 (LAME)
      const rawMp3Blob = encodeMP3AndTag(renderedBuffer, audioData.fileName || "TRACK", userSession?.id || "BARCODE_USER", audioData.bpm || 120, generatedLyrics || "No Lyrics");
      
      // 2. Read ArrayBuffer to inject ID3 Tags
      const arrayBuffer = await rawMp3Blob.arrayBuffer();
      const writer = new ID3Writer(arrayBuffer);
      writer.setFrame('TIT2', audioData.fileName?.replace(/\.[^/.]+$/, "") || 'BAR_CODE_MASTER')
            .setFrame('TPE1', [`GetNice Artist: ${userSession?.id?.substring(0,8) || 'UNKNOWN'}`])
            .setFrame('TBPM', Math.round(audioData.bpm || 120))
            .setFrame('USLT', { description: 'TALON Engine Lyrics', lyrics: generatedLyrics || 'Instrumental' });
      writer.addTag();
      
      const taggedMp3Blob = new Blob([writer.arrayBuffer], { type: 'audio/mp3' });
      const finalUrl = URL.createObjectURL(taggedMp3Blob);

      setFinalMaster({ url: finalUrl, blob: taggedMp3Blob }); 
      
      if(addToast) addToast("Master encoded to Tagged MP3.", "success");
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
      const trackName = audioData.fileName.replace(/\.[^/.]+$/, "");

      // 1. The Final Master MP3 (Now with ID3 Tags)
      zip.file(`1_${trackName}_MASTER.mp3`, finalMaster.blob);

      // 2. The PDF Lyrics Sheet
      const doc = new jsPDF();
      doc.setFont("courier"); doc.setFontSize(12);
      const splitText = doc.splitTextToSize(generatedLyrics || "Instrumental", 180);
      doc.text(splitText, 15, 20);
      zip.file(`2_${trackName}_LYRICS.pdf`, doc.output('blob'));

      // 3. Raw Assets
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
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      
      if(addToast) addToast("Studio Artifact ZIP Downloaded.", "success");
    } catch (err) {
      console.error(err);
      if(addToast) addToast("Failed to compile ZIP artifact.", "error");
    } finally {
      setIsZipping(false);
    }
  };

  const needleRotation = ((lufs - (-20)) / ((-6) - (-20))) * 90 - 45;

  return (
    <div className="h-full flex flex-col items-center justify-center max-w-4xl mx-auto animate-in fade-in duration-500">
      
      <div className="text-center mb-12">
        <h2 className="font-oswald text-5xl uppercase tracking-widest mb-4 font-bold text-white">
          R06: Mastering Suite
        </h2>
        {status === "idle" && <p className="font-mono text-xs text-[#555] uppercase tracking-[0.2em]">Analog Emulation // 192kbps MP3 ID3 Tagger</p>}
        {status === "success" && <p className="font-mono text-xs text-green-500 uppercase tracking-[0.2em]">Metadata Burned // Ready for Distribution</p>}
      </div>

      {status === "idle" && (
        <div className="w-full max-w-xl bg-[#050505] border border-[#222] p-10 flex flex-col items-center rounded-lg relative overflow-hidden group hover:border-[#E60000]/50 transition-all duration-500">
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#222 1px, transparent 1px), linear-gradient(90deg, #222 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          
          <div className="w-48 h-24 overflow-hidden relative mb-8 flex justify-center items-end border-b-2 border-[#333] bg-[#0a0a0a] rounded-t-full">
             <div className="absolute w-full h-full rounded-t-full border-t-[8px] border-l-[8px] border-r-[8px] border-[#222] z-10"></div>
             <div className="w-1 h-20 bg-[#E60000] origin-bottom transition-transform duration-300 ease-out z-20 shadow-[0_0_10px_rgba(230,0,0,0.5)]" style={{ transform: `rotate(${needleRotation}deg)` }}></div>
             <span className="absolute bottom-2 text-[8px] font-mono text-[#555] font-bold z-0">LUFS METER</span>
          </div>

          <div className="w-full mb-12 relative z-10">
            <div className="flex justify-between items-end text-[10px] uppercase font-bold text-[#888] mb-6">
              <span className="flex items-center gap-2"><Sliders size={14} className="text-[#E60000]" /> Target Loudness</span>
              <span className={`font-oswald text-3xl font-bold ${lufs > -10 ? 'text-[#E60000]' : lufs > -12 ? 'text-yellow-500' : 'text-white'}`}>
                {lufs} <span className="text-xs font-mono text-[#555]">LUFS</span>
              </span>
            </div>
            <div className="relative">
              <input type="range" min="-20" max="-6" step="0.5" value={lufs} onChange={(e) => setLufs(parseFloat(e.target.value))} className="w-full accent-[#E60000] h-2 bg-[#111] appearance-none cursor-pointer rounded-full relative z-10" />
              <div className="flex justify-between text-[8px] font-mono text-[#444] mt-3 absolute w-full -bottom-6">
                <span>-20 (VINYL)</span><span className="text-white border-b border-white">-14 (SPOTIFY)</span><span className="text-[#E60000]">-6 (BRICK)</span>
              </div>
            </div>
          </div>
          <button onClick={handleMastering} className="relative z-10 w-full bg-[#E60000] text-white py-5 font-oswald text-xl font-bold uppercase tracking-[0.3em] hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(230,0,0,0.2)] flex justify-center items-center gap-2">Encode Tagged MP3 Master</button>
        </div>
      )}

      {status === "processing" && (
        <div className="w-full max-w-xl bg-[#050505] border border-[#E60000]/30 p-10 rounded-lg relative overflow-hidden flex flex-col items-center">
          <Activity size={64} className="text-[#E60000] animate-bounce mb-8" />
          <div className="w-full h-1 bg-[#111] overflow-hidden mb-4"><div className="h-full bg-[#E60000] w-full animate-[pulse_1s_ease-in-out_infinite]" style={{ transformOrigin: "left", animationName: "scale-x" }}></div></div>
          <div className="w-full flex justify-between text-[9px] font-mono uppercase text-[#555]">
            <span>Encoding 192kbps LAME MP3</span>
            <span className="text-[#E60000]">Injecting ID3 Meta-Tags</span>
          </div>
        </div>
      )}

      {status === "success" && (
        <div className="flex flex-col items-center animate-in zoom-in duration-500 w-full max-w-xl space-y-4">
          <div className="w-full bg-[#0a0a0a] border border-[#333] p-6 flex justify-between items-center group hover:border-[#E60000] transition-colors">
             <div>
                <p className="text-[10px] text-[#E60000] font-mono uppercase tracking-widest mb-1 font-bold">Studio Export Ready</p>
                <p className="font-oswald text-xl text-white tracking-widest truncate">{audioData?.fileName?.replace(/\.[^/.]+$/, "") || "TRACK"}_ARTIFACTS.zip</p>
                <p className="text-[9px] text-[#555] font-mono uppercase mt-2">Contains: ID3-Tagged MP3, Instrumental, Stems, Lyrics PDF</p>
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
      <style dangerouslySetInnerHTML={{__html: `@keyframes scale-x { 0% { transform: scaleX(0); } 100% { transform: scaleX(1); } }`}} />
    </div>
  );
}