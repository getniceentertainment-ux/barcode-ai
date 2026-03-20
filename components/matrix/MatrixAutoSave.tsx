"use client";

import { useEffect } from 'react';
import { useMatrixStore } from '../../store/useMatrixStore';
import { supabase } from '../../lib/supabase';

export default function MatrixAutoSave() {
  const state = useMatrixStore();

  useEffect(() => {
    if (!state.userSession?.id) return;

    const saveInterval = setInterval(async () => {
      try {
        const userId = state.userSession?.id;
        if (!userId) return; // Satisfies TypeScript strict null-check

        // Extract only the necessary payload to prevent Supabase bloat
        const payload = {
          audio_data: state.audioData,
          blueprint: state.blueprint,
          flow_dna: state.flowDNA,
          active_room: state.activeRoom
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
  }, [state.userSession?.id, state.audioData, state.blueprint, state.flowDNA, state.activeRoom]);

  return null; // Invisible execution
}