import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AudioAnalysis, FlowDNA, BlueprintSection, VocalStem, UserSession, FinalMaster } from '../lib/types';
import { saveAudioToDisk, loadAudioFromDisk } from '../lib/dawStorage';
import { supabase } from '../lib/supabase'; // <-- ADDED SUPABASE IMPOR

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

  audioData: AudioAnalysis | null;
  setAudioData: (data: AudioAnalysis) => void;
  flowDNA: FlowDNA | null;
  setFlowDNA: (dna: FlowDNA) => void;

  gwTitle: string;
  gwPrompt: string;
  gwStyle: string;
  gwGender: string;
  gwUseSlang: boolean;
  gwUseIntel: boolean;
  setGwTitle: (t: string) => void;
  setGwPrompt: (p: string) => void;
  setGwStyle: (s: string) => void;
  setGwGender: (g: string) => void;
  setGwUseSlang: (b: boolean) => void;
  setGwUseIntel: (b: boolean) => void;

  blueprint: BlueprintSection[];
  setBlueprint: (blueprint: BlueprintSection[]) => void;
  generatedLyrics: string | null;
  setGeneratedLyrics: (lyrics: string) => void;

  vocalStems: VocalStem[];
  addVocalStem: (stem: VocalStem) => void;
  removeVocalStem: (id: string) => void;
  updateStemVolume: (id: string, volume: number) => void;
  updateStemOffset: (id: string, offsetBars: number) => void;

  finalMaster: FinalMaster | null;
  setFinalMaster: (master: FinalMaster | null) => void;

  toasts: ToastMessage[];
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;

  clearMatrix: () => void;
  hydrateDiskAudio: () => Promise<void>;
  
  // --- SURGICAL FIX: Ledger Synchronization ---
  syncLedger: () => Promise<void>;
}

export const useMatrixStore = create<MatrixState>()(
  persist(
    (set, get) => ({
      hasAccess: false,
      activeRoom: "01",
      userSession: null,
      activeProjectId: null,
      isProjectFinalized: false,
      playbackMode: 'session',
      radioTrack: null,
      mdxJobId: null,
      mdxStatus: "idle",
      audioData: null,
      flowDNA: null,
      gwTitle: "",
      gwPrompt: "",
      gwStyle: "getnice_hybrid",
      gwGender: "male",
      gwUseSlang: true,
      gwUseIntel: true,
      
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
      vocalStems: [],
      finalMaster: null,
      toasts: [],

      updateMixParams: (params) => set((state) => ({ 
        mixParams: { ...state.mixParams, ...params } 
      })),

      updateAnrData: (data) => set((state) => ({ 
        anrData: { ...state.anrData, ...data } 
      })),

      setPlaybackMode: (mode) => set({ playbackMode: mode }),
      setRadioTrack: (track) => set({ radioTrack: track }),
      setMdxJobId: (id) => set({ mdxJobId: id }),
      setMdxStatus: (status) => set({ mdxStatus: status }),
      grantAccess: (session) => set({ hasAccess: true, userSession: session }),
      setActiveProject: (id, isFinalized) => set({ activeProjectId: id, isProjectFinalized: isFinalized }),
      setFlowDNA: (dna) => set({ flowDNA: dna }),
      setGwTitle: (t) => set({ gwTitle: t }),
      setGwPrompt: (p) => set({ gwPrompt: p }),
      setGwStyle: (s) => set({ gwStyle: s }),
      setGwGender: (g) => set({ gwGender: g }),
      setGwUseSlang: (b) => set({ gwUseSlang: b }),
      setGwUseIntel: (b) => set({ gwUseIntel: b }),
      setBlueprint: (blueprint) => set({ blueprint }),
      setGeneratedLyrics: (lyrics) => set({ generatedLyrics: lyrics }),
      
      setActiveRoom: (roomId) => set((state) => {
        if (state.isProjectFinalized && ["01", "02", "03", "04", "05"].includes(roomId)) {
          return state; 
        }
        return { activeRoom: roomId };
      }),

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

      addToast: (message, type) => {
        const id = Math.random().toString(36).substring(7);
        set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
        setTimeout(() => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })), 4000);
      },
      removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })),

      clearMatrix: () => set((state) => {
        saveAudioToDisk('matrix_audio_data', null);
        saveAudioToDisk('matrix_vocal_stems', []);
        saveAudioToDisk('matrix_final_master', null);
        
        return {
          audioData: null, flowDNA: null, generatedLyrics: null, vocalStems: [], activeRoom: "01",
          gwTitle: "", gwPrompt: "", gwStyle: "getnice_hybrid", activeProjectId: null, isProjectFinalized: false, finalMaster: null,
          mdxJobId: null, mdxStatus: "idle",
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
          }
        };
      }),

      // --- SURGICAL FIX: The Ledger Pull ---
      // Automatically fetches your true balances from the DB to prevent UI exploits/wipes
syncLedger: async () => {
        const state = get();
        if (!state.userSession?.id) return;
        try {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', state.userSession.id)
            .maybeSingle(); // <--- SURGICAL FIX: Prevents 406 crashes on ghost accounts
            
          if (data) {
            set({
              userSession: {
                ...state.userSession,
                marketingCredits: data.marketing_credits,
                walletBalance: data.wallet_balance
              } as any
            });
          }
        } catch (err) {
          console.error("Ledger sync failed", err);
        }
      },

      hydrateDiskAudio: async () => {
        try {
          // Rescue the user's balances from the database immediately on boot
          await get().syncLedger();

          const savedBeat = await loadAudioFromDisk('matrix_audio_data');
          const savedStems = await loadAudioFromDisk('matrix_vocal_stems');
          const savedMaster = await loadAudioFromDisk('matrix_final_master'); 

          if (savedBeat && (savedBeat as any).blob) {
            set({ audioData: { ...(savedBeat as any), url: URL.createObjectURL((savedBeat as any).blob) } });
          } else if (savedBeat) {
             set({ audioData: savedBeat as AudioAnalysis });
          }

          if (savedStems && Array.isArray(savedStems)) {
            const revivedStems = savedStems.map((stem: any) => ({
              ...stem,
              url: stem.blob ? URL.createObjectURL(stem.blob) : stem.url
            }));
            set({ vocalStems: revivedStems });
          }

          if (savedMaster && (savedMaster as any).blob) {
             set({ finalMaster: { ...(savedMaster as any), url: URL.createObjectURL((savedMaster as any).blob) } });
          }
        } catch (e) {
          console.error("Failed to hydrate audio from disk", e);
        }
      }
    }),
    {
      name: 'barcode-matrix-storage', 
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        flowDNA: state.flowDNA,
        blueprint: state.blueprint, 
        generatedLyrics: state.generatedLyrics,
        gwTitle: state.gwTitle,
        gwPrompt: state.gwPrompt,
        gwStyle: state.gwStyle,
        mixParams: state.mixParams,
        anrData: state.anrData,
        playbackMode: state.playbackMode,
        radioTrack: state.radioTrack,
        activeProjectId: state.activeProjectId,
        isProjectFinalized: state.isProjectFinalized,
        activeRoom: state.activeRoom,
        // --- SURGICAL FIX: Store the Session to prevent amnesia ---
        hasAccess: state.hasAccess,
        userSession: state.userSession
      }),
    }
  )
);