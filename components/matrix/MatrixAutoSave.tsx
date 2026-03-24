"use client";

import { useEffect } from 'react';
import { useMatrixStore } from '../../store/useMatrixStore';
import { supabase } from '../../lib/supabase';

export default function MatrixAutoSave() {
  const state = useMatrixStore();

  // --- THE SURGICAL FIX: The Refresh Hydrator ---
  // When you refresh the page, this instantly pulls your audio blobs back from IndexedDB
  useEffect(() => {
    const bootMatrix = async () => {
      await state.hydrateDiskAudio();
    };
    bootMatrix();
  }, []);

  // --- YOUR ORIGINAL AUTO-SAVE ENGINE ---
  useEffect(() => {
    if (!state.userSession?.id) return;

    const saveInterval = setInterval(async () => {
      try {
        const userId = state.userSession?.id;
        if (!userId) return; 

        // EXACT MATCH to Zustand state keys. 
        // Expanded to ensure lyrics, A&R data, and mix params survive logouts
        const payload = {
          audioData: state.audioData,
          blueprint: state.blueprint,
          flowDNA: state.flowDNA,
          activeRoom: state.activeRoom,
          generatedLyrics: state.generatedLyrics,
          isProjectFinalized: state.isProjectFinalized,
          anrData: state.anrData,
          mixParams: state.mixParams,
          gwTitle: state.gwTitle,
          gwPrompt: state.gwPrompt,
          gwStyle: state.gwStyle
        };

        await supabase
          .from('matrix_sessions')
          .upsert({ 
            user_id: userId, 
            session_state: payload,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
          
      } catch (err) {
        console.error("Auto-Save matrix synchronization failed", err);
      }
    }, 30000); // 30-second strict interval

    return () => clearInterval(saveInterval);
  }, [
    state.userSession?.id, 
    state.audioData, 
    state.blueprint, 
    state.flowDNA, 
    state.activeRoom,
    state.generatedLyrics,
    state.isProjectFinalized,
    state.anrData,
    state.mixParams
  ]);

  return null; // Invisible execution
}