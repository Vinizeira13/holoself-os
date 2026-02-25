import { useEffect, useState } from "react";

/**
 * HudOverlay — Transparent health status overlay
 * Always-on-top minimal information display.
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
    <div
      style={{
        position: "absolute",
        top: 40,
        left: 16,
        right: 16,
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      {/* Time + Status bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            className="holo-glow"
            style={{
              fontSize: 28,
              fontWeight: 300,
              letterSpacing: "0.05em",
              color: "rgba(120, 200, 255, 0.9)",
            }}
          >
            {hour}:{mins}
          </span>
          <span
            style={{
              fontSize: 11,
              color: "rgba(255, 255, 255, 0.45)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {period.label}
          </span>
        </div>

        {/* Status indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <div
            className="holo-pulse"
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: period.color,
              boxShadow: `0 0 8px ${period.color}`,
            }}
          />
          <span
            style={{
              fontSize: 10,
              color: "rgba(255, 255, 255, 0.5)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {period.status}
          </span>
        </div>
      </div>

      {/* Subtle separator */}
      <div
        style={{
          height: 1,
          background:
            "linear-gradient(90deg, transparent, rgba(120, 200, 255, 0.2), transparent)",
        }}
      />
    </div>
  );
}

function getTimePeriod(hour: number) {
  if (hour >= 8 && hour < 12) {
    return {
      label: "Manhã",
      status: "Protocolo Matinal",
      color: "rgba(100, 255, 180, 0.8)",
    };
  }
  if (hour >= 12 && hour < 18) {
    return {
      label: "Tarde",
      status: "Foco Ativo",
      color: "rgba(120, 200, 255, 0.8)",
    };
  }
  if (hour >= 18 && hour < 23) {
    return {
      label: "Noite",
      status: "Wind-down",
      color: "rgba(180, 140, 255, 0.8)",
    };
  }
  return {
    label: "Madrugada",
    status: "Protocolo Noturno",
    color: "rgba(180, 140, 255, 0.6)",
  };
}
