import { create } from "zustand";
import type { AgentMessage } from "../types/health";

interface AgentState {
  message: AgentMessage | null;
  isLoading: boolean;
  error: string | null;
  fetchMessage: () => Promise<void>;
  clearMessage: () => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  message: null,
  isLoading: false,
  error: null,

  fetchMessage: async () => {
    set({ isLoading: true, error: null });
    try {
      // In development without Tauri, use mock data
      if (typeof window.__TAURI__ === "undefined") {
        const hour = new Date().getHours();
        const mockMessage = getMockMessage(hour);
        set({ message: mockMessage, isLoading: false });
        return;
      }

      const { invoke } = await import("@tauri-apps/api/core");
      const message = await invoke<AgentMessage>("get_agent_message");
      set({ message, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : String(err),
        isLoading: false,
      });
    }
  },

  clearMessage: () => set({ message: null }),
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
