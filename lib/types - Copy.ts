export type AccessTier = "Free Loader" | "The Artist" | "The Mogul";

export interface UserSession {
  id: string;
  stageName: string; // NEW: The artist's alias
  tier: AccessTier;
  walletBalance: number;
  creditsRemaining: number | "UNLIMITED";
}

export interface AudioAnalysis {
  url: string;
  fileName: string;
  bpm: number;
  totalBars: number;
  grid?: number[];
}

export interface FlowDNA {
  tag: string;
  referenceText: string;
  syllableDensity: number;
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
  volume: number; 
}

export interface FinalMaster {
  url: string;
  blob: Blob;
}

// NEW: Project Data Structure
export interface MatrixProject {
  id: string;
  name: string;
  is_finalized: boolean;
  created_at: string;
}