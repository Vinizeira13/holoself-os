import { Canvas } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useState, useRef } from "react";
import { ErrorBoundary } from "./components/hud/ErrorBoundary";
import { HoloScene } from "./components/avatar/HoloScene";
import { HudOverlay } from "./components/hud/HudOverlay";
import { AgentPanel } from "./components/hud/AgentPanel";
import { SettingsPanel } from "./components/hud/SettingsPanel";
import { ToastContainer, useToastStore } from "./components/hud/Toast";
import { VitaminDWidget } from "./components/health/VitaminDWidget";
import { ScheduleWidget } from "./components/health/ScheduleWidget";
import { WpmWidget } from "./components/health/WpmWidget";
import { PostureWidget } from "./components/health/PostureWidget";
import { VoiceOrb } from "./components/hud/VoiceOrb";
import { IconSettings, IconVolume, IconEye, IconEyeOff } from "./components/hud/Icons";
import { JarvisHud } from "./components/hud/JarvisHud";
import { useAgentStore } from "./stores/agentStore";
import { usePresenceDetector } from "./hooks/usePresenceDetector";
import { usePostureMonitor } from "./hooks/usePostureMonitor";
import { useHealthContext, type ProactiveAlert } from "./hooks/useHealthContext";
import { useDailySummary } from "./hooks/useDailySummary";
import { SetupWizard } from "./components/setup/SetupWizard";
import type { OcrResult } from "./types/health";

