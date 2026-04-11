import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AudioAnalysis, FlowDNA, BlueprintSection, VocalStem, UserSession, FinalMaster } from '../lib/types';
import { saveAudioToDisk, loadAudioFromDisk } from '../lib/dawStorage';
import { supabase } from '../lib/supabase';

export type ExtendedAudioAnalysis = AudioAnalysis & {
  dynamic_array?: number[];
  contour?: string;
};

export interface QuantizedSyllable {
  id: string;
  word: string;
  slot: number; 
  startTime: number;
  duration: number;
  isWordEnd?: boolean;
}

export interface QuantizedLine {
  id: string;
  barIndex: number;
  text: string;
  originalText: string;
  startTime: number;
  lineDuration?: number;
  isHeader: boolean;
  timestamp?: string;
  words?: QuantizedSyllable[];
}

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface MatrixState {
  hasAccess: boolean;
  activeRoom: string;
  userSession: UserSession | null;
  activeProjectId: string | null;
  isProjectFinalized: boolean;

  syncStatus: "idle" | "saving" | "saved" | "error";
  setSyncStatus: (status: "idle" | "saving" | "saved" | "error") => void;

  anrData: {
    trackTitle: string;
    hitScore: number;
    tiktokSnippet: string;
    coverUrl: string;
    status: "idle" | "analyzing" | "submitting" | "success";
  };
  updateAnrData: (data: Partial<MatrixState['anrData']>) => void;

  mixParams: {
    activeChain: string;
    presenceIntensity: number;
    reverbMix: number;
    eqGains: number[];
  };
  updateMixParams: (params: Partial<MatrixState['mixParams']>) => void;

  playbackMode: 'session' | 'radio';
  radioTrack: { url: string; title: string; artist: string; score: number } | null;
  setPlaybackMode: (mode: 'session' | 'radio') => void;
  setRadioTrack: (track: { url: string; title: string; artist: string; score: number } | null) => void;
  
  mdxJobId: string | null;
  setMdxJobId: (id: string | null) => void;
  mdxStatus: "idle" | "processing" | "success" | "failed";
  setMdxStatus: (status: "idle" | "processing" | "success" | "failed") => void;

  grantAccess: (session: UserSession) => void;
  setActiveRoom: (roomId: string) => void;
  setActiveProject: (id: string | null, isFinalized: boolean) => void;

  audioData: ExtendedAudioAnalysis | null;
  setAudioData: (data: ExtendedAudioAnalysis) => void;
  
  flowDNA: FlowDNA | null;
  setFlowDNA: (dna: FlowDNA) => void;

  gwTitle: string;
  gwPrompt: string;
  gwStyle: string;
  gwPocket: string; 
  gwGender: string;
  gwUseSlang: boolean;
  gwUseIntel: boolean;
  
  gwMotive: string;
  gwStruggle: string;
  gwHustle: string;

  gwStrikeZone: string;
  gwHookType: string;
  gwFlowEvolution: string;
  
  setGwTitle: (t: string) => void;
  setGwPrompt: (p: string) => void;
  setGwStyle: (s: string) => void;
  setGwPocket: (p: string) => void; 
  setGwGender: (g: string) => void;
  setGwUseSlang: (b: boolean) => void;
  setGwUseIntel: (b: boolean) => void;
  
  setGwMotive: (m: string) => void;
  setGwStruggle: (s: string) => void;
  setGwHustle: (h: string) => void;

  setGwStrikeZone: (val: string) => void;
  setGwHookType: (val: string) => void;
  setGwFlowEvolution: (val: string) => void;

  blueprint: BlueprintSection[];
  setBlueprint: (blueprint: BlueprintSection[]) => void;
  generatedLyrics: string | null;
  setGeneratedLyrics: (lyrics: string) => void;

  quantizedLines: QuantizedLine[];
  setQuantizedLines: (lines: QuantizedLine[]) => void;

  vocalStems: VocalStem[];
  addVocalStem: (stem: VocalStem) => void;
  removeVocalStem: (id: string) => void;
  updateStemVolume: (id: string, volume: number) => void;
  updateStemOffset: (id: string, offsetBars: number) => void;
  toggleStemMute: (id: string) => void; // 🚨 ADDED GLOBAL MUTE

  engineeredVocal: VocalStem | null;
  setEngineeredVocal: (stem: VocalStem | null) => void;

  finalMaster: FinalMaster | null;
  setFinalMaster: (master: FinalMaster | null) => void;

  toasts: ToastMessage[];
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;

  clearMatrix: () => void;
  hydrateDiskAudio: () => Promise<void>;
  
  syncLedger: () => Promise<void>;
  pushToCloud: () => Promise<void>;
  pullFromCloud: (userId: string) => Promise<void>;
}

