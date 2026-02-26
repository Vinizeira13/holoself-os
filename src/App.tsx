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
import { IconSettings, IconVolume, IconEye, IconEyeOff } from "./components/hud/Icons";
import { useAgentStore } from "./stores/agentStore";
import type { OcrResult } from "./types/health";

export default function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWidgets, setShowWidgets] = useState(true);
  const fetchAgentMessage = useAgentStore((s) => s.fetchMessage);
  const toast = useToastStore((s) => s.add);

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
        toast(`${result.markers.length} marcadores extraídos com sucesso.`, "success");
      } else {
        toast("OCR disponível apenas no Tauri.", "info");
      }
    } catch (err) {
      toast(`Erro OCR: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  }, [toast]);

  const handleSpeak = useCallback(async () => {
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
      } else {
        toast("TTS disponível apenas no Tauri.", "info");
      }
    } catch (err) {
      toast(`Erro TTS: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  }, [toast]);

  return (
    <div
      style={{ width: "100%", height: "100%", position: "relative", background: "transparent" }}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Drag region */}
      <div data-tauri-drag-region style={{ position: "absolute", top: 0, left: 0, right: 0, height: 32, zIndex: 100 }} />

      {/* Top-right controls */}
      <div style={{ position: "absolute", top: 8, right: 12, zIndex: 110, display: "flex", gap: 6 }}>
        <button className="holo-icon-btn" onClick={() => setShowWidgets(!showWidgets)} aria-label={showWidgets ? "Esconder widgets" : "Mostrar widgets"} title={showWidgets ? "Esconder" : "Mostrar"}>
          {showWidgets ? <IconEye /> : <IconEyeOff />}
        </button>
        <button className="holo-icon-btn" onClick={handleSpeak} aria-label="Falar mensagem" title="Falar">
          <IconVolume />
        </button>
        <button className="holo-icon-btn" onClick={() => setShowSettings(true)} aria-label="Configurações" title="Configurações">
          <IconSettings />
        </button>
      </div>

      {/* 3D Canvas */}
      <ErrorBoundary>
        <Canvas
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "transparent" }}
          gl={{ alpha: true, antialias: true, preserveDrawingBuffer: false }}
          camera={{ position: [0, 0, 3], fov: 45 }}
          dpr={[1, 2]}
        >
          <Suspense fallback={null}>
            <HoloScene />
          </Suspense>
        </Canvas>
      </ErrorBoundary>

      {/* HUD */}
      <HudOverlay />

      {/* Toasts */}
      <ToastContainer />

      {/* Health Widgets */}
      {showWidgets && (
        <div className="slide-up scroll-area" style={{ position: "absolute", top: 90, left: 16, right: 16, zIndex: 50, pointerEvents: "none" }}>
          <VitaminDWidget />
          <BlinkRateWidget />
          <ScheduleWidget />
        </div>
      )}

      {/* Agent Panel */}
      <AgentPanel />

      {/* Settings */}
      <SettingsPanel visible={showSettings} onClose={() => setShowSettings(false)} />

      {/* Drop zone */}
      {isDragging && (
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(120, 200, 255, 0.06)",
          border: "2px dashed rgba(120, 200, 255, 0.35)",
          borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 200, pointerEvents: "none",
        }}>
          <div className="scale-in" style={{ textAlign: "center" }}>
            <p style={{ color: "rgba(120, 200, 255, 0.9)", fontSize: 15, fontWeight: 500, marginBottom: 4 }}>
              Soltar PDF para análise clínica
            </p>
            <p style={{ color: "rgba(255, 255, 255, 0.4)", fontSize: 11 }}>
              Gemini extrai Vitamina D, Zinco, Cortisol, TSH e mais
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
