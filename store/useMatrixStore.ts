import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AudioAnalysis, FlowDNA, BlueprintSection, VocalStem, UserSession, FinalMaster } from '../lib/types';
import { saveAudioToDisk, loadAudioFromDisk } from '../lib/dawStorage';
import { supabase } from '../lib/supabase';

let cloudSaveTimeout: number | undefined;

// --- STORE HELPERS (Moved from Component) ---
function chunkWordForVisuals(word: string): string[] {
  const match = word.match(/^([^a-zA-Z]*)([a-zA-Z\']+)([^a-zA-Z]*)$/);
  if (!match || match[2].length <= 3) return [word];
  
  const pre = match[1];
  const alpha = match[2];
  const post = match[3];
  
  const vowelClusters = alpha.match(/[aeiouy]+/gi);
  if (!vowelClusters || vowelClusters.length <= 1) return [word];
  
  const chunks = [];
  let currentChunk = "";
  
  for (let i = 0; i < alpha.length; i++) {
    currentChunk += alpha[i];
    const isVowel = /[aeiouy]/i.test(alpha[i]);
    const nextIsVowel = i + 1 < alpha.length ? /[aeiouy]/i.test(alpha[i+1]) : false;
    
    if (isVowel && !nextIsVowel && i + 2 < alpha.length) {
      const remaining = alpha.slice(i + 1);
      if (/[aeiouy]/i.test(remaining)) {
        currentChunk += alpha[i+1];
        chunks.push(currentChunk);
        currentChunk = "";
        i++; 
      }
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  
  if (chunks.length > 0) {
    chunks[0] = pre + chunks[0];
    chunks[chunks.length - 1] = chunks[chunks.length - 1] + post;
  }
  
  return chunks.filter(c => c.length > 0);
}

export const FLOW_VAULT:Record<string, {array: number[], name: string, desc: string, maxSyllables: number, rhymeScheme: string, energy: number}[]>= {
  "getnice_hybrid": [
    { array: [4, 2, 2, 3, 1, 4, 2, 2, 2, 2, 4, 4], name: "Chain-Link Pivot", desc: "Long massive hold on the 1-count...", maxSyllables: 12, rhymeScheme: "AABB", energy: 8 },
    { array: [3, 1, 2, 2], name: "Platinum Bounce", desc: "1 long stretched syllable...", maxSyllables: 10, rhymeScheme: "ABAB", energy: 7 },
    { array: [6, 2, 4, 2, 2], name: "Late Drop", desc: "Leave the 1-count totally empty...", maxSyllables: 9, rhymeScheme: "AAAA", energy: 6 }
  ],
  "chopper": [
    { array: [1, 1, 1, 1], name: "Machine Gun", desc: "All rapid-fire, ultra-fast 16th-note syllables.", maxSyllables: 16, rhymeScheme: "AAAA", energy: 10 },
    { array: [2, 1, 1, 1, 1, 2], name: "Stutter Step", desc: "A standard syllable, followed by four ultra-fast...", maxSyllables: 14, rhymeScheme: "AABB", energy: 9 }
  ],
  "heartbeat": [
    { array: [2, 2, 2, 2], name: "Steady Anchor", desc: "All standard, steady 8th-note syllables.", maxSyllables: 10, rhymeScheme: "AABB", energy: 5 },
    { array: [4, 2, 2, 4, 4], name: "Delayed Pocket", desc: "A massive hold, two standard syllables...", maxSyllables: 8, rhymeScheme: "ABAB", energy: 6 }
  ],
  "triplet": [
    { array: [3, 3, 2], name: "Standard Triplet", desc: "Two long stretched syllables...", maxSyllables: 12, rhymeScheme: "AAAA", energy: 8 },
    { array: [2, 2, 2, 3, 3, 4], name: "Atmospheric Stagger", desc: "Three standard syllables...", maxSyllables: 11, rhymeScheme: "AABB", energy: 7 }
  ],
  "lazy": [
    { array: [4, 2, 2], name: "Standard Drawl", desc: "A massive lazy hold followed by two standard...", maxSyllables: 7, rhymeScheme: "AABB", energy: 3 },
    { array: [6, 2, 8], name: "Extreme Drag", desc: "An extreme delayed hold...", maxSyllables: 5, rhymeScheme: "AAAA", energy: 2 }
  ]
};

export type ExtendedAudioAnalysis = AudioAnalysis & {
  dynamic_array?: number[];
  contour?: string;
  blob?: Blob;
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

  // --- THE TIMING ENGINE ---
  quantizedLines: QuantizedLine[];
  setQuantizedLines: (lines: QuantizedLine[]) => void;
  calculateQuantizedTimeline: () => void;
  shiftWord: (lineId: string, syllableId: string, delta: number) => void;

  vocalStems: VocalStem[];
  addVocalStem: (stem: VocalStem) => void;
  removeVocalStem: (id: string) => void;
  updateStemVolume: (id: string, volume: number) => void;
  updateStemOffset: (id: string, offsetBars: number) => void;
  toggleStemMute: (id: string) => void;

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
      
      grantAccess: async (session) => { 
        await get().pullFromCloud(session.id);
        await get().hydrateDiskAudio();
        set({ hasAccess: true, userSession: session });
      },
      
      setActiveProject: (id, isFinalized) => set({ activeProjectId: id, isProjectFinalized: isFinalized }),
      setFlowDNA: (dna) => set({ flowDNA: dna }),
      s// --- UNIFIED REACTIVE SETTERS ---
      setGwTitle: (t) => set({ gwTitle: t }),
      setGwPrompt: (p) => set({ gwPrompt: p }),
      setGwGender: (g) => set({ gwGender: g }),
      setGwUseSlang: (b) => set({ gwUseSlang: b }),
      setGwUseIntel: (b) => set({ gwUseIntel: b }),
      setGwMotive: (m) => set({ gwMotive: m }),
      setGwStruggle: (s) => set({ gwStruggle: s }),
      setGwHustle: (h) => set({ gwHustle: h }),
      
      // 🚨 THESE ARE THE VERSATILE TRIGGERS 🚨
      setGwPocket: (p) => {
        set({ gwPocket: p });
        get().calculateQuantizedTimeline(); // Updates the grid UI instantly
      },
      setGwStrikeZone: (val) => {
        set({ gwStrikeZone: val });
        get().calculateQuantizedTimeline(); // Re-snaps rhymes to Orange Cells (4/12)
      },
      setGwHookType: (val) => {
        set({ gwHookType: val });
        get().calculateQuantizedTimeline();
      },
      setGwFlowEvolution: (val) => {
        set({ gwFlowEvolution: val });
        get().calculateQuantizedTimeline();
      },

      setQuantizedLines: (lines) => set({ quantizedLines: lines }), 

      // 🚨 REACTIVE TIMING SETTERS 🚨
      setAudioData: (data) => {
        set({ audioData: data });
        saveAudioToDisk('matrix_audio_data', data);
        get().calculateQuantizedTimeline();
      },

      setGeneratedLyrics: (lyrics) => {
        set({ generatedLyrics: lyrics });
        get().calculateQuantizedTimeline();
      },

      setBlueprint: (blueprint) => {
        set({ blueprint });
        get().calculateQuantizedTimeline();
      },

      setGwStyle: (s) => {
        set((state) => {
          const stylesMap: Record<string, string> = {
            "getnice_hybrid": "GetNice Hybrid [Melodic Trap]",
            "heartbeat": "Heartbeat (Boom-Bap)",
            "lazy": "Lazy (Wavy/Delayed)",
            "triplet": "Triplet (Trap)",
            "chopper": "Chopper (Fast/Tech)"
          };
          return { 
            gwStyle: s, 
            flowDNA: state.flowDNA ? { ...state.flowDNA, tag: stylesMap[s] || state.flowDNA.tag } : null 
          };
        });
        get().calculateQuantizedTimeline();
      },

      // 🚨 THE SINGLE SOURCE OF TIMING MATH 🚨
      calculateQuantizedTimeline: () => {
        const state = get();
        const { generatedLyrics, audioData, blueprint, gwStyle } = state;
        
        if (!generatedLyrics || !audioData || !blueprint || blueprint.length === 0) return;

        const trackDuration = (audioData as any).duration || 128;
        const actualBeatBars = audioData.totalBars || Math.round((trackDuration / 60) * (audioData.bpm || 120) / 4);
        const secondsPerBar = trackDuration > 0 ? (trackDuration / actualBeatBars) : (60 / (audioData.bpm || 120)) * 4;

        const rawLines = generatedLyrics.split('\n');
        const llmPools: Record<string, string[]> = { HOOK: [], VERSE: [], INTRO: [], OUTRO: [] };
        let activePoolHeader = "";

        rawLines.forEach(line => {
          const trimmed = line.trim();
          if (trimmed.startsWith('[') && trimmed.includes(']')) {
            activePoolHeader = trimmed.split(' ')[0].replace(/[^A-Z]/g, '');
            if (!llmPools[activePoolHeader]) llmPools[activePoolHeader] = [];
          } else if (activePoolHeader && trimmed.length > 0) {
            let cleanLine = trimmed.replace(/\(?[0-9]{1,2}:[0-9]{2}\)?/g, '').trim();
            if (cleanLine.match(/^(Written:|Vocal:|Bars:|Total:|Vocal Cadence:)/i)) return;
            cleanLine = cleanLine.replace(/^(?:[A-Z][,:\)]|\s*\[[A-Z]\]\s*|(?:Verse|Hook|Chorus)[^:]*:)\s*/i, '');
            cleanLine = cleanLine.replace(/\s+[A-Z][,;.]*$/i, ''); // UI Scrubber
            if (cleanLine && cleanLine !== "[Instrumental Break]") {
              llmPools[activePoolHeader].push(cleanLine);
            }
          }
        });

        const parsed: QuantizedLine[] = [];
        let lineIdCounter = 0;
        const poolPointers: Record<string, number> = { HOOK: 0, VERSE: 0, INTRO: 0, OUTRO: 0 };

        blueprint.forEach((bp, index) => {
          const blockStartBar = (bp as any).startBar !== undefined ? (bp as any).startBar : (index * 8);
          const bars = bp.bars || 8;
          const blockDurationSecs = bars * secondsPerBar;
          const blockStartTime = blockStartBar * secondsPerBar;

          parsed.push({ 
            id: `hdr-${lineIdCounter++}`, barIndex: blockStartBar, text: `[${bp.type}]`, 
            originalText: `[${bp.type}]`, startTime: blockStartTime, isHeader: true, words: [] 
          });

          let linesForThisBlock: string[] = [];
          if (bp.type === "INSTRUMENTAL") {
            linesForThisBlock = Array(bars).fill("Mmm. Mmm.");
          } else {
            const currentPool = llmPools[bp.type] || [];
            const pointer = poolPointers[bp.type] || 0;
            linesForThisBlock = currentPool.slice(pointer, pointer + bp.bars);
            poolPointers[bp.type] = pointer + linesForThisBlock.length;
            if (linesForThisBlock.length === 0) linesForThisBlock = ["(Empty Section Cache)"];
          }

          const timeForLine = blockDurationSecs / linesForThisBlock.length;
          let currentFlowTime = blockStartTime;

          const activeVariations = FLOW_VAULT[gwStyle] || FLOW_VAULT["getnice_hybrid"];
          const currentVaultObject = activeVariations[index % activeVariations.length];
          const activePattern = (bp as any).patternArray?.length > 0 ? (bp as any).patternArray : currentVaultObject.array;

          linesForThisBlock.forEach((textLine) => {
            const rawWords = textLine.split(/\s+/).filter(w => w.length > 0);
            const mappedWords: QuantizedSyllable[] = [];
            let totalLineSteps = 0;
            let tempPatternIndex = 0;

            if (textLine.startsWith('...')) totalLineSteps += 4;
            
            const wordChunksArray = rawWords.map(w => {
              const chunks = w.includes('|') ? w.split('|').filter(c => c.length > 0) : chunkWordForVisuals(w);
              chunks.forEach(() => {
                const stepVal = Number(activePattern[tempPatternIndex % activePattern.length]);
                totalLineSteps += isNaN(stepVal) ? 2 : stepVal;
                tempPatternIndex++;
              });
              return chunks;
            });

            const cleanTextEnd = textLine.slice(-1);
            if (cleanTextEnd === '.') totalLineSteps += 4;
            else if (cleanTextEnd === ',') totalLineSteps += 1;

            const timePerStep = totalLineSteps > 0 ? timeForLine / totalLineSteps : 0;
            let localWordTime = currentFlowTime;
            if (textLine.startsWith('...')) localWordTime += (4 * timePerStep);

            // 🚨 DEFINE THE GLOBAL STRIKE ZONE ANCHORS
            const STRIKE_ZONES = {
              SNARE_1: 4,  // Beat 2 (First Orange)
              SNARE_2: 12, // Beat 4 (Second Orange/Rhyme Target)
              DOWNBEAT: 0
            };

            let patternIndex = 0;
            wordChunksArray.forEach((chunks, wordIdx) => {
              const isLastWord = wordIdx === wordChunksArray.length - 1;
              const isFirstWord = wordIdx === 0;

              chunks.forEach((chunk, cIdx) => {
                const stepsRequired = Number(activePattern[patternIndex % activePattern.length]) || 2;
                patternIndex++;
                const chunkDuration = stepsRequired * timePerStep;
                
                // 1. Calculate the linear "natural" time-based slot (0-15)
                let mappedSlot = Math.min(15, Math.max(0, Math.floor(((localWordTime - currentFlowTime) / timeForLine) * 16)));

                // 2. VERSATILE STRIKE ZONE OVERRIDES
                // We only override the "Rhyme Syllable" (last syllable of the line)
                if (isLastWord && (cIdx === chunks.length - 1)) {
                  if (state.gwStrikeZone === "snare") mappedSlot = 12; // Snap to Beat 4 Orange Cell
                  else if (state.gwStrikeZone === "downbeat") mappedSlot = 0; // Snap to Beat 1 Kick
                  else if (state.gwStrikeZone === "spillover") mappedSlot = 15; // Snap to the "16" count
                }

                // 3. VERSATILE POCKET PLACEMENT (SYNCOPATION)
                // Matrix Pivot creates an internal hinge on the first Orange Cell (Beat 2)
                if (state.gwPocket === "matrix_pivot" && mappedSlot > 2 && mappedSlot < 6) {
                    mappedSlot = 4; 
                }
                
                // The Drag (Pickup) adds a slight mathematical offset to the trigger time
                let finalStartTime = localWordTime;
                if (state.gwPocket === "pickup" && (mappedSlot === 4 || mappedSlot === 12)) {
                    finalStartTime += 0.05; // Physically push the audio 50ms behind the snare
                }

                mappedWords.push({
                  id: `syl-${lineIdCounter}-${Math.random().toString(36).substr(2, 5)}`,
                  word: chunk.replace(/\|/g, ''),
                  slot: mappedSlot,
                  startTime: finalStartTime,
                  duration: chunkDuration,
                  isWordEnd: (cIdx === chunks.length - 1)
                });
                localWordTime += chunkDuration;
              });
            });

            parsed.push({ 
              id: `line-${lineIdCounter++}`,
              barIndex: Math.floor(currentFlowTime / secondsPerBar),
              text: textLine.replace(/\|/g, ''), 
              originalText: textLine,
              startTime: currentFlowTime, 
              lineDuration: timeForLine, 
              isHeader: false, 
              timestamp: `(${Math.floor(currentFlowTime / 60)}:${Math.floor(currentFlowTime % 60).toString().padStart(2, '0')})`,
              words: mappedWords 
            });
            currentFlowTime += timeForLine;
          });
        });

        set({ quantizedLines: parsed });
      },

      // 🚨 SNAKING LOGIC GLOBAL SHIFT 🚨
      shiftWord: (lineId, syllableId, delta) => {
        set((state) => {
          const trackDuration = (state.audioData as any)?.duration || 128;
          const actualBeatBars = state.audioData?.totalBars || Math.round((trackDuration / 60) * (state.audioData?.bpm || 120) / 4);
          const secondsPerBar = trackDuration > 0 ? (trackDuration / actualBeatBars) : (60 / (state.audioData?.bpm || 120)) * 4;
          const secondsPerSlot = secondsPerBar / 16;

          const newLines = state.quantizedLines.map(line => {
            if (line.id === lineId && !line.isHeader && line.words) {
              const targetIndex = line.words.findIndex(w => w.id === syllableId);
              if (targetIndex === -1) return line;

              const newWords = [...line.words];

              // Snake the target word and all words following it in the same line
              for (let i = targetIndex; i < newWords.length; i++) {
                let newSlot = newWords[i].slot + delta;
                newSlot = Math.max(0, Math.min(15, newSlot)); 
                
                newWords[i] = {
                  ...newWords[i],
                  slot: newSlot,
                  startTime: (line.barIndex * secondsPerBar) + (newSlot * secondsPerSlot)
                };
              }
              return { ...line, words: newWords };
            }
            return line;
          });
          return { quantizedLines: newLines };
        });
      },

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
        
        if (cloudSaveTimeout) {
          window.clearTimeout(cloudSaveTimeout);
        }

        cloudSaveTimeout = window.setTimeout(async () => {
          const latestState = get(); 
          const safeStemsForCloud = latestState.vocalStems.map(({ blob, ...rest }) => rest);
          const safeEngineeredVocal = latestState.engineeredVocal ? (({ blob, ...rest }) => rest)(latestState.engineeredVocal) : null;
          const safeFinalMaster = latestState.finalMaster ? (({ blob, ...rest }) => rest)(latestState.finalMaster) : null;

          const session_state = {
             audioData: latestState.audioData ? { ...latestState.audioData, blob: undefined } : null,                     
             flowDNA: latestState.flowDNA,
             blueprint: latestState.blueprint, 
             generatedLyrics: latestState.generatedLyrics,
             quantizedLines: latestState.quantizedLines, // Synchronize timings explicitly to DB!
             gwTitle: latestState.gwTitle, gwPrompt: latestState.gwPrompt, gwStyle: latestState.gwStyle, gwPocket: latestState.gwPocket, 
             gwMotive: latestState.gwMotive, gwStruggle: latestState.gwStruggle, gwHustle: latestState.gwHustle,
             gwStrikeZone: latestState.gwStrikeZone, gwHookType: latestState.gwHookType, gwFlowEvolution: latestState.gwFlowEvolution,
             mixParams: latestState.mixParams, anrData: latestState.anrData, activeProjectId: latestState.activeProjectId,
             isProjectFinalized: latestState.isProjectFinalized, activeRoom: latestState.activeRoom,
             
             vocalStems: safeStemsForCloud, 
             engineeredVocal: safeEngineeredVocal,
             finalMaster: safeFinalMaster
          };

          try {
              const { error } = await supabase
                .from('matrix_sessions')
                .upsert({ user_id: userId, session_state, updated_at: new Date().toISOString() });

            if (error) throw error;
            set({ syncStatus: "saved" });
            setTimeout(() => set({ syncStatus: "idle" }), 3000);
          } catch (err) {
            console.error("Matrix Cloud Save Failed:", err);
            set({ syncStatus: "error" });
            setTimeout(() => set({ syncStatus: "idle" }), 5000);
          }
        }, 1500); 
      },

      pullFromCloud: async (userId: string) => {
        try {
          const { data } = await supabase.from('matrix_sessions').select('session_state').eq('user_id', userId).maybeSingle();
          if (data?.session_state) {
            set({ ...data.session_state });
          }
        } catch (err) { console.error("Matrix Cloud Pull Failed:", err); }
      },

      hydrateDiskAudio: async () => {
        // [Existing hydrateDiskAudio implementation remains completely intact]
        try {
          await get().syncLedger();
          const state = get();
          
          const savedBeat = await loadAudioFromDisk('matrix_audio_data');
          const savedStems = await loadAudioFromDisk('matrix_vocal_stems');
          const savedEngineered = await loadAudioFromDisk('matrix_engineered_vocal'); 
          const savedMaster = await loadAudioFromDisk('matrix_final_master'); 

          // ... (rest of local file sync remains exactly the same as previous)
          
          let targetBeat = state.audioData;
          if (savedBeat && (savedBeat as any).blob) {
             targetBeat = { 
                 ...(state.audioData || savedBeat as any), 
                 blob: (savedBeat as any).blob,
                 url: URL.createObjectURL((savedBeat as any).blob)
             };
          } else if (targetBeat && targetBeat.url && !targetBeat.url.startsWith('blob:')) {
             try {
                 const resp = await fetch(targetBeat.url);
                 if (resp.ok) targetBeat.blob = await resp.blob();
             } catch(e) {}
          }
          if (targetBeat) set({ audioData: targetBeat });

          const cloudStems = state.vocalStems || [];
          const localStems = (savedStems && Array.isArray(savedStems)) ? savedStems : [];

          if (cloudStems.length > 0) {
             const rebuiltStems = await Promise.all(cloudStems.map(async (cStem: any) => {
                 let finalStem = { ...cStem };
                 const localMatch = localStems.find((l: any) => l.id === cStem.id);
                 
                 if (localMatch && localMatch.blob) {
                     finalStem.blob = localMatch.blob;
                 } else if (finalStem.url && !finalStem.url.startsWith('blob:')) {
                     try {
                         const resp = await fetch(finalStem.url);
                         if (resp.ok) finalStem.blob = await resp.blob();
                     } catch(e) {}
                 }
                 return finalStem;
             }));
             set({ vocalStems: rebuiltStems });
             saveAudioToDisk('matrix_vocal_stems', rebuiltStems); 
          } else if (localStems.length > 0) {
             set({ vocalStems: localStems });
          }

          const cloudEng = state.engineeredVocal;
          const localEng = (savedEngineered && Array.isArray(savedEngineered) && savedEngineered.length > 0) ? savedEngineered[0] : null;
          
          if (cloudEng) {
             let finalEng = { ...cloudEng };
             if (localEng && localEng.id === cloudEng.id && localEng.blob) {
                 finalEng.blob = localEng.blob;
             } else if (finalEng.url && !finalEng.url.startsWith('blob:')) {
                 try {
                     const resp = await fetch(finalEng.url);
                     if (resp.ok) finalEng.blob = await resp.blob();
                 } catch(e) {}
             }
             set({ engineeredVocal: finalEng });
          } else if (localEng) {
             set({ engineeredVocal: localEng });
          }

          const cloudMaster = state.finalMaster;
          const localMaster = savedMaster as any;
          
          if (cloudMaster) {
             let finalMaster = { ...cloudMaster };
             if (localMaster && localMaster.id === cloudMaster.id && localMaster.blob) {
                 finalMaster.blob = localMaster.blob;
             } else if (finalMaster.url && !finalMaster.url.startsWith('blob:')) {
                 try {
                     const resp = await fetch(finalMaster.url);
                     if (resp.ok) finalMaster.blob = await resp.blob();
                 } catch(e) {}
             }
             set({ finalMaster: finalMaster as FinalMaster });
          } else if (localMaster) {
             set({ finalMaster: localMaster as FinalMaster });
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