export const useMatrixStore = create<MatrixState>()(
  persist(
    (set, get) => ({
      hasAccess: false,
      activeRoom: "01",
      userSession: null,
      activeProjectId: null,
      isProjectFinalized: false,
      syncStatus: "idle",
      playbackMode: 'session',
      radioTrack: null,
      mdxJobId: null,
      mdxStatus: "idle",
      audioData: null,
      flowDNA: null,
      gwTitle: "",
      gwPrompt: "",
      gwStyle: "getnice_hybrid",
      gwPocket: "standard", 
      gwGender: "male",
      gwUseSlang: true,
      gwUseIntel: true,
      
      gwMotive: "",
      gwStruggle: "",
      gwHustle: "",

      gwStrikeZone: "snare",
      gwHookType: "auto", 
      gwFlowEvolution: "auto", 
      
      mixParams: {
        activeChain: "getnice_eq",
        presenceIntensity: 30,
        reverbMix: 25,
        eqGains: [2, 1, -1, -2, 0, 1.5, 2, 1, 2, 1.5]
      },

      anrData: {
        trackTitle: "",
        hitScore: 0,
        tiktokSnippet: "",
        coverUrl: "",
        status: "idle",
      },
      
      blueprint: [],
      generatedLyrics: null,
      quantizedLines: [], 
      vocalStems: [],
      engineeredVocal: null, 
      finalMaster: null,
      toasts: [],

      setSyncStatus: (status) => set({ syncStatus: status }),
      updateMixParams: (params) => set((state) => ({ mixParams: { ...state.mixParams, ...params } })),
      updateAnrData: (data) => set((state) => ({ anrData: { ...state.anrData, ...data } })),
      setPlaybackMode: (mode) => set({ playbackMode: mode }),
      setRadioTrack: (track) => set({ radioTrack: track }),
      setMdxJobId: (id) => set({ mdxJobId: id }),
      setMdxStatus: (status) => set({ mdxStatus: status }),
      
      // 🚨 SURGICAL FIX: The 1-2 Punch. Cloud restores metadata, Disk restores the heavy Audio Blobs
      grantAccess: (session) => { 
        set({ hasAccess: true, userSession: session });
        (async () => {
          await get().pullFromCloud(session.id);
          await get().hydrateDiskAudio();
        })();
      },
      
      setActiveProject: (id, isFinalized) => set({ activeProjectId: id, isProjectFinalized: isFinalized }),
      setFlowDNA: (dna) => set({ flowDNA: dna }),
      setGwTitle: (t) => set({ gwTitle: t }),
      setGwPrompt: (p) => set({ gwPrompt: p }),
      setGwStyle: (s) => set({ gwStyle: s }),
      setGwPocket: (p) => set({ gwPocket: p }), 
      setGwGender: (g) => set({ gwGender: g }),
      setGwUseSlang: (b) => set({ gwUseSlang: b }),
      setGwUseIntel: (b) => set({ gwUseIntel: b }),
      
      setGwMotive: (m) => set({ gwMotive: m }),
      setGwStruggle: (s) => set({ gwStruggle: s }),
      setGwHustle: (h) => set({ gwHustle: h }),

      setGwStrikeZone: (val) => set({ gwStrikeZone: val }),
      setGwHookType: (val) => set({ gwHookType: val }),
      setGwFlowEvolution: (val) => set({ gwFlowEvolution: val }),

      setBlueprint: (blueprint) => set({ blueprint }),
      setGeneratedLyrics: (lyrics) => set({ generatedLyrics: lyrics }),
      setQuantizedLines: (lines) => set({ quantizedLines: lines }), 

      setEngineeredVocal: (stem) => {
        set({ engineeredVocal: stem });
        saveAudioToDisk('matrix_engineered_vocal', stem ? [stem] : []); 
      },   
      
      setActiveRoom: (roomId) => {
        set((state) => {
          if (state.isProjectFinalized && ["01", "02", "03", "04", "05"].includes(roomId)) {
            return state; 
          }
          return { activeRoom: roomId };
        });
        get().pushToCloud();
      },

      setFinalMaster: (master) => {
        set({ finalMaster: master, isProjectFinalized: !!master }); 
        saveAudioToDisk('matrix_final_master', master);
      },
      
      setAudioData: (data) => {
        set({ audioData: data });
        saveAudioToDisk('matrix_audio_data', data);
      },
      addVocalStem: (stem) => set((state) => {
        const newStems = [...state.vocalStems, stem];
        saveAudioToDisk('matrix_vocal_stems', newStems);
        return { vocalStems: newStems };
      }),
      removeVocalStem: (id) => set((state) => {
        const newStems = state.vocalStems.filter(s => s.id !== id);
        saveAudioToDisk('matrix_vocal_stems', newStems);
        return { vocalStems: newStems };
      }),
      updateStemVolume: (id, volume) => set((state) => {
        const newStems = state.vocalStems.map(s => s.id === id ? { ...s, volume } : s);
        saveAudioToDisk('matrix_vocal_stems', newStems);
        return { vocalStems: newStems };
      }),
      updateStemOffset: (id, offsetBars) => set((state) => {
        const newStems = state.vocalStems.map(s => s.id === id ? { ...s, offsetBars } : s);
        saveAudioToDisk('matrix_vocal_stems', newStems);
        return { vocalStems: newStems };
      }),
      // 🚨 GLOBAL MUTE ACTION ADDED
      toggleStemMute: (id) => set((state) => {
        const newStems = state.vocalStems.map(s => s.id === id ? { ...s, isMuted: !s.isMuted } : s);
        saveAudioToDisk('matrix_vocal_stems', newStems);
        return { vocalStems: newStems };
      }),

      addToast: (message, type) => {
        const id = Math.random().toString(36).substring(7);
        set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
        setTimeout(() => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })), 4000);
      },
      removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })),

      clearMatrix: () => set((state) => {
        saveAudioToDisk('matrix_audio_data', null);
        saveAudioToDisk('matrix_vocal_stems', []);
        saveAudioToDisk('matrix_engineered_vocal', []); 
        saveAudioToDisk('matrix_final_master', null);
        
        return {
          audioData: null, flowDNA: null, generatedLyrics: null, vocalStems: [], activeRoom: "01",
          engineeredVocal: null, quantizedLines: [], 
          gwTitle: "", gwPrompt: "", gwStyle: "getnice_hybrid", gwPocket: "standard", activeProjectId: null, isProjectFinalized: false, finalMaster: null,
          mdxJobId: null, mdxStatus: "idle", syncStatus: "idle",
          gwMotive: "", gwStruggle: "", gwHustle: "",
          gwStrikeZone: "snare", gwHookType: "auto", gwFlowEvolution: "auto",
          mixParams: { activeChain: "getnice_eq", presenceIntensity: 30, reverbMix: 25, eqGains: [2, 1, -1, -2, 0, 1.5, 2, 1, 2, 1.5] },
          anrData: { trackTitle: "", hitScore: 0, tiktokSnippet: "", coverUrl: "", status: "idle", }
        };
      }),

      syncLedger: async () => {
        const state = get();
        if (!state.userSession?.id) return;
        try {
          const { data } = await supabase.from('profiles').select('*').eq('id', state.userSession.id).maybeSingle(); 
          if (data) {
            set({
              userSession: {
                ...state.userSession,
                credits: data.credits ?? (state.userSession as any).credits, 
                creditsRemaining: data.tier === 'The Mogul' ? 'UNLIMITED' : (data.credits ?? (state.userSession as any).creditsRemaining),
                tokens: data.tokens ?? (state.userSession as any).tokens,
                free_credits: data.free_credits ?? (state.userSession as any).free_credits,
                has_engineering_token: data.has_engineering_token,
                hasEngineeringToken: data.has_engineering_token, 
                mastering_tokens: data.mastering_tokens,
                masteringTokens: data.mastering_tokens, 
                has_mastering_token: data.has_mastering_token,
                hasMasteringToken: data.has_mastering_token, 
                marketingCredits: data.marketing_credits,
                walletBalance: data.wallet_balance
              } as any
            });
          }
        } catch (err) { console.error("Ledger sync failed", err); }
      },

      pushToCloud: async () => {
        const state = get();
        const userId = state.userSession?.id;
        if (!userId) return;

        set({ syncStatus: "saving" });
        
        const session_state = {
           audioData: state.audioData,                     
           flowDNA: state.flowDNA,
           blueprint: state.blueprint, 
           generatedLyrics: state.generatedLyrics,
           quantizedLines: state.quantizedLines,
           gwTitle: state.gwTitle, gwPrompt: state.gwPrompt, gwStyle: state.gwStyle, gwPocket: state.gwPocket, 
           gwMotive: state.gwMotive, gwStruggle: state.gwStruggle, gwHustle: state.gwHustle,
           gwStrikeZone: state.gwStrikeZone, gwHookType: state.gwHookType, gwFlowEvolution: state.gwFlowEvolution,
           mixParams: state.mixParams, anrData: state.anrData, activeProjectId: state.activeProjectId,
           vocalStems: state.vocalStems.map(s => ({ ...s, blob: undefined })),
           engineeredVocal: state.engineeredVocal ? { ...state.engineeredVocal, blob: undefined } : null,
           finalMaster: state.finalMaster ? { ...state.finalMaster, blob: undefined } : null,
           isProjectFinalized: state.isProjectFinalized, activeRoom: state.activeRoom,
        };

        try {
          const { error } = await supabase
            .from('matrix_sessions')
            .upsert(
              { 
                user_id: userId, 
                session_state, 
                updated_at: new Date().toISOString() 
              }, 
              { onConflict: 'user_id' } 
            );

          if (error) throw error;

          set({ syncStatus: "saved" });
          setTimeout(() => set({ syncStatus: "idle" }), 3000);
        } catch (err) {
          console.error("Matrix Cloud Save Failed:", err);
          set({ syncStatus: "error" });
          setTimeout(() => set({ syncStatus: "idle" }), 5000);
        }
      },

      pullFromCloud: async (userId: string) => {
        try {
          const { data } = await supabase.from('matrix_sessions').select('session_state').eq('user_id', userId).maybeSingle();
          if (data?.session_state) {
            set({ ...data.session_state });
            console.log("Matrix State Restored from Cloud Vault.");
          }
        } catch (err) { console.error("Matrix Cloud Pull Failed:", err); }
      },

      hydrateDiskAudio: async () => {
        try {
          await get().syncLedger();
          const savedBeat = await loadAudioFromDisk('matrix_audio_data');
          const savedStems = await loadAudioFromDisk('matrix_vocal_stems');
          const savedEngineered = await loadAudioFromDisk('matrix_engineered_vocal'); 
          const savedMaster = await loadAudioFromDisk('matrix_final_master'); 

          if (savedBeat && (savedBeat as any).blob) {
            set({ audioData: { ...(savedBeat as any), url: URL.createObjectURL((savedBeat as any).blob) } });
          } else if (savedBeat) {
             set({ audioData: savedBeat as ExtendedAudioAnalysis });
          }

          if (savedStems && Array.isArray(savedStems)) {
            const revivedStems = savedStems.map((stem: any) => ({ ...stem, url: stem.blob ? URL.createObjectURL(stem.blob) : stem.url }));
            set({ vocalStems: revivedStems });
          }

          if (savedEngineered && Array.isArray(savedEngineered) && savedEngineered.length > 0) {
            const engStem = savedEngineered[0];
            set({ engineeredVocal: { ...engStem, url: engStem.blob ? URL.createObjectURL(engStem.blob) : engStem.url }});
          }

          if (savedMaster && (savedMaster as any).blob) {
             set({ finalMaster: { ...(savedMaster as any), url: URL.createObjectURL((savedMaster as any).blob) } });
          }
        } catch (e) { console.error("Failed to hydrate audio from disk", e); }
      }
    }),
    {
      name: 'barcode-matrix-storage', 
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        flowDNA: state.flowDNA, blueprint: state.blueprint, generatedLyrics: state.generatedLyrics, quantizedLines: state.quantizedLines,
        gwTitle: state.gwTitle, gwPrompt: state.gwPrompt, gwStyle: state.gwStyle, gwPocket: state.gwPocket, 
        audioData: state.audioData, gwMotive: state.gwMotive, gwStruggle: state.gwStruggle, gwHustle: state.gwHustle,
        gwStrikeZone: state.gwStrikeZone, gwHookType: state.gwHookType, gwFlowEvolution: state.gwFlowEvolution,
        mixParams: state.mixParams, anrData: state.anrData, playbackMode: state.playbackMode, radioTrack: state.radioTrack,
        activeProjectId: state.activeProjectId, isProjectFinalized: state.isProjectFinalized, activeRoom: state.activeRoom,
        hasAccess: state.hasAccess, userSession: state.userSession
      }),
    }
  )
);