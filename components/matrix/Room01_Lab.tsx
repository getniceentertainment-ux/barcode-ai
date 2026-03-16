"use client";

import React, { useState, useRef, useEffect } from "react";
import { UploadCloud, DollarSign, Loader2, Activity, AlertTriangle, ArrowRight, CheckCircle2, ShoppingCart, X } from "lucide-react";
import { useMatrixStore } from "../../store/useMatrixStore";
import { supabase } from "../../lib/supabase";

export default function Room01_Lab() {
  const { audioData, setAudioData, setActiveRoom, userSession, addToast } = useMatrixStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<"idle" | "uploading" | "analyzing" | "success">(audioData ? "success" : "idle");
  const [beats, setBeats] = useState<{name: string, url: string, price: number}[]>([]);
  
  // NEW: UI Checkout States
  const [selectedBeat, setSelectedBeat] = useState<{name: string, url: string, price: number} | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    // 1. Fetch marketplace beats
    const fetchMarketplaceBeats = async () => {
      try {
        const { data, error } = await supabase.storage.from('marketplace_beats').list();
        if (error) throw error;
        if (data && data.length > 0) {
          const fetchedBeats = data
            .filter(file => file.name.endsWith('.mp3') || file.name.endsWith('.wav'))
            .map(file => {
              const bpmMatch = file.name.match(/_?(\d+)\s*BPM/i);
              const bpm = bpmMatch ? parseInt(bpmMatch[1]) : 120;
              let calculatedPrice = 29.99;
              if (bpm >= 140) calculatedPrice = 149.99;
              else if (bpm >= 125) calculatedPrice = 99.99;
              else if (bpm >= 110) calculatedPrice = 49.99;

              const { data: urlData } = supabase.storage.from('marketplace_beats').getPublicUrl(file.name);
              return { name: file.name, url: urlData.publicUrl, price: calculatedPrice };
            });

          if (fetchedBeats.length > 0) {
            setBeats(prev => {
              const existingNames = new Set(prev.map(p => p.name));
              const newBeats = fetchedBeats.filter(fb => !existingNames.has(fb.name));
              return [...prev, ...newBeats];
            });
          }
        }
      } catch (err) {
        console.error("Failed to load beats from Supabase marketplace:", err);
      }
    };
    fetchMarketplaceBeats();

    // 2. RESTORED: Intercept successful Stripe payments when they return to the app
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('beat_purchased') === 'true') {
        const beatUrl = params.get('beat_url');
        const beatName = params.get('beat_name');
        
        if (beatUrl && beatName) {
          // Clean the URL so it doesn't trigger again on refresh
          window.history.replaceState({}, document.title, window.location.pathname);
          executeDSPAfterPurchase(beatUrl, beatName);
        }
      }
    }
  }, []);

  // RESTORED: Auto-DSP the beat they just paid for
  const executeDSPAfterPurchase = async (fileUrl: string, fileName: string) => {
    setStatus("analyzing");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Security Exception: Missing Session Token. Please log in.");

      const res = await fetch('/api/dsp', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ file_url: fileUrl, userId: userSession?.id }) 
      });
      
      const analysis = await res.json();
      if (!res.ok) throw new Error(analysis.error || `DSP Processing failed`);
      
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

      if (profile.tier !== 'The Mogul' && profile.credits < 1) {
        throw new Error("Insufficient Credits. Upgrade your tier to execute this operation.");
      }

      const filePath = `${userSession.id}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from('audio_raw').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('audio_raw').getPublicUrl(filePath);
      const cloudUrl = publicUrlData.publicUrl;

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Security Exception: Valid JWT Token required.");

      setStatus("analyzing");

      const res = await fetch('/api/dsp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ file_url: cloudUrl })
      });

      const analysis = await res.json();

      if (!res.ok) {
        await supabase.storage.from('audio_raw').remove([filePath]);
        throw new Error(analysis.error || "DSP Processing failed");
      }

      setAudioData({
        url: cloudUrl,
        fileName: file.name,
        bpm: analysis.bpm || 120,
        totalBars: analysis.total_bars || 64,
        key: analysis.key || "C# Minor",
        grid: analysis.grid || []
      });

      setStatus("success");
      if(addToast) addToast("Audio imported & analyzed successfully", "success");

    } catch (err: any) {
      console.error("DSP Pipeline Error:", err);
      if(addToast) addToast(err.message || "Error processing audio.", "error");
      setStatus("idle");
    }
  };

  // RESTORED: Trigger the Stripe API call
  const handleConfirmPurchase = async () => {
    if (!selectedBeat) return;
    setIsRedirecting(true);
    
    try {
      const res = await fetch('/api/stripe/beat-lease', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          beatName: selectedBeat.name, 
          beatUrl: selectedBeat.url, 
          price: selectedBeat.price, 
          userId: userSession?.id 
        })
      });
      
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url; // Secure redirect to Stripe Checkout
      } else {
        throw new Error(data.error || "Failed to initialize Stripe Checkout.");
      }
    } catch (err: any) {
      console.error("Purchase Error:", err);
      if(addToast) addToast("Checkout failed: " + err.message, "error");
      setIsRedirecting(false);
      setSelectedBeat(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto h-full grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">

      {/* LEFT COL: INJECTION DROPZONE & IN-UI CHECKOUT */}
      <div className="lg:col-span-2 flex flex-col justify-center relative">
        <div className={`border-2 transition-all group rounded-lg text-center relative overflow-hidden flex flex-col items-center justify-center min-h-[450px]
          ${status === 'idle' && !selectedBeat ? 'border-[#222] bg-[#050505] hover:border-[#E60000] border-dashed' : 
            selectedBeat ? 'border-[#E60000] bg-[#110000] border-solid' : 'border-[#E60000] bg-[#110000] border-solid'}`}>

          {status === 'analyzing' && <div className="absolute inset-0 bg-[#E60000]/10 animate-pulse pointer-events-none" />}

          {/* STATE: DEFAULT UPLOAD */}
          {status === 'idle' && !selectedBeat && (
            <div className="w-full h-full flex flex-col items-center justify-center p-10 relative">
              <label className="cursor-pointer flex flex-col items-center w-full h-full justify-center">
                <UploadCloud size={64} className="mx-auto mb-6 text-[#222] group-hover:text-[#E60000] transition-colors relative z-10" />
                <h2 className="font-oswald text-3xl uppercase tracking-widest mb-2 font-bold relative z-10 text-white group-hover:text-[#E60000] transition-colors">INJECT RAW AUDIO</h2>
                <p className="font-mono text-[10px] text-[#555] uppercase tracking-widest relative z-10">Secured via Supabase // Routing to DSP Worker</p>
                <div className="mt-6 flex items-center gap-2 text-[9px] text-yellow-600 font-mono uppercase tracking-widest bg-yellow-900/10 py-1 px-3 border border-yellow-900/30">
                  <AlertTriangle size={12} /> Strict Limit: 20MB (WAV/MP3)
                </div>
                <input type="file" className="hidden" onChange={handleFileUpload} accept="audio/*" ref={fileInputRef} />
              </label>
            </div>
          )}

          {/* STATE: IN-UI CHECKOUT CONFIRMATION */}
          {selectedBeat && status === 'idle' && (
            <div className="w-full h-full flex flex-col items-center justify-center p-10 relative animate-in zoom-in duration-300">
              <button 
                onClick={() => setSelectedBeat(null)} 
                className="absolute top-4 right-4 text-[#888] hover:text-white p-2"
                disabled={isRedirecting}
              >
                <X size={20} />
              </button>
              
              <ShoppingCart size={48} className="text-[#E60000] mb-4" />
              <h2 className="font-oswald text-2xl uppercase tracking-widest font-bold text-white mb-1">Commercial Lease</h2>
              <p className="font-mono text-[10px] text-[#888] uppercase tracking-widest mb-8 text-center max-w-sm">
                You are about to lease this track from the GetNice Marketplace. The audio will automatically route to the DSP analyzer upon purchase.
              </p>

              <div className="bg-black border border-[#222] w-full max-w-sm p-6 mb-8 text-left">
                 <p className="text-[10px] text-[#E60000] font-mono uppercase tracking-widest font-bold mb-1">Selected Asset</p>
                 <p className="font-oswald text-xl text-white truncate uppercase tracking-widest mb-4">{selectedBeat.name}</p>
                 
                 <div className="flex justify-between items-end border-t border-[#222] pt-4">
                    <span className="text-[10px] text-[#555] font-mono uppercase tracking-widest">Total Due</span>
                    <span className="text-3xl font-oswald font-bold text-green-500">${selectedBeat.price.toFixed(2)}</span>
                 </div>
              </div>

              <button 
                onClick={handleConfirmPurchase}
                disabled={isRedirecting}
                className="w-full max-w-sm bg-[#E60000] text-white py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex justify-center items-center gap-3 shadow-[0_0_20px_rgba(230,0,0,0.3)]"
              >
                {isRedirecting ? <><Loader2 size={20} className="animate-spin" /> Routing to Secure Gateway...</> : "Confirm & Pay via Stripe"}
              </button>
            </div>
          )}

          {status === 'uploading' && (
            <div className="relative z-10 flex flex-col items-center pointer-events-none">
              <UploadCloud size={64} className="mx-auto mb-6 text-[#E60000] animate-bounce" />
              <h2 className="font-oswald text-3xl uppercase tracking-widest mb-2 font-bold text-white">UPLOADING...</h2>
              <p className="font-mono text-[10px] text-[#E60000] uppercase tracking-widest">Transmitting to Secure Supabase Bucket</p>
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

              <div className="bg-black border border-green-500/30 p-6 w-full max-w-sm mb-8 space-y-4 text-left">
                <div className="flex justify-between items-center border-b border-[#222] pb-2">
                  <span className="text-[10px] text-[#888] font-mono uppercase tracking-widest">Detected BPM</span>
                  <span className="text-lg font-oswald text-green-500 font-bold">{Math.round(audioData.bpm)}</span>
                </div>
                <div className="flex justify-between items-center border-b border-[#222] pb-2">
                  <span className="text-[10px] text-[#888] font-mono uppercase tracking-widest">Musical Key</span>
                  <span className="text-lg font-oswald text-green-500 font-bold">{audioData.key || "Unknown"}</span>
                </div>
                <div className="flex justify-between items-center border-b border-[#222] pb-2">
                  <span className="text-[10px] text-[#888] font-mono uppercase tracking-widest">Structural Length</span>
                  <span className="text-lg font-oswald text-green-500 font-bold">{audioData.totalBars} Bars</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-[#888] font-mono uppercase tracking-widest">Rhythm Grid</span>
                  <span className="text-[10px] font-mono text-green-500 tracking-widest">SECURED</span>
                </div>
              </div>

              <div className="w-full max-w-sm flex flex-col gap-3">
                <button
                  onClick={() => setActiveRoom("02")}
                  className="w-full flex justify-center items-center gap-3 bg-white text-black py-4 font-oswald text-lg font-bold uppercase tracking-widest hover:bg-[#E60000] hover:text-white transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                >
                  Advance to Brain Train <ArrowRight size={18} />
                </button>

                <button
                  onClick={() => { setAudioData(null as any); setStatus("idle"); setSelectedBeat(null); }}
                  className="w-full border border-[#333] text-[#888] py-3 font-oswald text-sm font-bold uppercase tracking-widest hover:bg-[#111] hover:text-white transition-all"
                >
                  Analyze New Track
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COL: MARKETPLACE */}
      <div className="bg-[#050505] border border-[#111] p-6 rounded-lg overflow-y-auto custom-scrollbar flex flex-col">
        <h3 className="font-oswald text-sm uppercase tracking-widest text-[#E60000] border-b border-[#222] pb-3 mb-4 font-bold flex items-center gap-2">
          <DollarSign size={16} /> Marketplace // Beats
        </h3>
        <p className="font-mono text-[9px] text-[#555] uppercase tracking-widest mb-6 leading-relaxed">
          Purchase a commercial lease. The track will be automatically routed to the DSP queue.
        </p>

        <div className="space-y-3 flex-1">
          {beats.map((b, i) => (
            <div key={i} className={`bg-black p-4 border flex items-center justify-between group transition-colors cursor-pointer
              ${selectedBeat?.name === b.name ? 'border-[#E60000]' : 'border-[#111] hover:border-[#E60000]/50'}`}
              onClick={() => status === 'idle' && setSelectedBeat(b)}
            >
              <div className="flex flex-col pr-4 overflow-hidden">
                <span className={`text-[10px] font-mono uppercase truncate font-bold ${selectedBeat?.name === b.name ? 'text-white' : 'text-gray-300'}`}>{b.name}</span>
                <span className="text-[9px] font-mono text-green-500 uppercase mt-1 tracking-widest">
                  Lease: ${b.price.toFixed(2)}
                </span>
              </div>
              <button
                disabled={status !== 'idle'}
                className={`px-4 py-2 text-[9px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50 shrink-0
                  ${selectedBeat?.name === b.name ? 'bg-[#E60000] text-white' : 'bg-white text-black group-hover:bg-[#E60000] group-hover:text-white'}`}
              >
                Select
              </button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}