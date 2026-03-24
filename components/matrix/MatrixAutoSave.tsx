"use client";

import { useEffect } from 'react';
import { useMatrixStore } from '../../store/useMatrixStore';
import { supabase } from '../../lib/supabase';

export default function MatrixAutoSave() {
  const state = useMatrixStore();

  // --- THE HYDRATION ENGINE ---
  useEffect(() => {
    const bootMatrix = async () => {
      await state.hydrateDiskAudio();
    };
    bootMatrix();
  }, []);

  // --- THE CLOUD SYNC ENGINE (Bypass Mode) ---
  useEffect(() => {
    if (!state.userSession?.id) return;

    const saveInterval = setInterval(async () => {
      try {
        const userId = state.userSession?.id;
        if (!userId) return; 

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

        // SURGICAL FIX: The Upsert Bypass
        // 1. Check if the session already exists
        const { data: existingSession } = await supabase
          .from('matrix_sessions')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle();

        if (existingSession) {
          // 2. If it exists, explicitly UPDATE
          const { error: updateError } = await supabase
            .from('matrix_sessions')
            .update({ 
              session_state: payload, 
              updated_at: new Date().toISOString() 
            })
            .eq('user_id', userId);
            
          if (updateError) console.error("Matrix Update Blocked:", updateError.message);
          
        } else {
          // 3. If it doesn't exist, explicitly INSERT
          const { error: insertError } = await supabase
            .from('matrix_sessions')
            .insert([{ 
              user_id: userId, 
              session_state: payload 
            }]);
            
          if (insertError) console.error("Matrix Insert Blocked:", insertError.message);
        }
          
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