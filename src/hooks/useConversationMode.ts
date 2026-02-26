import { useCallback, useRef, useState } from "react";

export interface ConversationTurn {
  role: "user" | "agent";
  text: string;
  timestamp: number;
}

export type ConvoState = "idle" | "listening" | "processing" | "speaking";

interface ConversationOptions {
  onUserMessage: (text: string, history: ConversationTurn[]) => Promise<string>;
  onAgentSpeak: (text: string) => Promise<void>;
  windowMs?: number; // conversation window (default 30s after agent finishes)
  maxTurns?: number; // max turns before auto-close (default 10)
}

const DEFAULT_WINDOW_MS = 30_000;
const DEFAULT_MAX_TURNS = 10;

/**
 * useConversationMode — multi-turn voice conversation state machine.
 * Flow: idle → listening → processing → speaking → listening (loops for windowMs)
 * After agent speaks, mic reopens for windowMs. If user speaks again, continues.
 * If silence for windowMs after speaking, conversation ends.
 */
export function useConversationMode(options: ConversationOptions) {
  const {
    onUserMessage,
    onAgentSpeak,
    windowMs = DEFAULT_WINDOW_MS,
    maxTurns = DEFAULT_MAX_TURNS,
  } = options;

  const [state, setState] = useState<ConvoState>("idle");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const windowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnsRef = useRef<ConversationTurn[]>([]);

  const endConversation = useCallback(() => {
    if (windowTimerRef.current) { clearTimeout(windowTimerRef.current); windowTimerRef.current = null; }
    setState("idle");
    // Keep turns for display, reset on next start
  }, []);

  const processUserInput = useCallback(async (text: string) => {
    if (windowTimerRef.current) { clearTimeout(windowTimerRef.current); windowTimerRef.current = null; }

    const userTurn: ConversationTurn = { role: "user", text, timestamp: Date.now() };
    turnsRef.current = [...turnsRef.current, userTurn];
    setTurns([...turnsRef.current]);

    // Check max turns
    if (turnsRef.current.length >= maxTurns * 2) {
      endConversation();
      return;
    }

    setState("processing");

    try {
      const response = await onUserMessage(text, turnsRef.current);

      const agentTurn: ConversationTurn = { role: "agent", text: response, timestamp: Date.now() };
      turnsRef.current = [...turnsRef.current, agentTurn];
      setTurns([...turnsRef.current]);

      setState("speaking");

      // Speak the response
      await onAgentSpeak(response);

      // After speaking, reopen window for more input
      setState("listening");
      windowTimerRef.current = setTimeout(() => {
        endConversation();
      }, windowMs);
    } catch {
      endConversation();
    }
  }, [onUserMessage, onAgentSpeak, windowMs, maxTurns, endConversation]);

  const startConversation = useCallback(() => {
    turnsRef.current = [];
    setTurns([]);
    setState("listening");

    // Start with window timer — if no input within windowMs, close
    windowTimerRef.current = setTimeout(() => {
      endConversation();
    }, windowMs);
  }, [windowMs, endConversation]);

  return {
    state,
    turns,
    startConversation,
    endConversation,
    processUserInput,
  };
}
