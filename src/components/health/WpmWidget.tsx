import { useKeystrokeWpm, type WpmSnapshot } from "../../hooks/useKeystrokeWpm";
import { IconActivity } from "../hud/Icons";

const fatigueConfig: Record<WpmSnapshot["fatigue"], { label: string; color: string; tip: string }> = {
  none: { label: "Normal", color: "var(--holo-primary)", tip: "" },
  mild: { label: "Leve", color: "var(--holo-warm)", tip: "Considere uma pausa de 5 min." },
  moderate: { label: "Moderada", color: "#ff9800", tip: "Pausa recomendada — 10 min." },
  high: { label: "Alta", color: "var(--holo-alert)", tip: "Pare. Descanse pelo menos 15 min." },
};

const trendArrow: Record<WpmSnapshot["trend"], string> = {
  rising: "↑",
  stable: "→",
  declining: "↓",
};

export function WpmWidget() {
  const { wpm, trend, fatigue, sessionMinutes } = useKeystrokeWpm();
  const cfg = fatigueConfig[fatigue];

  return (
    <div className="holo-card" style={{ padding: "10px 12px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <IconActivity size={12} />
        <span className="holo-label">WPM TRACKER</span>
        <span
          className="holo-metric"
          style={{ marginLeft: "auto", color: cfg.color, fontSize: 11 }}
        >
          {trendArrow[trend]}
        </span>
      </div>

      {/* Main metric */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          className="holo-metric holo-glow"
          style={{ fontSize: 22, color: cfg.color }}
        >
          {wpm}
        </span>
        <span className="holo-label" style={{ fontSize: 9 }}>WPM</span>
        <span
          className="holo-label"
          style={{ marginLeft: "auto", fontSize: 9 }}
        >
          {sessionMinutes}min
        </span>
      </div>

      {/* Fatigue indicator */}
      {fatigue !== "none" && (
        <div
          style={{
            marginTop: 8,
            padding: "6px 8px",
            borderLeft: `2px solid ${cfg.color}`,
            background: `rgba(${fatigue === "high" ? "255,59,48" : fatigue === "moderate" ? "255,152,0" : "255,179,71"}, 0.08)`,
            borderRadius: 4,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, color: cfg.color, marginBottom: 2 }}>
            Fadiga {cfg.label}
          </div>
          <div style={{ fontSize: 9, color: "var(--holo-text-dim)", lineHeight: 1.3 }}>
            {cfg.tip}
          </div>
        </div>
      )}

      {/* Mini bar visualization */}
      <div style={{ marginTop: 8, height: 3, borderRadius: 2, background: "rgba(var(--holo-primary-rgb), 0.1)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${Math.min(100, (wpm / 120) * 100)}%`,
            background: cfg.color,
            borderRadius: 2,
            transition: "width 1s ease",
          }}
        />
      </div>
    </div>
  );
}
