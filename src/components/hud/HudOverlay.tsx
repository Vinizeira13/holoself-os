import { useEffect, useState } from "react";

/**
 * HudOverlay — Top-left time + protocol status
 * Calm Technology: shows only what's needed, when needed.
 */
export function HudOverlay() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const hour = time.getHours();
  const mins = time.getMinutes().toString().padStart(2, "0");
  const period = getTimePeriod(hour);

  return (
    <div style={{ pointerEvents: "none" }}>
      {/* Time display */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          className="holo-glow holo-metric"
          style={{ color: "var(--holo-primary)" }}
        >
          {hour}:{mins}
        </span>
      </div>

      {/* Protocol status */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
        <div
          className="status-dot neon-pulse"
          style={{ color: period.color, background: period.color }}
        />
        <span className="holo-label" style={{ fontSize: 7 }}>
          {period.status}
        </span>
      </div>
    </div>
  );
}

function getTimePeriod(hour: number) {
  if (hour >= 8 && hour < 12) {
    return { status: "Protocolo Matinal", color: "var(--holo-accent)" };
  }
  if (hour >= 12 && hour < 18) {
    return { status: "Foco Ativo", color: "var(--holo-primary)" };
  }
  if (hour >= 18 && hour < 23) {
    return { status: "Wind-down", color: "var(--holo-secondary)" };
  }
  return { status: "Protocolo Noturno", color: "var(--holo-secondary)" };
}
