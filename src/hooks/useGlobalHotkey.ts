import { useEffect, useCallback, useRef } from "react";

/**
 * Global hotkey listener using Tauri's global shortcut API.
 * Falls back to browser keydown for dev mode.
 * Default: Cmd+Shift+H (macOS) / Ctrl+Shift+H (Windows/Linux)
 */
export function useGlobalHotkey(callback: () => void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // Browser fallback (dev mode)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "h") {
      e.preventDefault();
      callbackRef.current();
    }
  }, []);

  useEffect(() => {
    let unregister: (() => void) | null = null;

    const setup = async () => {
      if (typeof window.__TAURI__ !== "undefined") {
        try {
          // Tauri v2 global shortcut plugin
          const { register } = await import("@tauri-apps/plugin-global-shortcut");
          await register("CommandOrControl+Shift+H", () => {
            callbackRef.current();
          });
          unregister = async () => {
            const { unregister: unreg } = await import("@tauri-apps/plugin-global-shortcut");
            await unreg("CommandOrControl+Shift+H");
          };
        } catch {
          // Plugin not available, fall back to browser events
          window.addEventListener("keydown", handleKeyDown);
        }
      } else {
        window.addEventListener("keydown", handleKeyDown);
      }
    };

    setup();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (unregister) unregister();
    };
  }, [handleKeyDown]);
}
