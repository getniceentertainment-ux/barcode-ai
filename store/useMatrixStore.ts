import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AudioAnalysis, FlowDNA, BlueprintSection, VocalStem, UserSession, FinalMaster } from '../lib/types';

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface MatrixState {
  hasAccess: boolean;
  activeRoom: string;
  userSession: UserSession | null;
  
  grantAccess: (session: UserSession) => void;
  setActiveRoom: (roomId: string) => void;

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

  finalMaster: FinalMaster | null;
  setFinalMaster: (master: FinalMaster | null) => void;

  mdxJobId: string | null;
  setMdxJobId: (id: string | null) => void;
  mdxStatus: "idle" | "processing" | "success" | "failed";
  setMdxStatus: (status: "idle" | "processing" | "success" | "failed") => void;

  isFinalized: boolean;
  setIsFinalized: (val: boolean) => void;

  toasts: ToastMessage[];
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;

  clearMatrix: () => void;
}

export const useMatrixStore = create<MatrixState>()(
  persist(
    (set, get) => ({
      hasAccess: false,
      activeRoom: "01",
      userSession: null,
      
      audioData: null,
      flowDNA: null,
      
      gwTitle: "",
      gwPrompt: "",
      gwStyle: "getnice_flow", // FIX: Replaced Hybrid with strict GetNice Flow
      gwGender: "male",
      gwUseSlang: true,
      gwUseIntel: true,

      blueprint: [
        { id: "1", type: "INTRO", bars: 4 },
        { id: "2", type: "HOOK", bars: 8 },
        { id: "3", type: "VERSE", bars: 16 }
      ],
      generatedLyrics: null,
      
      vocalStems: [],
      finalMaster: null,
      
      mdxJobId: null,
      mdxStatus: "idle",
      
      isFinalized: false,

      toasts: [],

      grantAccess: (session) => set({ hasAccess: true, userSession: session }),
      setActiveRoom: (roomId) => set({ activeRoom: roomId }),
      
      setAudioData: (data) => set({ audioData: data }),
      setFlowDNA: (dna) => set({ flowDNA: dna }),
      
      setGwTitle: (gwTitle) => set({ gwTitle }),
      setGwPrompt: (gwPrompt) => set({ gwPrompt }),
      setGwStyle: (gwStyle) => set({ gwStyle }),
      setGwGender: (gwGender) => set({ gwGender }),
      setGwUseSlang: (gwUseSlang) => set({ gwUseSlang }),
      setGwUseIntel: (gwUseIntel) => set({ gwUseIntel }),

      setBlueprint: (blueprint) => set({ blueprint }),
      setGeneratedLyrics: (lyrics) => set({ generatedLyrics: lyrics }),
      
      addVocalStem: (stem) => set((state) => ({ vocalStems: [...state.vocalStems, stem] })),
      removeVocalStem: (id) => set((state) => ({ vocalStems: state.vocalStems.filter(s => s.id !== id) })),
      updateStemVolume: (id, volume) => set((state) => ({
        vocalStems: state.vocalStems.map(s => s.id === id ? { ...s, volume } : s)
      })),

      setFinalMaster: (master) => set({ finalMaster: master }),
      setMdxJobId: (id) => set({ mdxJobId: id }),
      setMdxStatus: (status) => set({ mdxStatus: status }),
      
      setIsFinalized: (val) => set({ isFinalized: val }),

      addToast: (message, type) => {
        const id = Math.random().toString(36).substring(7);
        set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
        setTimeout(() => {
          set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }));
        }, 4000);
      },
      removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })),

      clearMatrix: () => set({
        audioData: null, flowDNA: null, generatedLyrics: null, vocalStems: [], activeRoom: "01",
        gwTitle: "", gwPrompt: "", gwStyle: "getnice_flow", gwGender: "male", gwUseSlang: true, gwUseIntel: true, 
        finalMaster: null, mdxJobId: null, mdxStatus: "idle", isFinalized: false
      })
    }),
    {
      name: 'barcode-matrix-storage', 
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        audioData: state.audioData, 
        flowDNA: state.flowDNA,
        blueprint: state.blueprint, 
        generatedLyrics: state.generatedLyrics,
        gwTitle: state.gwTitle,
        gwPrompt: state.gwPrompt,
        gwStyle: state.gwStyle,
        gwUseSlang: state.gwUseSlang,
        gwUseIntel: state.gwUseIntel,
        mdxJobId: state.mdxJobId,
        mdxStatus: state.mdxStatus,
        isFinalized: state.isFinalized,
        finalMaster: state.finalMaster ? { url: state.finalMaster.url, blob: "" as any } : null
      }),
    }
  )
);