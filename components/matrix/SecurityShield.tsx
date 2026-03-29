"use client";

import { useEffect } from "react";
import { useMatrixStore } from "../../store/useMatrixStore";

export default function SecurityShield() {
  // SURGICAL FIX: Using a strict selector. This safely hooks into React's lifecycle 
  // to trigger the toast without causing infinite re-renders!
  const addToast = useMatrixStore((state) => state.addToast);

  useEffect(() => {
    // --- THE TRIPWIRE EXPLOSION EFFECT ---
    const triggerTripwire = (message: string) => {
      // 1. Fire the standard Matrix error toast
      addToast(message, "error");

      // 2. Visceral Screen Flash (Injects a red glitch directly over the entire UI)
      const flash = document.createElement("div");
      flash.style.position = "fixed";
      flash.style.top = "0";
      flash.style.left = "0";
      flash.style.width = "100vw";
      flash.style.height = "100vh";
      flash.style.backgroundColor = "rgba(230, 0, 0, 0.4)";
      flash.style.zIndex = "9999999";
      flash.style.pointerEvents = "none"; // Lets clicks pass through so it doesn't break the app
      flash.style.mixBlendMode = "color-dodge";
      flash.style.transition = "opacity 0.5s ease-out";
      
      document.body.appendChild(flash);

      // Force browser reflow, then instantly fade it out
      requestAnimationFrame(() => {
        flash.style.opacity = "0";
        setTimeout(() => {
          if (document.body.contains(flash)) document.body.removeChild(flash);
        }, 500);
      });
    };

    // 1. Block Right-Click (Context Menu)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      triggerTripwire("SECURITY PROTOCOL: Unauthorized context inspection blocked.");
    };

    // 2. Block Common DevTool Keyboard Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12 Key
      if (e.key === "F12") {
        e.preventDefault();
        triggerTripwire("SECURITY PROTOCOL: Developer node access denied.");
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
        triggerTripwire("SECURITY PROTOCOL: Source matrix extraction blocked.");
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

  return null;
}