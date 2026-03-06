// --- USER & AUTH ---
export type AccessTier = "Free Node" | "The Artist" | "The Mogul";

export interface UserSession {
  id: string;
  tier: AccessTier;
  walletBalance: number;
  creditsRemaining: number | "UNLIMITED";
}

// --- MATRIX DATA STRUCTURES ---
export interface AudioAnalysis {
  url: string;
  fileName: string;
  bpm: number;
  totalBars: number;
  grid?: number[]; // The precise timestamp array from Essentia Worker 2
}

export interface FlowDNA {
  tag: string;
  referenceText: string;
  syllableDensity?: number;
}

export interface BlueprintSection {
  id: string;
  type: "INTRO" | "HOOK" | "VERSE" | "OUTRO" | "BRIDGE";
  bars: number;
}

export interface VocalStem {
  id: string;
  type: "Lead" | "Adlib" | "Double";
  url: string;
  blob?: Blob;
  volume: number; // -60 to 0 dB
}