export default function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [setupDone, setSetupDone] = useState<boolean | null>(null); // null = loading
  const [showWidgets, setShowWidgets] = useState(true);
  const fetchAgentMessage = useAgentStore((s) => s.fetchMessage);
  const speakCurrent = useAgentStore((s) => s.speakCurrent);
  const speakText = useAgentStore((s) => s.speakText);
  const autoSpeak = useAgentStore((s) => s.autoSpeak);
  const setAutoSpeak = useAgentStore((s) => s.setAutoSpeak);
  const toast = useToastStore((s) => s.add);
  const focusStartRef = useRef(Date.now());
  const breakCountRef = useRef(0);

  // === SETUP CHECK (onboarding) ===
  useEffect(() => {
    (async () => {
      // Check if setup was completed before (stored in localStorage)
      const done = localStorage.getItem("holoself_setup_done");
      if (done === "true") {
        setSetupDone(true);
        return;
      }

      // Check if at least Gemini key is configured (minimal requirement)
      if (typeof window.__TAURI__ !== "undefined") {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const status = await invoke<{ gemini_key: boolean }>("check_setup_status");
          if (status.gemini_key) {
            setSetupDone(true);
            localStorage.setItem("holoself_setup_done", "true");
            return;
          }
        } catch { /* continue to wizard */ }
      }

      setSetupDone(false);
    })();
  }, []);

  // === PRESENCE DETECTION (Feature 2) ===
  const presence = usePresenceDetector({
    enabled: true,
    onReturn: (awayMs) => {
      const mins = Math.floor(awayMs / 60_000);
      if (mins >= 1) {
        toast(`Bem-vindo de volta. Passaram ${mins} minuto${mins !== 1 ? "s" : ""}.`, "info");
        breakCountRef.current += 1;
        focusStartRef.current = Date.now(); // reset focus timer
      }
    },
    onLeave: () => {
      toast("Presença não detectada. Pausando agent.", "info");
    },
  });

  // === POSTURE MONITOR (Feature 3) ===
  const posture = usePostureMonitor(presence.videoRef, {
    onBadPosture: (durationMs) => {
      const mins = Math.floor(durationMs / 60_000);
      toast(`Postura baixa há ${mins}min. Endireita as costas!`, "info");
    },
  });

  // === PROACTIVE ALERTS (Feature 4) ===
  const handleAlert = useCallback((alert: ProactiveAlert) => {
    toast(alert.message, alert.priority === 1 ? "error" : "info");
    // Also speak high-priority alerts
    if (alert.priority === 1 && autoSpeak) {
      speakCurrent();
    }
  }, [toast, autoSpeak, speakCurrent]);

  useHealthContext(
    {
      wpm: 0, // Will be populated when we integrate WPM store
      wpmTrend: "stable",
      postureScore: posture.score,
      isPresent: presence.isPresent,
      focusDurationMin: Math.floor((Date.now() - focusStartRef.current) / 60_000),
      breaksTaken: breakCountRef.current,
      lastBreakAt: 0,
    },
    { onAlert: handleAlert }
  );

  // === DAILY SUMMARY (Feature 5) ===
  useDailySummary({
    enabled: true,
    onSummaryReady: async (summary) => {
      toast("Relatório diário pronto!", "info");
      // Speak through global queue (prevents overlapping)
      speakText(summary);
    },
  });

  useEffect(() => {
    fetchAgentMessage();
    const interval = setInterval(fetchAgentMessage, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAgentMessage]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    const pdf = files.find((f) => f.type === "application/pdf" || f.name.endsWith(".pdf"));
    if (!pdf) return;
    toast("A analisar PDF clínico...", "info");
    try {
      if (typeof window.__TAURI__ !== "undefined") {
        const { invoke } = await import("@tauri-apps/api/core");
        const result = await invoke<OcrResult>("ocr_clinical_pdf", { filePath: pdf.name });
        toast(`${result.markers.length} marcadores extraídos`, "success");
      } else {
        toast("OCR disponível apenas no Tauri", "info");
      }
    } catch (err) {
      toast(`Erro OCR: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  }, [toast]);

  const handleSpeak = useCallback(() => {
    speakCurrent();
  }, [speakCurrent]);

  const toggleAutoSpeak = useCallback(() => {
    const next = !autoSpeak;
    setAutoSpeak(next);
    toast(next ? "TTS automático ativado" : "TTS automático desativado", "info");
  }, [autoSpeak, setAutoSpeak, toast]);

  // Show setup wizard if not configured
  if (setupDone === null) {
    return (
      <div style={{
        width: "100%", height: "100%", display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "radial-gradient(ellipse at center, #0a0e14 0%, #000508 100%)",
        color: "var(--holo-primary)", fontFamily: "var(--font-mono)",
        fontSize: 12, letterSpacing: 2,
      }}>
        HOLOSELF OS
      </div>
    );
  }

  if (!setupDone) {
    return (
      <SetupWizard onComplete={() => {
        localStorage.setItem("holoself_setup_done", "true");
        setSetupDone(true);
      }} />
    );
  }

  return (
    <div
      style={{ width: "100%", height: "100%", position: "relative", background: "transparent" }}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* 3D Avatar — full background */}
      <ErrorBoundary>
        <Canvas
          style={{ position: "absolute", inset: 0, background: "transparent" }}
          gl={{ alpha: true, antialias: true, preserveDrawingBuffer: false }}
          camera={{ position: [0, 0, 3], fov: 45 }}
          dpr={[1, 2]}
        >
          <Suspense fallback={null}>
            <HoloScene />
          </Suspense>
        </Canvas>
      </ErrorBoundary>

      {/* Vignette darkens edges */}
      <div className="hud-vignette" />

      {/* Jarvis HUD overlay: brackets, lines, telemetry */}
      <JarvisHud />

      {/* Scanline HUD effect */}
      <div className="hud-scanline" />

      {/* HUD Grid Layout */}
      <div className="hud-container">

        {/* TOP BAR: time + controls */}
        <div className="hud-top">
          {/* Left: HUD Overlay (time, protocol status) */}
          <HudOverlay />

          {/* Right: Control buttons */}
          <div style={{ display: "flex", gap: 5 }}>
            <button
              className="holo-icon-btn"
              onClick={() => setShowWidgets(!showWidgets)}
              aria-label={showWidgets ? "Esconder widgets" : "Mostrar widgets"}
            >
              {showWidgets ? <IconEye /> : <IconEyeOff />}
            </button>
            <button className="holo-icon-btn" onClick={handleSpeak} aria-label="Falar mensagem">
              <IconVolume />
            </button>
            <button
              className="holo-icon-btn"
              onClick={toggleAutoSpeak}
              aria-label={autoSpeak ? "Desativar TTS auto" : "Ativar TTS auto"}
              style={{ opacity: autoSpeak ? 1 : 0.4 }}
            >
              <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", letterSpacing: 1 }}>AUTO</span>
            </button>
            <button className="holo-icon-btn" onClick={() => setShowSettings(true)} aria-label="Configurações">
              <IconSettings />
            </button>
          </div>
        </div>

        {/* LEFT PANEL: Health widgets */}
        {showWidgets && (
          <div className="hud-panel-left">
            <div className="slide-in-left stagger-1">
              <VoiceOrb />
            </div>
            <div className="slide-in-left stagger-2">
              <VitaminDWidget />
            </div>
            <div className="slide-in-left stagger-3">
              <WpmWidget />
            </div>
          </div>
        )}

        {/* RIGHT PANEL: Schedule + Posture + Presence */}
        {showWidgets && (
          <div className="hud-panel-right">
            <div className="slide-in-right stagger-1">
              <ScheduleWidget />
            </div>
            <div className="slide-in-right stagger-2">
              <PostureWidget posture={posture} />
            </div>
            <div className="slide-in-right stagger-3">
              <div className="holo-card" style={{ textAlign: "center" }}>
                <span className="holo-label">PRESENÇA</span>
                <div className="holo-metric" style={{
                  color: presence.isPresent ? "var(--holo-primary)" : "var(--holo-alert)",
                }}>
                  {presence.isPresent ? "ATIVO" : "AUSENTE"}
                </div>
                {!presence.cameraAvailable && (
                  <div style={{ fontSize: 7, color: "var(--holo-text-dim)", marginTop: 2 }}>Câmera indisponível</div>
                )}
                {!presence.isPresent && presence.awayDurationMs > 60_000 && (
                  <div style={{ fontSize: 7, color: "var(--holo-accent)", marginTop: 2 }}>
                    Fora há {Math.floor(presence.awayDurationMs / 60_000)}min
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM: Agent panel */}
        <div className="hud-bottom">
          <AgentPanel />
        </div>
      </div>

      {/* Toasts */}
      <ToastContainer />

      {/* Settings modal */}
      <SettingsPanel visible={showSettings} onClose={() => setShowSettings(false)} />

      {/* PDF Drop zone */}
      {isDragging && (
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(var(--holo-primary-rgb), 0.04)",
          border: "1px dashed rgba(var(--holo-primary-rgb), 0.3)",
          borderRadius: 16,
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 200, pointerEvents: "none",
        }}>
          <div className="scale-in" style={{ textAlign: "center" }}>
            <p style={{ color: "var(--holo-primary)", fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
              Soltar PDF para análise clínica
            </p>
            <p style={{ color: "var(--holo-text-dim)", fontSize: 10 }}>
              Gemini extrai Vitamina D, Zinco, Cortisol, TSH
            </p>
          </div>
        </div>
      )}

      {/* Hidden video for camera-based presence/posture detection */}
      <video
        ref={presence.videoRef}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        playsInline
        muted
        autoPlay
      />

      {/* Drag region for window move */}
      <div
        data-tauri-drag-region
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 28, zIndex: 1000 }}
      />
    </div>
  );
}
