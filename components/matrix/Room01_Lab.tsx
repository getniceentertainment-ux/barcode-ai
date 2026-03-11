"use client";

import React, { useState, useRef, useEffect } from "react";
import { UploadCloud, DollarSign, Loader2, CheckCircle2, Activity, Zap, ShoppingCart } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function Room01_Lab() {
  const { audioData, setAudioData, setActiveRoom, userSession, addToast } = useMatrixStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [status, setStatus] = useState<"idle" | "uploading" | "separating" | "analyzing" | "success">(audioData ? "success" : "idle");
  const [useDemucs, setUseDemucs] = useState(false);
  const [purchasingBeat, setPurchasingBeat] = useState<string | null>(null);
  
  const beats = [
    { name: "GN_Beat_01_Drill_142BPM.mp3", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", price: 149.99 },
    { name: "GN_Beat_02_Trap_120BPM.mp3", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", price: 49.99 },
    { name: "GN_Beat_03_BoomBap_90BPM.mp3", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", price: 29.99 }
  ];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('beat_purchased') === 'true') {
        const beatUrl = params.get('beat_url');
        const beatName = params.get('beat_name');
        
        if (beatUrl && beatName) {
          window.history.replaceState({}, document.title, window.location.pathname);
          executeDSPAfterPurchase(beatUrl, beatName);
        }
      }
    }
  }, []);

  const executeDSPAfterPurchase = async (fileUrl: string, fileName: string) => {
    setStatus("analyzing");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Security Exception: Missing Session Token. Please log in.");

      const res = await fetch('/api/dsp', { 
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ file_url: fileUrl, userId: userSession?.id }) 
      });
      
      const rawText = await res.text();
      let analysis;
      try {
        analysis = JSON.parse(rawText);
      } catch (parseError) {
        throw new Error(`Server Connection Failed (Status ${res.status}): ${rawText.substring(0, 60)}...`);
      }

      if (!res.ok) throw new Error(analysis.error || `DSP Processing failed (Status ${res.status})`);
      
      setAudioData({
        url: fileUrl,
        fileName: fileName,
        bpm: analysis.bpm || 120, 
        totalBars: analysis.total_bars || 64,
        key: analysis.key || "Unknown",
        grid: analysis.grid || []
      });

      setStatus("success");
      if(addToast) addToast(`Purchase Verified: ${fileName} Secured.`, "success");
    } catch (err: any) {
      console.error("DSP Pipeline Error:", err);
      if(addToast) addToast(err.message, "error");
      setStatus("idle");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userSession?.id) return;
    
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3'];
    if (!validTypes.includes(file.type)) {
      if(addToast) addToast("Security Breach: Only WAV and MP3 formats are permitted.", "error");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      if(addToast) addToast("Payload Exceeds 20MB Limit. Please compress audio file.", "error");
      return;
    }

    setStatus("uploading");
    
    try {
      const { data: profile, error: profileError } = await supabase.from('profiles').select('credits, tier').eq('id', userSession.id).single();
      if (profileError || !profile) throw new Error("Could not verify identity in ledger.");
      
      const requiredCredits = useDemucs ? 2 : 1; 
      if (profile.tier !== 'The Mogul' && profile.credits < requiredCredits) {
        throw new Error("Insufficient Credits. Upgrade your tier to execute this operation.");
      }

      const filePath = `${userSession.id}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from('audio_raw').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('audio_raw').getPublicUrl(filePath);
      let currentCloudUrl = publicUrlData.publicUrl;

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Security Exception: Missing Session Token. Please log in.");

      if (useDemucs) {
        setStatus("separating");
        const mdxRes = await fetch('/api/demucs', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({ file_url: currentCloudUrl, userId: userSession.id })
        });
        
        const mdxRaw = await mdxRes.text();
        let mdxData;
        try { mdxData = JSON.parse(mdxRaw); } catch(e) { throw new Error(`MDX Gateway Error: ${mdxRaw.substring(0, 50)}`); }
        
        if (!mdxRes.ok) {
           await supabase.storage.from('audio_raw').remove([filePath]);
           throw new Error(mdxData.error || "MDX Separation Failed");
        }
        currentCloudUrl = mdxData.instrumental_url || currentCloudUrl;
        if(addToast) addToast("MDX Separation Complete. Acapella isolated.", "success");
      }

      setStatus("analyzing");
      
      const res = await fetch('/api/dsp', { 
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ file_url: currentCloudUrl, userId: userSession.id }) 
      });
      
      const rawText = await res.text();
      let analysis;
      try {
        analysis = JSON.parse(rawText);
      } catch (parseError) {
        throw new Error(`DSP Server Crash (Status ${res.status}): ${rawText.substring(0, 50)}...`);
      }

      if (!res.ok) {
        await supabase.storage.from('audio_raw').remove([filePath]);
        throw new Error(analysis.error || `DSP Processing failed (Status ${res.status})`);
      }
      
      setAudioData({
        url: currentCloudUrl,
        fileName: file.name,
        bpm: analysis.bpm || 120, 
        totalBars: analysis.total_bars || 64,
        key: analysis.key || "Unknown",
        grid: analysis.grid || []
      });

      setStatus("success");
      if(addToast) addToast("Audio imported & analyzed successfully", "success");

    } catch (err: any) {
      console.error("DSP/MDX Pipeline Error:", err);
      if(addToast) addToast(err.message || "Error processing audio.", "error");
      setStatus("idle");
    }
  };

  const handlePurchaseBeat = async (beat: { name: string, url: string, price: number }) => {
    setPurchasingBeat(beat.name);
    try {
      const res = await fetch('/api/stripe/beat-lease', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beatName: beat.name,
          beatUrl: beat.url,
          price: beat.price,
          userId: userSession?.id
        })
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to initialize Stripe Checkout.");
      }
    } catch (err: any) {
      console.error("Purchase Error:", err);
      if(addToast) addToast("Checkout failed: " + err.message, "error");
      setPurchasingBeat(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto h-full grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
      
      <div className="lg:col-span-2 flex flex-col justify-center">
        <div className={`border-2 transition-all group rounded-lg text-center relative overflow-hidden flex flex-col items-center justify-center min-h-[400px]
          ${status === 'idle' ? 'border-[#222] bg-[#050505] hover:border-[#E60000] border-dashed' : 'border-[#E60000] bg-[#110000] border-solid'}`}>
          
          {status === 'analyzing' && <div className="absolute inset-0 bg-[#E60000]/10 animate-pulse pointer-events-none" />}
          
          {status === 'idle' && (
            <div className="w-full h-full flex flex-col items-center justify-center p-10 relative">
              <div className="absolute top-4 right-4 bg-[#111] border border-[#333] px-3 py-1 flex items-center gap-2 rounded-full">
                <Zap size={12} className="text-[#E60000]" />
                <span className="text-[9px] font-mono uppercase tracking-widest text-[#888]">Cost: {useDemucs ? '2 Credits' : '1 Credit'}</span>
              </div>

              <label className="cursor-pointer flex flex-col items-center mb-8">
                <UploadCloud size={64} className="mx-auto mb-6 text-[#222] group-hover:text-[#E60000] transition-colors relative z-10" />
                <h2 className="font-oswald text-3xl uppercase tracking-widest mb-2 font-bold relative z-10 text-white group-hover:text-[#E60000] transition-colors">INJECT RAW AUDIO</h2>
                <p className="font-mono text-[10px] text-[#555] uppercase tracking-widest relative z-10">Secured via Supabase // Routing to Worker 2</p>
                <input type="file" className="hidden" onChange={handleFileUpload} accept="audio/*" ref={fileInputRef} />
              </label>

              <div className="flex items-center gap-3 border border-[#222] bg-[#0a0a0a] px-4 py-3 rounded group hover:border-[#E60000] transition-colors">
                <input type="checkbox" id="mdx-toggle" checked={useDemucs} onChange={(e) => setUseDemucs(e.target.checked)} className="accent-[#E60000] w-4 h-4 cursor-pointer" />
                <label htmlFor="mdx-toggle" className="text-[10px] text-[#888] font-mono uppercase tracking-widest cursor-pointer select-none group-hover:text-white transition-colors">
                  Enable MDX Stem Split (Acapella Extraction)
                </label>
              </div>
            </div>
          )}

          {status === 'uploading' && (
            <div className="relative z-10 flex flex-col items-center pointer-events-none">
              <UploadCloud size={64} className="mx-auto mb-6 text-[#E60000] animate-bounce" />
              <h2 className="font-oswald text-3xl uppercase tracking-widest mb-2 font-bold text-white">UPLOADING...</h2>
              <p className="font-mono text-[10px] text-[#E60000] uppercase tracking-widest">Transmitting to Secure Supabase Bucket</p>
            </div>
          )}

          {status === 'separating' && (
            <div className="relative z-10 flex flex-col items-center pointer-events-none">
              <Activity size={64} className="mx-auto mb-6 text-[#E60000] animate-pulse" />
              <h2 className="font-oswald text-3xl uppercase tracking-widest mb-2 font-bold text-white">MDX NEURAL SPLIT</h2>
              <p className="font-mono text-[10px] text-[#E60000] uppercase tracking-widest">Deconstructing Audio into Master Stems...</p>
            </div>
          )}

          {status === 'analyzing' && (
            <div className="relative z-10 flex flex-col items-center pointer-events-none">
              <Loader2 size={64} className="mx-auto mb-6 text-[#E60000] animate-spin" />
              <h2 className="font-oswald text-3xl uppercase tracking-widest mb-2 font-bold text-white">ANALYZING</h2>
              <p className="font-mono text-[10px] text-[#E60000] uppercase tracking-widest">Extracting Rhythm Grid & BPM Context</p>
            </div>
          )}

          {status === 'success' && audioData && (
            <div className="relative z-10 flex flex-col items-center animate-in zoom-in w-full px-8 py-10">
              <Activity size={48} className="mx-auto mb-4 text-green-500 shadow-[0_0_30px_rgba(34,197,94,0.2)] rounded-full bg-green-500/10 p-2" />
              <h2 className="font-oswald text-3xl uppercase tracking-widest mb-6 font-bold text-white">Smart Analysis Complete</h2>
              
              <div className="bg-black border border-green-500/30 p-6 w-full max-w-sm mb-8 space-y-4">
                <div className="flex justify-between items-center border-b border-[#222] pb-2">
                  <span className="text-[10px] text-[#888] font-mono uppercase tracking-widest">Detected BPM</span>
                  <span className="text-lg font-oswald text-green-500 font-bold">{Math.round(audioData.bpm)}</span>
                </div>
                <div className="flex justify-between items-center border-b border-[#222] pb-2">
                  <span className="text-[10px] text-[#888] font-mono uppercase tracking-widest">Structural Length</span>
                  <span className="text-lg font-oswald text-green-500 font-bold">{audioData.totalBars} Bars</span>
                </div>
                <div className="flex justify-between items-center border-b border-[#222] pb-2">
                  <span className="text-[10px] text-[#888] font-mono uppercase tracking-widest">Musical Key</span>
                  <span className="text-sm font-oswald text-green-500 font-bold uppercase">{audioData.key}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-[#888] font-mono uppercase tracking-widest">Rhythm Grid</span>
                  <span className="text-[10px] font-mono text-green-500 tracking-widest">SECURED</span>
                </div>
              </div>

              <div className="w-full max-w-sm flex flex-col gap-3">
                <button onClick={() => setActiveRoom("02")} className="w-full bg-white text-black py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                  Advance to Brain Train
                </button>
                <button onClick={() => { 
                    setAudioData({ url: "", fileName: "", bpm: 0, totalBars: 0 }); // Pass an empty object to satisfy TypeScript, but effectively clear it. 
                    setStatus("idle"); 
                }} className="w-full border border-[#333] text-[#888] py-3 font-oswald text-sm font-bold uppercase tracking-widest hover:bg-[#111] hover:text-white transition-all">
                  Analyze New Track
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#050505] border border-[#111] p-6 rounded-lg overflow-y-auto custom-scrollbar flex flex-col">
        <h3 className="font-oswald text-sm uppercase tracking-widest text-[#E60000] border-b border-[#222] pb-3 mb-4 font-bold flex items-center gap-2">
          <DollarSign size={16} /> Marketplace // Beats
        </h3>
        <p className="font-mono text-[9px] text-[#555] uppercase tracking-widest mb-6 leading-relaxed">
          Purchase a commercial lease. The track will be instantly routed through the DSP algorithm.
        </p>

        <div className="space-y-3 flex-1">
          {beats.map((b, i) => (
            <div key={i} className="bg-black p-4 border border-[#111] flex items-center justify-between group hover:border-[#E60000] transition-colors">
              <div className="flex flex-col pr-4 overflow-hidden">
                <span className="text-[10px] font-mono text-gray-300 uppercase truncate font-bold">{b.name}</span>
                <span className="text-[9px] font-mono text-green-500 uppercase mt-1 tracking-widest">Lease: ${b.price.toFixed(2)}</span>
              </div>
              <button 
                onClick={() => handlePurchaseBeat(b)}
                disabled={status !== 'idle' || purchasingBeat === b.name}
                className="bg-white text-black px-4 py-2 text-[9px] font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-colors disabled:opacity-50 shrink-0 flex items-center gap-2"
              >
                {purchasingBeat === b.name ? <Loader2 size={12} className="animate-spin" /> : <ShoppingCart size={12} />} Buy
              </button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}