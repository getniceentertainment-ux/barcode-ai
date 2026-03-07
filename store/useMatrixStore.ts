import { create } from 'zustand';
import { AudioAnalysis, FlowDNA, BlueprintSection, VocalStem, UserSession } from '../lib/types';

interface MatrixState {
  // --- ACCESS & NAVIGATION ---
  hasAccess: boolean;
  activeRoom: string;
  userSession: UserSession | null;
  
  grantAccess: (session: UserSession) => void;
  setActiveRoom: (roomId: string) => void;

  // --- ROOM 01 & 02: THE LAB & BRAIN TRAIN ---
  audioData: AudioAnalysis | null;
  setAudioData: (data: AudioAnalysis) => void;
  
  flowDNA: FlowDNA | null;
  setFlowDNA: (dna: FlowDNA) => void;

  // --- ROOM 03: GHOSTWRITER (Persisted Data) ---
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

  // --- ROOM 04 & 05: BOOTH & ENGINEERING ---
  vocalStems: VocalStem[];
  addVocalStem: (stem: VocalStem) => void;
  removeVocalStem: (id: string) => void;
  updateStemVolume: (id: string, volume: number) => void;

  // --- RESET MATRIX ---
  clearMatrix: () => void;
}

export const useMatrixStore = create<MatrixState>((set) => ({
  // Initial State
  hasAccess: false,
  activeRoom: "01",
  userSession: null,
  
  audioData: null,
  flowDNA: null,
  
  // Room 03 Defaults
  gwTitle: "",
  gwPrompt: "",
  gwStyle: "getnice_hybrid",
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

  // Actions
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

  clearMatrix: () => set({
    audioData: null, flowDNA: null, generatedLyrics: null, vocalStems: [], activeRoom: "01",
    gwTitle: "", gwPrompt: "", gwStyle: "drill", gwGender: "male", gwUseSlang: true, gwUseIntel: true
  })
}));