import { Canvas } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ErrorBoundary } from "./components/hud/ErrorBoundary";
import { HoloScene } from "./components/avatar/HoloScene";
import { HudOverlay } from "./components/hud/HudOverlay";
import { AgentPanel } from "./components/hud/AgentPanel";
import { SettingsPanel } from "./components/hud/SettingsPanel";
import { ToastContainer, useToastStore } from "./components/hud/Toast";
import { VitaminDWidget } from "./components/health/VitaminDWidget";
import { ScheduleWidget } from "./components/health/ScheduleWidget";
import { BlinkRateWidget } from "./components/health/BlinkRateWidget";
import { WpmWidget } from "./components/health/WpmWidget";
import { IconSettings, IconVolume, IconEye, IconEyeOff } from "./components/hud/Icons";
import { JarvisHud } from "./components/hud/JarvisHud";
import { useAgentStore } from "./stores/agentStore";
import type { OcrResult } from "./types/health";

export default function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWidgets, setShowWidgets] = useState(true);
  const fetchAgentMessage = useAgentStore((s) => s.fetchMessage);
  const speakCurrent = useAgentStore((s) => s.speakCurrent);
  const autoSpeak = useAgentStore((s) => s.autoSpeak);
  const setAutoSpeak = useAgentStore((s) => s.setAutoSpeak);
  const toast = useToastStore((s) => s.add);

  // Detect Tauri env for transparent background
  useEffect(() => {
    if (typeof window.__TAURI__ !== "undefined") {
      document.documentElement.classList.add("tauri-env");
    }
  }, []);

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
              <VitaminDWidget />
            </div>
            <div className="slide-in-left stagger-2">
              <BlinkRateWidget />
            </div>
            <div className="slide-in-left stagger-3">
              <WpmWidget />
            </div>
          </div>
        )}

        {/* RIGHT PANEL: Schedule + extras */}
        {showWidgets && (
          <div className="hud-panel-right">
            <div className="slide-in-right stagger-1">
              <ScheduleWidget />
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

      {/* Drag region for window move */}
      <div
        data-tauri-drag-region
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 28, zIndex: 1000 }}
      />
    </div>
  );
}
