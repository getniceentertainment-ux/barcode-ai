"use client";

import { useEffect } from "react";
import { useMatrixStore } from "../../store/useMatrixStore";

export default function SecurityShield() {
  const { addToast } = useMatrixStore();

  useEffect(() => {
    // 1. Block Right-Click (Context Menu)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (addToast) addToast("SECURITY PROTOCOL: Unauthorized context inspection blocked.", "error");
    };

    // 2. Block Common DevTool Keyboard Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12 Key
      if (e.key === "F12") {
        e.preventDefault();
        if (addToast) addToast("SECURITY PROTOCOL: Developer node access denied.", "error");
      }

      // Ctrl+Shift+I / Cmd+Opt+I (Open DevTools)
      // Ctrl+Shift+J / Cmd+Opt+J (Open Console)
      // Ctrl+Shift+C / Cmd+Opt+C (Inspect Element)
      // Ctrl+U / Cmd+U (View Source)
      if (
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j" || e.key === "C" || e.key === "c")) ||
        (e.metaKey && e.altKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j" || e.key === "C" || e.key === "c")) ||
        (e.ctrlKey && (e.key === "U" || e.key === "u")) ||
        (e.metaKey && (e.key === "U" || e.key === "u"))
      ) {
        e.preventDefault();
        if (addToast) addToast("SECURITY PROTOCOL: Source matrix extraction blocked.", "error");
      }
    };

    // Attach the event listeners to the entire window
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup listeners if the component unmounts
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [addToast]);

  // This component doesn't render any visible HTML, it just acts as an invisible guard.
  return null;
}