import { useVoiceListener } from "../../hooks/useVoiceListener";
import { useAgentStore } from "../../stores/agentStore";
import { useToastStore } from "./Toast";
import { useCallback } from "react";

/**
 * VoiceOrb — always-on microphone indicator + Jarvis voice loop
 * Shows mic state: idle (dim), listening (pulse), speaking (glow), processing (spin)
 */
export function VoiceOrb() {
  const fetchMessage = useAgentStore(s => s.fetchMessage);
  const speakCurrent = useAgentStore(s => s.speakCurrent);
  const toast = useToastStore(s => s.add);

  const handleTranscript = useCallback(async (text: string) => {
    if (!text || text.length < 2) return;
    toast(`Ouvido: "${text.substring(0, 60)}${text.length > 60 ? "..." : ""}"`, "info");
    // Trigger agent refresh (agent will see voice input in memory)
    await fetchMessage();
    // Speak the response
    setTimeout(() => speakCurrent(), 500);
  }, [fetchMessage, speakCurrent, toast]);

  const voice = useVoiceListener({
    onTranscript: handleTranscript,
    enabled: false, // Start manually via toggle
    silenceThresholdMs: 1500,
    minSpeechMs: 600,
    amplitudeThreshold: 0.02,
  });

  const orbColor = voice.isProcessing
    ? "var(--holo-secondary)"
    : voice.isSpeaking
      ? "var(--holo-accent)"
      : voice.isListening
        ? "var(--holo-primary)"
        : "var(--holo-text-dim)";

  const orbAnim = voice.isProcessing
    ? "spin 1s linear infinite"
    : voice.isSpeaking
      ? "neon-pulse 0.4s ease infinite"
      : voice.isListening
        ? "neon-pulse 2s ease infinite"
        : "none";

  const statusText = voice.isProcessing
    ? "PROCESSANDO"
    : voice.isSpeaking
      ? "OUVINDO VOZ"
      : voice.isListening
        ? "MIC ATIVO"
        : "MIC OFF";

  return (
    <div className="holo-card" style={{ textAlign: "center", cursor: "pointer", pointerEvents: "auto" }} onClick={voice.toggle}>
      {/* Orb */}
      <div style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        margin: "0 auto 4px",
        border: `1.5px solid ${orbColor}`,
        boxShadow: voice.isListening ? `0 0 12px ${orbColor}, 0 0 24px ${orbColor}40` : "none",
        animation: orbAnim,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.3s ease",
      }}>
        <div style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: orbColor,
          boxShadow: `0 0 6px ${orbColor}`,
        }} />
      </div>

      <span className="holo-label" style={{ color: orbColor, fontSize: 7 }}>{statusText}</span>

      {voice.error && (
        <div style={{ fontSize: 7, color: "var(--holo-alert)", marginTop: 2 }}>
          {voice.error.substring(0, 30)}
        </div>
      )}

      {voice.lastTranscript && (
        <div style={{
          marginTop: 3,
          fontSize: 7,
          color: "var(--holo-text-dim)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          "{voice.lastTranscript.substring(0, 25)}"
        </div>
      )}
    </div>
  );
}
