import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AudioAnalysis, FlowDNA, BlueprintSection, VocalStem, UserSession, FinalMaster } from '../lib/types';
import { saveAudioToDisk, loadAudioFromDisk } from '../lib/dawStorage'; // <-- NEW: Import Disk Engine

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

  // RADIO PLAYER STATE
  playbackMode: 'session' | 'radio';
  radioTrack: { url: string; title: string; artist: string; score: number } | null;
  setPlaybackMode: (mode: 'session' | 'radio') => void;
  setRadioTrack: (track: { url: string; title: string; artist: string; score: number } | null) => void;
  
  // MDX NEURAL STATUS
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
  
  // --- SURGICAL ADDITION: Disk Hydration ---
  hydrateDiskAudio: () => Promise<void>;
}

export const useMatrixStore = create<MatrixState>()(
  persist(
    (set) => ({
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
      blueprint: [],
      generatedLyrics: null,
      vocalStems: [],
      finalMaster: null,
      toasts: [],

      setPlaybackMode: (mode) => set({ playbackMode: mode }),
      setRadioTrack: (track) => set({ radioTrack: track }),
      setMdxJobId: (id) => set({ mdxJobId: id }),
      setMdxStatus: (status) => set({ mdxStatus: status }),
      grantAccess: (session) => set({ hasAccess: true, userSession: session }),
      setActiveRoom: (roomId) => set({ activeRoom: roomId }),
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
      
      // --- SURGICAL FIXES: Intercepting Audio to Disk ---
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

      setFinalMaster: (master) => set({ finalMaster: master }),
      
      addToast: (message, type) => {
        const id = Math.random().toString(36).substring(7);
        set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
        setTimeout(() => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })), 4000);
      },
      removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })),

      clearMatrix: () => {
        set({
          audioData: null, flowDNA: null, generatedLyrics: null, vocalStems: [], activeRoom: "01",
          gwTitle: "", gwPrompt: "", gwStyle: "getnice_hybrid", activeProjectId: null, isProjectFinalized: false, finalMaster: null,
          userSession: null, hasAccess: false, playbackMode: 'session', radioTrack: null, mdxJobId: null, mdxStatus: "idle"
        });
        // Clear the hard drive too
        saveAudioToDisk('matrix_audio_data', null);
        saveAudioToDisk('matrix_vocal_stems', []);
      },

      // --- SURGICAL ADDITION: The Boot-Up Protocol ---
      hydrateDiskAudio: async () => {
        try {
          const savedBeat = await loadAudioFromDisk('matrix_audio_data');
          const savedStems = await loadAudioFromDisk('matrix_vocal_stems');

          if (savedBeat && (savedBeat as any).blob) {
            set({ audioData: { ...(savedBeat as any), url: URL.createObjectURL((savedBeat as any).blob) } });
          } else if (savedBeat) {
             set({ audioData: savedBeat as AudioAnalysis });
          }

          if (savedStems && Array.isArray(savedStems)) {
            const revivedStems = savedStems.map((stem: any) => ({
              ...stem,
              // Critical: Generate a fresh URL for the Blob so the browser can play it
              url: stem.blob ? URL.createObjectURL(stem.blob) : stem.url
            }));
            set({ vocalStems: revivedStems });
          }
        } catch (e) {
          console.error("Failed to hydrate audio from disk", e);
        }
      }
    }),
    {
      name: 'barcode-matrix-storage', 
      storage: createJSONStorage(() => localStorage),
      // --- SURGICAL FIX: REMOVED audioData & vocalStems from localStorage ---
      partialize: (state) => ({ 
        flowDNA: state.flowDNA,
        blueprint: state.blueprint, 
        generatedLyrics: state.generatedLyrics,
        gwTitle: state.gwTitle,
        gwPrompt: state.gwPrompt,
        gwStyle: state.gwStyle,
	mixSettings: {
	    preset: string;
	    eq: { low: number; mid: number; high: number };
	    compressor: { threshold: number; ratio: number };
	    fx: { reverb: number; autotune: number };
	  };
	updateMixSettings: (newSettings: any) => void;
        playbackMode: state.playbackMode,
        radioTrack: state.radioTrack,
        activeProjectId: state.activeProjectId,
        isProjectFinalized: state.isProjectFinalized,
        activeRoom: state.activeRoom // Ensures it remembers what room you were in
      }),
    }
  )
);