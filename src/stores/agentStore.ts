import { create } from "zustand";
import type { AgentMessage } from "../types/health";

interface AgentState {
  message: AgentMessage | null;
  isLoading: boolean;
  error: string | null;
  autoSpeak: boolean;
  lastSpokenText: string | null;
  fetchMessage: () => Promise<void>;
  clearMessage: () => void;
  setAutoSpeak: (v: boolean) => void;
  speakCurrent: () => Promise<void>;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  message: null,
  isLoading: false,
  error: null,
  autoSpeak: true,
  lastSpokenText: null,

  fetchMessage: async () => {
    set({ isLoading: true, error: null });
    try {
      if (typeof window.__TAURI__ === "undefined") {
        const hour = new Date().getHours();
        const mockMessage = getMockMessage(hour);
        set({ message: mockMessage, isLoading: false });
        return;
      }

      const { invoke } = await import("@tauri-apps/api/core");
      const message = await invoke<AgentMessage>("get_agent_message");
      const prev = get().lastSpokenText;
      set({ message, isLoading: false });

      // Auto-speak if enabled and message is new
      if (get().autoSpeak && message.text !== prev) {
        get().speakCurrent();
      }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      });
    }
  },

  clearMessage: () => set({ message: null }),

  setAutoSpeak: (v) => set({ autoSpeak: v }),

  speakCurrent: async () => {
    const msg = get().message;
    if (!msg) return;
    try {
      if (typeof window.__TAURI__ !== "undefined") {
        const { invoke } = await import("@tauri-apps/api/core");
        const audioBytes = await invoke<number[]>("speak_agent_message");
        const audioCtx = new AudioContext();
        const buffer = new Uint8Array(audioBytes).buffer;
        const audioBuffer = await audioCtx.decodeAudioData(buffer);
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.start();
        set({ lastSpokenText: msg.text });
      }
    } catch {
      // TTS error — silent fail, non-critical
    }
  },
}));

// Mock messages for browser development (without Tauri runtime)
function getMockMessage(hour: number): AgentMessage {
  if (hour >= 8 && hour < 12) {
    return {
      text: "Bom dia. O Winfit está à espera — 1000mg de Vitamina C + Zinco para fortalecer o sistema imunitário e apoiar a recuperação capilar.",
      category: "supplement_reminder",
      priority: "medium",
      action: {
        action_type: "log_supplement",
        payload: { name: "Winfit", dosage: "1 saqueta", category: "morning" },
      },
    };
  }
  if (hour >= 0 && hour < 3) {
    return {
      text: "Atingimos a latência ótima. Está na hora do Magnésio Bisglicinato para proteger os folículos capilares e o sistema nervoso.",
      category: "supplement_reminder",
      priority: "medium",
      action: {
        action_type: "log_supplement",
        payload: {
          name: "Magnésio Bisglicinato",
          dosage: "1 cápsula",
          category: "night",
        },
      },
    };
  }
  return {
    text: "Sistema estável. A monitorizar indicadores de recuperação.",
    category: "health_insight",
    priority: "low",
    action: null,
  };
}

// TypeScript global augmentation for Tauri
declare global {
  interface Window {
    __TAURI__?: Record<string, unknown>;
  }
}
