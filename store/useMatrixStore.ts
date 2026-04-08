import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AudioAnalysis, FlowDNA, BlueprintSection, VocalStem, UserSession, FinalMaster } from '../lib/types';
import { saveAudioToDisk, loadAudioFromDisk } from '../lib/dawStorage';
import { supabase } from '../lib/supabase';

// --- SURGICAL ADDITION: EXTENDED DSP TRUTH ---
export type ExtendedAudioAnalysis = AudioAnalysis & {
  dynamic_array?: number[];
  contour?: string;
};

// --- NEW: THE QUANTIZER DATA STRUCTURES ---
export interface QuantizedSyllable {
  id: string;
  word: string;
  slot: number; // 0 to 15 (16th notes)
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
  toasts: ToastMessage[];
  
  flowDNA: FlowDNA | null;
  blueprint: BlueprintSection[];
  generatedLyrics: string;
  quantizedLines: QuantizedLine[];
  
  gwTitle: string;
  gwPrompt: string;
  gwStyle: string;
  gwPocket: string;
  gwMotive: string;
  gwStruggle: string;
  gwHustle: string;
  gwGender: string;
  gwStrikeZone: string;
  gwHookType: string;
  gwFlowEvolution: string;
  
  audioData: ExtendedAudioAnalysis | null;
  
  vocalStems: VocalStem[];
  engineeredVocal: VocalStem | null;
  finalMaster: FinalMaster | null;

  mixParams: any;
  anrData: any;
  playbackMode: "prompter" | "studio" | "social";
  radioTrack: any | null;

  setAccess: (val: boolean) => void;
  setActiveRoom: (roomId: string) => void;
  setUserSession: (session: UserSession | null) => void;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;

  setFlowDNA: (dna: FlowDNA) => void;
  setBlueprint: (bp: BlueprintSection[]) => void;
  setGeneratedLyrics: (lyrics: string) => void;
  setQuantizedLines: (lines: QuantizedLine[]) => void;

  setGwTitle: (v: string) => void;
  setGwPrompt: (v: string) => void;
  setGwStyle: (v: string) => void;
  setGwPocket: (v: string) => void;
  setGwMotive: (v: string) => void;
  setGwStruggle: (v: string) => void;
  setGwHustle: (v: string) => void;
  setGwGender: (v: string) => void;
  setGwStrikeZone: (v: string) => void;
  setGwHookType: (v: string) => void;
  setGwFlowEvolution: (v: string) => void;

  setAudioData: (data: ExtendedAudioAnalysis | null) => void;
  
  addVocalStem: (stem: VocalStem) => void;
  removeVocalStem: (id: string) => void;
  updateStemOffset: (id: string, offset: number) => void;
  updateStemVolume: (id: string, vol: number) => void;
  setEngineeredVocal: (v: VocalStem | null) => void;
  setFinalMaster: (m: FinalMaster | null) => void;

  setMixParams: (p: any) => void;
  setAnrData: (d: any) => void;
  setPlaybackMode: (m: "prompter" | "studio" | "social") => void;
  setRadioTrack: (t: any) => void;

  clearMatrix: () => void;
  pushToCloud: () => Promise<void>;
  pullFromCloud: () => Promise<void>;
}

