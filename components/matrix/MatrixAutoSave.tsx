"use client";

import { useEffect } from 'react';
import { useMatrixStore } from '../../store/useMatrixStore';
import { supabase } from '../../lib/supabase';

export default function MatrixAutoSave() {
  const state = useMatrixStore();

  // --- THE HYDRATION ENGINE ---
  // When the page refreshes, pull the audio from the hard drive back into memory
  useEffect(() => {
    const bootMatrix = async () => {
      await state.hydrateDiskAudio();
    };
    bootMatrix();
  }, []);

  // --- THE CLOUD SYNC ENGINE ---
  useEffect(() => {
    if (!state.userSession?.id) return;

    const saveInterval = setInterval(async () => {
      try {
        const userId = state.userSession?.id;
        if (!userId) return; 

        // CRITICAL: We DO NOT include audioData here. 
        // Audio lives in local IndexedDB. This payload is for lightweight cloud syncing.
        const payload = {
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
    }, 30000); // 30-second interval

    return () => clearInterval(saveInterval);
  }, [
    state.userSession?.id, 
    state.blueprint, 
    state.flowDNA, 
    state.activeRoom,
    state.generatedLyrics,
    state.isProjectFinalized,
    state.anrData,
    state.mixParams
  ]);

  return null; 
}