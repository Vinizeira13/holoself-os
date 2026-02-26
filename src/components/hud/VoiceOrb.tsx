import { useVoiceListener } from "../../hooks/useVoiceListener";
import { useGlobalHotkey } from "../../hooks/useGlobalHotkey";
import { useAgentStore } from "../../stores/agentStore";
import { useToastStore } from "./Toast";
import { useCallback, useState, useRef, useEffect } from "react";

const LISTEN_DURATION_MS = 30_000; // 30s push-to-talk window
const COOLDOWN_MS = 2_000;

type OrbMode = "ready" | "listening" | "processing" | "cooldown";

/**
 * VoiceOrb — Push-to-Talk mic (Cmd+Shift+H or click)
 * States: READY → LISTENING 30s → PROCESSING → COOLDOWN → READY
 */
export function VoiceOrb() {
  const fetchMessage = useAgentStore(s => s.fetchMessage);
  const speakCurrent = useAgentStore(s => s.speakCurrent);
  const toast = useToastStore(s => s.add);

  const [mode, setMode] = useState<OrbMode>("ready");
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTranscript = useCallback(async (text: string) => {
    if (!text || text.length < 2) return;
    toast(`Ouvido: "${text.substring(0, 60)}${text.length > 60 ? "..." : ""}"`, "info");
    await fetchMessage();
    setTimeout(() => speakCurrent(), 500);
  }, [fetchMessage, speakCurrent, toast]);

  const handleTimeout = useCallback(() => {
    // Auto-stop after 30s
    setMode("cooldown");
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    cooldownRef.current = setTimeout(() => {
      setMode("ready");
      cooldownRef.current = null;
    }, COOLDOWN_MS);
  }, []);

  const voice = useVoiceListener({
    onTranscript: handleTranscript,
    enabled: false,
    silenceThresholdMs: 1500,
    minSpeechMs: 600,
    amplitudeThreshold: 0.02,
    timeoutMs: LISTEN_DURATION_MS,
    onTimeout: handleTimeout,
  });

  // Sync processing state
  useEffect(() => {
    if (voice.isProcessing && mode === "listening") {
      setMode("processing");
    }
    if (!voice.isProcessing && mode === "processing") {
      setMode("cooldown");
      cooldownRef.current = setTimeout(() => {
        setMode("ready");
        cooldownRef.current = null;
      }, COOLDOWN_MS);
    }
  }, [voice.isProcessing, mode]);

  const activate = useCallback(() => {
    if (mode !== "ready") return;
    // Try to start mic
    voice.start();
    setMode("listening");
    setCountdown(Math.ceil(LISTEN_DURATION_MS / 1000));

    // Countdown timer
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [mode, voice]);

  const deactivate = useCallback(() => {
    if (mode === "listening") {
      voice.stop();
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      setMode("ready");
      setCountdown(0);
    }
  }, [mode, voice]);

  const handleClick = useCallback(() => {
    if (mode === "ready") activate();
    else if (mode === "listening") deactivate();
  }, [mode, activate, deactivate]);

  // Global hotkey: Cmd+Shift+H
  useGlobalHotkey(useCallback(() => {
    if (mode === "ready") activate();
    else if (mode === "listening") deactivate();
  }, [mode, activate, deactivate]));

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
    };
  }, []);

  const colors: Record<OrbMode, string> = {
    ready: "var(--holo-text-dim)",
    listening: "var(--holo-primary)",
    processing: "var(--holo-secondary)",
    cooldown: "var(--holo-accent)",
  };

  const anims: Record<OrbMode, string> = {
    ready: "none",
    listening: "neon-pulse 1.5s ease infinite",
    processing: "spin 1s linear infinite",
    cooldown: "none",
  };

  const labels: Record<OrbMode, string> = {
    ready: "⌘⇧H FALAR",
    listening: `OUVINDO ${countdown}s`,
    processing: "PROCESSANDO",
    cooldown: "AGUARDE",
  };

  const c = colors[mode];

  return (
    <div className="holo-card" style={{ textAlign: "center", cursor: mode === "cooldown" ? "wait" : "pointer", pointerEvents: "auto" }} onClick={handleClick}>
      {/* Orb */}
      <div style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        margin: "0 auto 4px",
        border: `2px solid ${c}`,
        boxShadow: mode === "listening"
          ? `0 0 16px ${c}, 0 0 32px ${c}40`
          : mode === "processing"
            ? `0 0 8px ${c}`
            : "none",
        animation: anims[mode],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.3s ease",
        position: "relative",
      }}>
        {/* Inner dot */}
        <div style={{
          width: mode === "listening" ? 12 : 8,
          height: mode === "listening" ? 12 : 8,
          borderRadius: "50%",
          background: c,
          boxShadow: `0 0 8px ${c}`,
          transition: "all 0.3s ease",
        }} />

        {/* Countdown ring */}
        {mode === "listening" && (
          <svg style={{ position: "absolute", top: -2, left: -2 }} width={36} height={36}>
            <circle
              cx={18} cy={18} r={16}
              fill="none"
              stroke={c}
              strokeWidth={2}
              strokeDasharray={`${2 * Math.PI * 16}`}
              strokeDashoffset={`${2 * Math.PI * 16 * (1 - countdown / (LISTEN_DURATION_MS / 1000))}`}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1s linear", transform: "rotate(-90deg)", transformOrigin: "center" }}
              opacity={0.5}
            />
          </svg>
        )}
      </div>

      <span className="holo-label" style={{ color: c, fontSize: 7, letterSpacing: "0.5px" }}>
        {labels[mode]}
      </span>

      {voice.isSpeaking && mode === "listening" && (
        <div style={{ fontSize: 7, color: "var(--holo-accent)", marginTop: 2 }}>VOZ DETECTADA</div>
      )}

      {voice.error && (
        <div style={{ fontSize: 7, color: "var(--holo-alert)", marginTop: 2 }}>
          {voice.error.includes("NotAllowed") ? "Mic sem permissão"
            : voice.error.includes("NotFound") ? "Mic não encontrado"
              : voice.error.substring(0, 30)}
        </div>
      )}

      {voice.lastTranscript && (
        <div style={{
          marginTop: 3, fontSize: 7, color: "var(--holo-text-dim)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          "{voice.lastTranscript.substring(0, 25)}"
        </div>
      )}
    </div>
  );
}
