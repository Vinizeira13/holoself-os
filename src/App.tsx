import { Canvas } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useState } from "react";
import { HoloScene } from "./components/avatar/HoloScene";
import { HudOverlay } from "./components/hud/HudOverlay";
import { AgentPanel } from "./components/hud/AgentPanel";
import { SettingsPanel } from "./components/hud/SettingsPanel";
import { VitaminDWidget } from "./components/health/VitaminDWidget";
import { ScheduleWidget } from "./components/health/ScheduleWidget";
import { useAgentStore } from "./stores/agentStore";
import type { OcrResult } from "./types/health";

export default function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showWidgets, setShowWidgets] = useState(true);
  const fetchAgentMessage = useAgentStore((s) => s.fetchMessage);

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

    setOcrStatus("A analisar PDF clínico...");
    try {
      if (typeof window.__TAURI__ !== "undefined") {
        const { invoke } = await import("@tauri-apps/api/core");
        const result = await invoke<OcrResult>("ocr_clinical_pdf", {
          filePath: pdf.name,
        });
        setOcrStatus(`${result.markers.length} marcadores extraídos.`);
      } else {
        setOcrStatus("OCR disponível apenas no Tauri.");
      }
    } catch (err) {
      setOcrStatus(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
    setTimeout(() => setOcrStatus(null), 5000);
  }, []);

  // Speak agent message via Cartesia TTS
  const handleSpeak = useCallback(async () => {
    try {
      if (typeof window.__TAURI__ !== "undefined") {
        const { invoke } = await import("@tauri-apps/api/core");
        const audioBytes = await invoke<number[]>("speak_agent_message");
        // Play audio via Web Audio API
        const audioContext = new AudioContext();
        const buffer = new Uint8Array(audioBytes).buffer;
        const audioBuffer = await audioContext.decodeAudioData(buffer);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();
      }
    } catch (err) {
      console.error("TTS error:", err);
    }
  }, []);

  return (
    <div
      style={{ width: "100%", height: "100%", position: "relative", background: "transparent" }}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Drag region */}
      <div
        data-tauri-drag-region
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 32, zIndex: 100 }}
      />

      {/* Top-right controls */}
      <div style={{ position: "absolute", top: 8, right: 12, zIndex: 110, display: "flex", gap: 8, pointerEvents: "auto" }}>
        <button onClick={() => setShowWidgets(!showWidgets)} style={iconBtnStyle} title="Widgets">
          {showWidgets ? "◉" : "○"}
        </button>
        <button onClick={handleSpeak} style={iconBtnStyle} title="Falar">
          ♪
        </button>
        <button onClick={() => setShowSettings(true)} style={iconBtnStyle} title="Configurações">
          ⚙
        </button>
      </div>

      {/* 3D Canvas */}
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

      {/* HUD */}
      <HudOverlay />

      {/* Health Widgets */}
      {showWidgets && (
        <div style={{ position: "absolute", top: 90, left: 16, right: 16, zIndex: 50, pointerEvents: "none" }}>
          <VitaminDWidget />
          <ScheduleWidget />
        </div>
      )}

      {/* Agent Panel */}
      <AgentPanel />

      {/* Settings */}
      <SettingsPanel visible={showSettings} onClose={() => setShowSettings(false)} />

      {/* OCR toast */}
      {ocrStatus && (
        <div className="fade-in holo-card" style={{
          position: "absolute", top: 80, left: 16, right: 16,
          padding: "10px 16px", fontSize: 12,
          color: "rgba(100, 255, 180, 0.9)", zIndex: 200, textAlign: "center",
        }}>
          {ocrStatus}
        </div>
      )}

      {/* Drop zone */}
      {isDragging && (
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(120, 200, 255, 0.08)",
          border: "2px dashed rgba(120, 200, 255, 0.4)",
          borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 200, pointerEvents: "none",
        }}>
          <span style={{ color: "rgba(120, 200, 255, 0.9)", fontSize: 16, fontWeight: 500 }}>
            Soltar PDF para análise clínica
          </span>
        </div>
      )}
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  background: "rgba(255, 255, 255, 0.05)",
  border: "1px solid rgba(120, 200, 255, 0.15)",
  color: "rgba(120, 200, 255, 0.7)",
  fontSize: 13,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
