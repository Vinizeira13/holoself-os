import { Canvas } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useState } from "react";
import { HoloScene } from "./components/avatar/HoloScene";
import { HudOverlay } from "./components/hud/HudOverlay";
import { AgentPanel } from "./components/hud/AgentPanel";
import { useAgentStore } from "./stores/agentStore";
import type { OcrResult } from "./types/health";

export default function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const fetchAgentMessage = useAgentStore((s) => s.fetchMessage);

  useEffect(() => {
    fetchAgentMessage();
    const interval = setInterval(fetchAgentMessage, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAgentMessage]);

  // Handle PDF drag & drop for Gemini OCR
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
          filePath: pdf.name, // Tauri handles the actual file path from drag
        });
        const markerCount = result.markers.length;
        setOcrStatus(`${markerCount} marcadores extraídos com sucesso.`);
      } else {
        setOcrStatus("OCR disponível apenas no Tauri (dev mode).");
      }
    } catch (err) {
      setOcrStatus(`Erro OCR: ${err instanceof Error ? err.message : String(err)}`);
    }

    setTimeout(() => setOcrStatus(null), 5000);
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        background: "transparent",
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Drag region for frameless window */}
      <div
        data-tauri-drag-region
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 32,
          zIndex: 100,
        }}
      />

      {/* 3D Avatar Canvas — React Three Fiber */}
      <Canvas
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "transparent",
        }}
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: false }}
        camera={{ position: [0, 0, 3], fov: 45 }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <HoloScene />
        </Suspense>
      </Canvas>

      {/* HUD Overlay */}
      <HudOverlay />

      {/* Agent Message Panel */}
      <AgentPanel />

      {/* OCR Status toast */}
      {ocrStatus && (
        <div
          className="fade-in holo-card"
          style={{
            position: "absolute",
            top: 80,
            left: 16,
            right: 16,
            padding: "10px 16px",
            fontSize: 12,
            color: "rgba(100, 255, 180, 0.9)",
            zIndex: 200,
            textAlign: "center",
          }}
        >
          {ocrStatus}
        </div>
      )}

      {/* Drop zone indicator */}
      {isDragging && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(120, 200, 255, 0.08)",
            border: "2px dashed rgba(120, 200, 255, 0.4)",
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              color: "rgba(120, 200, 255, 0.9)",
              fontSize: 16,
              fontWeight: 500,
            }}
          >
            Soltar PDF para análise clínica
          </span>
        </div>
      )}
    </div>
  );
}