export const useMatrixStore = create<MatrixState>()(
  persist(
    (set, get) => ({
      hasAccess: false,
      activeRoom: "00",
      userSession: null,
      toasts: [],

      flowDNA: null,
      blueprint: [],
      generatedLyrics: "",
      quantizedLines: [],

      gwTitle: "UNTITLED ARTIFACT",
      gwPrompt: "",
      gwStyle: "getnice_hybrid",
      gwPocket: "syncopated",
      gwMotive: "Survival",
      gwStruggle: "Betrayal",
      gwHustle: "Street",
      gwGender: "male",
      gwStrikeZone: "downbeat",
      gwHookType: "anthemic",
      gwFlowEvolution: "static",

      audioData: null,
      
      vocalStems: [],
      engineeredVocal: null,
      finalMaster: null,

      mixParams: {
        leadVol: 1, adlibVol: 0.6, doubleVol: 0.7, beatVol: 0.8,
        eqLow: 0, eqMid: 0, eqHigh: 2,
        compressorThresh: -15, compressorRatio: 4,
        reverbMix: 0.15, reverbSize: 0.5,
        delayMix: 0.05, delayTime: 0.25,
        chorusMix: 0,
        masterLimiter: -0.1
      },
      anrData: null,
      playbackMode: "prompter",
      radioTrack: null,

      setAccess: (val) => set({ hasAccess: val }),
      setActiveRoom: (roomId) => set({ activeRoom: roomId }),
      setUserSession: (session) => {
        // SURGICAL FIX: Ensure boolean truth for token check across all instances
        if (session && (session as any).has_engineering_token !== undefined) {
           session.hasEngineeringToken = (session as any).has_engineering_token;
        }
        set({ userSession: session })
      },
      
      addToast: (message, type) => {
        const id = Math.random().toString(36).substring(2, 9);
        set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
        setTimeout(() => get().removeToast(id), 5000);
      },
      removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })),

      setFlowDNA: (dna) => set({ flowDNA: dna }),
      setBlueprint: (bp) => set({ blueprint: bp }),
      setGeneratedLyrics: (lyrics) => set({ generatedLyrics: lyrics }),
      setQuantizedLines: (lines) => set({ quantizedLines: lines }),

      setGwTitle: (v) => set({ gwTitle: v }),
      setGwPrompt: (v) => set({ gwPrompt: v }),
      setGwStyle: (v) => set({ gwStyle: v }),
      setGwPocket: (v) => set({ gwPocket: v }),
      setGwMotive: (v) => set({ gwMotive: v }),
      setGwStruggle: (v) => set({ gwStruggle: v }),
      setGwHustle: (v) => set({ gwHustle: v }),
      setGwGender: (v) => set({ gwGender: v }),
      setGwStrikeZone: (v) => set({ gwStrikeZone: v }),
      setGwHookType: (v) => set({ gwHookType: v }),
      setGwFlowEvolution: (v) => set({ gwFlowEvolution: v }),

      setAudioData: (data) => set({ audioData: data }),
      
      addVocalStem: (stem) => {
        set((state) => {
          const existing = state.vocalStems.filter(s => s.id !== stem.id);
          saveAudioToDisk('matrix_takes', [...existing, stem]);
          return { vocalStems: [...existing, stem] };
        });
      },
      removeVocalStem: (id) => set((state) => {
        const updated = state.vocalStems.filter(s => s.id !== id);
        saveAudioToDisk('matrix_takes', updated);
        return { vocalStems: updated };
      }),
      updateStemOffset: (id, offset) => set((state) => ({
        vocalStems: state.vocalStems.map(s => s.id === id ? { ...s, offsetBars: offset } : s)
      })),
      updateStemVolume: (id, vol) => set((state) => ({
        vocalStems: state.vocalStems.map(s => s.id === id ? { ...s, volume: vol } : s)
      })),

      setEngineeredVocal: (v) => {
        set({ engineeredVocal: v });
        if (v) saveAudioToDisk('matrix_engineered', [v]);
      },
      setFinalMaster: (m) => {
        set({ finalMaster: m });
        if (m) saveAudioToDisk('matrix_master', [m as any]);
      },

      setMixParams: (p) => set((state) => ({ mixParams: { ...state.mixParams, ...p } })),
      setAnrData: (d) => set({ anrData: d }),
      setPlaybackMode: (m) => set({ playbackMode: m }),
      setRadioTrack: (t) => set({ radioTrack: t }),

      clearMatrix: () => set({
        flowDNA: null, blueprint: [], generatedLyrics: "", quantizedLines: [],
        gwTitle: "UNTITLED ARTIFACT", gwPrompt: "", audioData: null,
        vocalStems: [], engineeredVocal: null, finalMaster: null, anrData: null
      }),

      pushToCloud: async () => {
        const state = get();
        if (!state.userSession) return;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error("No active auth session");

          const payload = {
            title: state.gwTitle,
            blueprint: state.blueprint,
            lyrics: state.generatedLyrics,
            quantized_lines: state.quantizedLines, // SURGICAL FIX: Ensuring sync of grid edits
            flow_style: state.gwStyle,
            audio_url: state.audioData?.url || null,
            audio_bpm: state.audioData?.bpm || null,
            mix_params: state.mixParams,
            last_saved: new Date().toISOString()
          };

          const res = await fetch('/api/ledger/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ payload })
          });
          
          if (!res.ok) throw new Error("Ledger API rejected sync");
          console.log("[MATRIX] State synchronized to cloud ledger.");
        } catch (err) {
          console.error("[MATRIX] Sync failed:", err);
        }
      },

      pullFromCloud: async () => {
        try {
          const savedTakes = await loadAudioFromDisk('matrix_takes');
          const savedEngineered = await loadAudioFromDisk('matrix_engineered');
          const savedMaster = await loadAudioFromDisk('matrix_master');
          
          if (Array.isArray(savedTakes) && savedTakes.length > 0) {
            const mapped = savedTakes.map(t => ({ ...t, url: t.blob ? URL.createObjectURL(t.blob) : t.url }));
            set({ vocalStems: mapped });
          }

          if (Array.isArray(savedEngineered) && savedEngineered.length > 0) {
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
        mixParams: state.mixParams, anrData: state.anrData, playbackMode: state.playbackMode, radioTrack: state.radioTrack
      })
    }
  )
);