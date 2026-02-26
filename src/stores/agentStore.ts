import { create } from "zustand";
import type { AgentMessage } from "../types/health";

// Singleton AudioContext — reused across all TTS calls
let _audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext {
  if (!_audioCtx || _audioCtx.state === "closed") {
    _audioCtx = new AudioContext();
  }
  return _audioCtx;
}

// === Global speech queue — prevents overlapping audio ===
let _isSpeaking = false;
const _speechQueue: Array<() => Promise<void>> = [];

async function processSpeechQueue() {
  if (_isSpeaking || _speechQueue.length === 0) return;
  _isSpeaking = true;
  const task = _speechQueue.shift()!;
  try {
    await task();
  } finally {
    _isSpeaking = false;
    // Process next in queue
    processSpeechQueue();
  }
}

/** Play audio bytes through the singleton AudioContext. Returns a promise that resolves when playback ends. */
async function playAudioBytes(audioBytes: number[]): Promise<void> {
  const audioCtx = getAudioCtx();
  try {
    if (audioCtx.state === "suspended") await audioCtx.resume();
    const buffer = new Uint8Array(audioBytes).buffer;
    const audioBuffer = await audioCtx.decodeAudioData(buffer);
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    await new Promise<void>((resolve) => {
      source.onended = () => resolve();
      source.start();
    });
  } catch (err) {
    // Reset audio context on decode/playback failure to avoid stuck state
    try { _audioCtx = null; audioCtx.close(); } catch { /* ignore close errors */ }
    console.warn("[HoloSelf] Audio playback error:", err);
  }
}

/** Queue a text-to-speech request. Prevents overlapping. */
export function queueSpeak(getText: () => Promise<number[]>): void {
  _speechQueue.push(async () => {
    const audioBytes = await getText();
    await playAudioBytes(audioBytes);
  });
  processSpeechQueue();
}

interface AgentState {
  message: AgentMessage | null;
  isLoading: boolean;
  isSpeaking: boolean;
  error: string | null;
  autoSpeak: boolean;
  lastSpokenId: number;
  fetchMessage: () => Promise<void>;
  clearMessage: () => void;
  setAutoSpeak: (v: boolean) => void;
  speakCurrent: () => Promise<void>;
  /** Speak arbitrary text through the global queue */
  speakText: (text: string) => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  message: null,
  isLoading: false,
  isSpeaking: false,
  error: null,
  autoSpeak: true,
  lastSpokenId: 0,

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
      const msgId = Date.now(); // Unique ID per fetch
      set({ message, isLoading: false });

      // Auto-speak if enabled and message is new (prevents duplicate speaks)
      if (get().autoSpeak && msgId > get().lastSpokenId) {
        set({ lastSpokenId: msgId });
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
    if (typeof window.__TAURI__ === "undefined") return;

    queueSpeak(async () => {
      set({ isSpeaking: true });
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const audioBytes = await invoke<number[]>("speak_agent_message");
        return audioBytes;
      } finally {
        set({ isSpeaking: false });
      }
    });
  },

  speakText: (text: string) => {
    if (typeof window.__TAURI__ === "undefined") return;

    queueSpeak(async () => {
      set({ isSpeaking: true });
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const audioBytes = await invoke<number[]>("speak", { text });
        return audioBytes;
      } finally {
        set({ isSpeaking: false });
      }
    });
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
