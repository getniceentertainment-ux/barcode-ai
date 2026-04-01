"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  UploadCloud, 
  FileAudio, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Music, 
  ArrowRight, 
  Zap, 
  Activity, 
  Network, 
  Play, 
  Pause, 
  Trash2, 
  Lock,
  FlaskConical 
} from "lucide-react";
import WaveSurfer from 'wavesurfer.js';
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

// --- SURGICAL ADDITION: The Silent Extractor ---
const getExactAudioDuration = (url: string): Promise<number> => {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => {
      resolve(audio.duration);
    });
    audio.addEventListener('error', () => {
      resolve(0); 
    });
  });
};

export default function Room01_Lab() {
  const { audioData, setAudioData, setActiveRoom, addToast, userSession } = useMatrixStore();
  
  // --- PERSISTENCE INITIALIZATION ---
  // We initialize status based on existing store data to prevent UI "flicker" or loss of state on refresh
  const [status, setStatus] = useState<"idle" | "uploading" | "analyzing" | "success">(
    audioData?.bpm ? "success" : "idle"
  );
  const [analysisComplete, setAnalysisComplete] = useState(!!audioData?.bpm);
  const [dragActive, setDragActive] = useState(false);
  const [isDisclaimerAccepted, setIsDisclaimerAccepted] = useState(false);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Audio Preview / Marketplace State
  const [beats, setBeats] = useState<any[]>([]);
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Waveform State
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  // --- MONETIZATION: CREDIT CHECK ---
  const CREATOR_ID = process.env.NEXT_PUBLIC_CREATOR_ID;
  const isCreator = userSession?.id && userSession.id === CREATOR_ID;
  const hasCredits = isCreator || (userSession?.creditsRemaining && (userSession.creditsRemaining === "UNLIMITED" || userSession.creditsRemaining > 0));

  // --- WAVESURFER LIFECYCLE ---
  useEffect(() => {
    if (waveformRef.current && audioData?.url && !wavesurferRef.current) {
      wavesurferRef.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#333333',
        progressColor: '#E60000',
        cursorColor: '#ffffff',
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 80,
        normalize: true,
      });

      wavesurferRef.current.load(audioData.url);
      wavesurferRef.current.on('finish', () => setIsPlaying(false));
      wavesurferRef.current.on('ready', () => {
         const duration = wavesurferRef.current?.getDuration() || 0;
         if (duration > 0 && audioData && !audioData.duration) {
             setAudioData({ ...audioData, duration });
         }
      });
    }

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [audioData?.url]); // Only re-init if the URL changes

  // --- FETCH MARKETPLACE BEATS ---
  useEffect(() => {
    const fetchMarketplaceBeats = async () => {
      try {
        const { data, error } = await supabase.storage.from('marketplace_beats').list();
        if (error) throw error;
        
        if (data && data.length > 0) {
          const fetchedBeats = data
            .filter(file => file.name.endsWith('.mp3') || file.name.endsWith('.wav'))
            .map((file, index) => {
              const bpmMatch = file.name.match(/_?(\d+)\s*BPM/i);
              const bpm = bpmMatch ? parseInt(bpmMatch[1]) : 120;
              
              let calculatedLeasePrice = 29.99;
              if (bpm >= 140) calculatedLeasePrice = 149.99;
              else if (bpm >= 125) calculatedLeasePrice = 99.99;
              else if (bpm >= 110) calculatedLeasePrice = 49.99;

              const { data: urlData } = supabase.storage.from('marketplace_beats').getPublicUrl(file.name);
              const cleanTitle = file.name.replace(/\.(mp3|wav)$/i, '').replace(/_?\d+\s*BPM/i, '').replace(/_/g, ' ').trim();

              return { 
                id: `supa_${index}`, 
                title: cleanTitle || file.name, 
                producer: "GetNice Node", 
                url: urlData.publicUrl, 
                leasePrice: calculatedLeasePrice,
                exclusivePrice: 500.00, 
                bpm: bpm,
                key: "Unknown"
              };
            });
          setBeats(fetchedBeats);
        }
      } catch (err) {
        console.error("Failed to load beats:", err);
      }
    };
    fetchMarketplaceBeats();
  }, []);

  // --- STRIPE REDIRECT HANDLER ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('beat_purchased') === 'true') {
        const beatUrl = params.get('beat_url');
        let beatName = params.get('beat_name');
        if (beatUrl) {
          if (!beatName) {
            try {
              const urlParts = beatUrl.split('/');
              beatName = decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]);
            } catch (err) {
              beatName = "Purchased_Beat.mp3";
            }
          }
          window.history.replaceState({}, document.title, window.location.pathname);
          setIsDisclaimerAccepted(true); 
          if (addToast) addToast(`License Acquired: ${beatName}`, "success");
          setTimeout(() => handlePurchasedBeatDSP(beatUrl, beatName || "Beat.mp3"), 500);
        }
      }
    }
  }, []);

  // --- CORE DSP LOGIC ---
  const pollDSPJob = (jobId: string, cloudUrl: string, fileName: string) => {
    let attempts = 0;
    setStatus("analyzing");
    
    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      setPollingAttempts(attempts);
      
      try {
        const statusRes = await fetch(`/api/dsp?jobId=${jobId}&t=${Date.now()}`);
        const statusData = await statusRes.json();

        if (statusData.status === 'COMPLETED') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          
          const exactDuration = await getExactAudioDuration(cloudUrl);
          const output = statusData.output;

          setAudioData({
            url: cloudUrl,
            fileName: fileName,
            bpm: output.bpm || 120,
            totalBars: output.total_bars || Math.round(((exactDuration || 180) / 60) * (output.bpm || 120) / 4),
            key: output.key || "Unknown",
            grid: output.grid || output.beats || [],
            duration: exactDuration > 0 ? exactDuration : undefined
          });

          setStatus("success");
          setAnalysisComplete(true);
          if (addToast) addToast("Smart Analysis Complete.", "success");

        } else if (statusData.status === 'FAILED') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setStatus("idle");
          if (addToast) addToast("DSP Execution Failed.", "error");
        }
      } catch (pollErr) {
        console.error("DSP Polling Error", pollErr);
      }
    }, 3000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile || !userSession?.id) return;

    if (!selectedFile.type.includes("audio/")) {
      if (addToast) addToast("Invalid artifact. Audio files only.", "error");
      return;
    }
    
    setStatus("uploading");
    setIsUploading(true);

    try {
      const filePath = `${userSession.id}/${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from('audio_raw').upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('audio_raw').getPublicUrl(filePath);
      const currentCloudUrl = publicUrlData.publicUrl;

      setAudioData({ url: currentCloudUrl, fileName: selectedFile.name, bpm: 0, totalBars: 0 });
      setStatus("idle"); // Ready to analyze
    } catch (err: any) {
      if (addToast) addToast(err.message, "error");
      setStatus("idle");
    } finally {
      setIsUploading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!audioData?.url || !hasCredits) return;
    setStatus("analyzing");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/dsp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ file_url: audioData.url })
      });

      const initData = await res.json();
      if (!res.ok) throw new Error(initData.error || "DSP Init failed");
      if (initData.jobId) pollDSPJob(initData.jobId, audioData.url, audioData.fileName);
    } catch (err: any) {
      if (addToast) addToast(err.message, "error");
      setStatus("idle");
    }
  };

  const handlePurchasedBeatDSP = async (beatUrl: string, beatName: string) => {
    setStatus("analyzing");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/dsp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ file_url: beatUrl })
      });
      const initData = await res.json();
      if (initData.jobId) pollDSPJob(initData.jobId, beatUrl, beatName);
    } catch (err: any) {
      if (addToast) addToast(err.message, "error");
      setStatus("idle");
    }
  };

  const handleMarketplaceSelect = async (beat: any, licenseType: 'lease' | 'exclusive') => {
    if (!isDisclaimerAccepted) {
      if (addToast) addToast("Please accept the IP Declaration first.", "error");
      return;
    }
    const price = licenseType === 'lease' ? beat.leasePrice : beat.exclusivePrice;
    try {
      const res = await fetch('/api/stripe/beat-lease', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beatName: `${beat.title} (${licenseType})`,
          beatUrl: beat.url,
          price: price,
          userId: userSession?.id
        })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      if (addToast) addToast(err.message, "error");
    }
  };

  const togglePlayback = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
      setIsPlaying(wavesurferRef.current.isPlaying());
    }
  };

  const togglePreview = (url: string) => {
    if (playingPreview === url) {
      previewAudioRef.current?.pause();
      setPlayingPreview(null);
    } else {
      setPlayingPreview(url);
      if (previewAudioRef.current) {
        previewAudioRef.current.src = url;
        previewAudioRef.current.play();
      }
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-8 animate-in fade-in duration-500">
      <audio ref={previewAudioRef} onEnded={() => setPlayingPreview(null)} className="hidden" />

      {/* LEFT COLUMN: UPLOAD & DSP */}
      <div className="flex-1 flex flex-col">
        <div className="mb-6">
          <h2 className="font-oswald text-3xl uppercase tracking-widest font-bold text-white flex items-center gap-3">
            <FlaskConical className="text-[#E60000]" /> Room 01 // The Lab
          </h2>
          <p className="font-mono text-[10px] text-[#888] uppercase tracking-widest mt-2">
            Initialize Digital Signal Processing (DSP) & BPM Extraction
          </p>
        </div>

        <div className="flex-1 border border-[#222] bg-[#050505] rounded-lg relative overflow-hidden flex flex-col items-center justify-center min-h-[450px]">
          
          {!audioData ? (
            <div className="text-center p-10">
               <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
               <div 
                 onClick={() => isDisclaimerAccepted ? fileInputRef.current?.click() : addToast?.("Accept IP Declaration first.", "error")}
                 className={`w-24 h-24 rounded-full bg-[#111] border border-[#222] flex items-center justify-center mb-6 mx-auto cursor-pointer hover:border-[#E60000] transition-all ${!isDisclaimerAccepted && 'opacity-30'}`}
               >
                 {isUploading ? <Loader2 className="text-[#E60000] animate-spin" size={32} /> : <UploadCloud size={32} className="text-[#555]" />}
               </div>
               <h3 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-2">Initialize Substrate</h3>
               <p className="font-mono text-[10px] text-[#555] uppercase tracking-widest">Drop MP3/WAV (Max 20MB)</p>
            </div>
          ) : (
            <div className="w-full p-8 animate-in zoom-in duration-300">
                <div className="flex justify-between items-center mb-6">
                   <div className="flex items-center gap-3">
                     <Music className="text-[#E60000]" size={18} />
                     <span className="font-mono text-[10px] text-white uppercase tracking-widest truncate max-w-[200px]">{audioData.fileName}</span>
                   </div>
                   <button onClick={() => { setAudioData(null); setStatus("idle"); setAnalysisComplete(false); }} className="text-[#555] hover:text-[#E60000] transition-colors font-mono text-[10px] uppercase flex items-center gap-1">
                     <Trash2 size={12} /> Eject
                   </button>
                </div>

                <div className="bg-black border border-[#111] p-4 rounded-lg mb-6 flex items-center gap-4">
                  <button onClick={togglePlayback} className="w-12 h-12 rounded-full bg-[#E60000] flex items-center justify-center shrink-0">
                    {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
                  </button>
                  <div ref={waveformRef} className="flex-1" />
                </div>

                {!analysisComplete ? (
                  <div className="relative">
                    {!hasCredits && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-10 border border-[#E60000]/20 rounded-lg">
                        <Lock size={20} className="text-[#E60000] mb-2" />
                        <span className="font-mono text-[10px] uppercase text-white">Insufficient Credits</span>
                      </div>
                    )}
                    <button 
                      onClick={handleAnalyze}
                      disabled={status === "analyzing" || !hasCredits}
                      className="w-full bg-[#111] border border-[#222] py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all flex items-center justify-center gap-3 rounded-lg"
                    >
                      {status === "analyzing" ? (
                        <><Loader2 className="animate-spin" /> Analyzing...</>
                      ) : (
                        <><Activity size={18} /> Run DSP Diagnostics <Zap size={14} className="text-[#E60000]" /></>
                      )}
                    </button>
                    {status === "analyzing" && (
                      <p className="text-center font-mono text-[9px] text-[#E60000] mt-3 uppercase animate-pulse">Compute Attempt: {pollingAttempts}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-black border border-[#111] p-4 rounded text-center">
                        <span className="block text-[8px] font-mono text-[#555] uppercase mb-1">Tempo</span>
                        <span className="font-oswald text-xl text-[#E60000] font-bold">{Math.round(audioData.bpm)}</span>
                      </div>
                      <div className="bg-black border border-[#111] p-4 rounded text-center">
                        <span className="block text-[8px] font-mono text-[#555] uppercase mb-1">Key</span>
                        <span className="font-oswald text-xl text-white font-bold">{audioData.key}</span>
                      </div>
                      <div className="bg-black border border-[#111] p-4 rounded text-center">
                        <span className="block text-[8px] font-mono text-[#555] uppercase mb-1">Bars</span>
                        <span className="font-oswald text-xl text-white font-bold">{audioData.totalBars}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setActiveRoom("02")}
                      className="w-full bg-white text-black py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all flex items-center justify-center gap-2 rounded-lg"
                    >
                      Advance to Brain Train <ArrowRight size={18} />
                    </button>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* IP DISCLAIMER */}
        <div 
          onClick={() => setIsDisclaimerAccepted(!isDisclaimerAccepted)}
          className={`mt-6 border p-5 flex gap-4 items-start rounded-sm transition-all cursor-pointer select-none
            ${isDisclaimerAccepted ? 'border-[#E60000] bg-[#110000]' : 'border-[#222] bg-[#0a0a0a] hover:bg-[#110000]'}`}
        >
          <input type="checkbox" checked={isDisclaimerAccepted} onChange={() => {}} className="accent-[#E60000] w-5 h-5 mt-0.5" />
          <div>
            <h4 className="font-oswald text-sm uppercase tracking-widest font-bold text-[#E60000] mb-1 flex items-center gap-2">
              <ShieldCheck size={16} /> IP & Licensing Declaration
            </h4>
            <p className="font-mono text-[9px] text-[#888] uppercase leading-relaxed">
              I attest this artifact is original and 100% owned work. 
              Bar-Code.ai acts as a processing conduit and prohibits unauthorized copyrighted material.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: MARKETPLACE */}
      <div className="w-full lg:w-96 flex flex-col bg-[#050505] border border-[#111] p-6">
        <div className="mb-6 pb-6 border-b border-[#111]">
          <h3 className="font-oswald text-xl uppercase tracking-widest font-bold text-white mb-2 flex items-center gap-2">
            <AlertTriangle size={16} className="text-yellow-500" /> Need a Canvas?
          </h3>
          <p className="font-mono text-[9px] text-[#666] uppercase tracking-widest">
            Pull royalty-free structural canvases from the A&R Neural Network.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
          {beats.length === 0 ? (
            <div className="text-center py-10"><Loader2 size={16} className="animate-spin mx-auto mb-2 text-[#E60000]" /><span className="text-[9px] font-mono text-[#555]">Syncing Ledger...</span></div>
          ) : beats.map((beat) => (
            <div key={beat.id} className="bg-black border border-[#111] p-4 hover:border-[#E60000] transition-all group">
              <div className="flex items-center gap-3 mb-4">
                <button 
                  onClick={() => togglePreview(beat.url)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${playingPreview === beat.url ? 'bg-[#E60000] text-white' : 'bg-[#111] text-[#555]'}`}
                >
                  {playingPreview === beat.url ? <Pause size={14} /> : <Play size={14} className="ml-1" />}
                </button>
                <div>
                  <h4 className="font-oswald text-sm uppercase tracking-widest font-bold text-white group-hover:text-[#E60000] transition-colors">{beat.title}</h4>
                  <p className="font-mono text-[8px] text-[#555] uppercase">{beat.bpm} BPM // {beat.producer}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleMarketplaceSelect(beat, 'lease')} className="bg-[#111] text-[#888] py-2 text-[9px] font-bold uppercase hover:bg-white hover:text-black transition-all">
                  ${beat.leasePrice.toFixed(2)} Lease
                </button>
                <button onClick={() => handleMarketplaceSelect(beat, 'exclusive')} className="border border-yellow-500/30 text-yellow-500 py-2 text-[9px] font-bold uppercase hover:bg-yellow-500 hover:text-black transition-all">
                   Buyout
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}