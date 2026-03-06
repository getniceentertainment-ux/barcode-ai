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

  // --- ROOM 03: GHOSTWRITER ---
  blueprint: BlueprintSection[];
  setBlueprint: (blueprint: BlueprintSection[]) => void;
  generatedLyrics: string | null;
  setGeneratedLyrics: (lyrics: string) => void;

  // --- ROOM 04 & 05: BOOTH & ENGINEERING ---
  vocalStems: VocalStem[];
  addVocalStem: (stem: VocalStem) => void;
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
  
  setBlueprint: (blueprint) => set({ blueprint }),
  setGeneratedLyrics: (lyrics) => set({ generatedLyrics: lyrics }),
  
  addVocalStem: (stem) => set((state) => ({ vocalStems: [...state.vocalStems, stem] })),
  updateStemVolume: (id, volume) => set((state) => ({
    vocalStems: state.vocalStems.map(s => s.id === id ? { ...s, volume } : s)
  })),

  clearMatrix: () => set({
    audioData: null, flowDNA: null, generatedLyrics: null, vocalStems: [], activeRoom: "01"
  })
}));