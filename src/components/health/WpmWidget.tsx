import { useKeystrokeWpm, type WpmSnapshot } from "../../hooks/useKeystrokeWpm";
import { IconActivity } from "../hud/Icons";

const fatigueConfig: Record<WpmSnapshot["fatigue"], { label: string; color: string; tip: string }> = {
  none: { label: "OK", color: "var(--holo-primary)", tip: "" },
  mild: { label: "Leve", color: "var(--holo-warm)", tip: "Pausa 5min" },
  moderate: { label: "Mod", color: "#ff9800", tip: "Pausa 10min" },
  high: { label: "Alta", color: "var(--holo-alert)", tip: "Pare 15min" },
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
    <div className="holo-card">
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
        <IconActivity size={8} />
        <span className="holo-label">WPM</span>
        <span style={{ marginLeft: "auto", color: cfg.color, fontSize: 9 }}>{trendArrow[trend]}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span className="holo-metric holo-glow" style={{ color: cfg.color }}>{wpm}</span>
        <span className="holo-label">{sessionMinutes}m</span>
      </div>
      {fatigue !== "none" && (
        <div style={{ marginTop: 4, fontSize: 8, color: cfg.color, borderLeft: `1px solid ${cfg.color}`, paddingLeft: 4 }}>
          {cfg.label} — {cfg.tip}
        </div>
      )}
      <div style={{ marginTop: 4, height: 2, borderRadius: 1, background: "rgba(var(--holo-primary-rgb), 0.1)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(100, (wpm / 120) * 100)}%`, background: cfg.color, transition: "width 1s ease" }} />
      </div>
    </div>
  );
}
