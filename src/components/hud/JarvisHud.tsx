/**
 * JarvisHud — Visual overlay elements that make this feel like Iron Man's HUD
 *
 * Corner brackets, scan lines, data readouts, hexagonal grid,
 * floating telemetry numbers. Pure visual — no interactivity.
 */

export function JarvisHud() {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5, overflow: "hidden" }}>
      {/* Corner brackets — Iron Man style */}
      <CornerBracket position="top-left" />
      <CornerBracket position="top-right" />
      <CornerBracket position="bottom-left" />
      <CornerBracket position="bottom-right" />

      {/* Horizontal scan lines */}
      <div style={{
        position: "absolute",
        top: "22%",
        left: 0,
        right: 0,
        height: 1,
        background: "linear-gradient(90deg, transparent 0%, rgba(120,200,255,0.08) 15%, rgba(120,200,255,0.12) 50%, rgba(120,200,255,0.08) 85%, transparent 100%)",
      }} />
      <div style={{
        position: "absolute",
        bottom: "18%",
        left: 0,
        right: 0,
        height: 1,
        background: "linear-gradient(90deg, transparent 0%, rgba(120,200,255,0.06) 20%, rgba(120,200,255,0.1) 50%, rgba(120,200,255,0.06) 80%, transparent 100%)",
      }} />

      {/* Vertical guide lines */}
      <div style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: "32%",
        width: 1,
        background: "linear-gradient(180deg, transparent 0%, rgba(120,200,255,0.04) 20%, rgba(120,200,255,0.06) 50%, rgba(120,200,255,0.04) 80%, transparent 100%)",
      }} />
      <div style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        right: "32%",
        width: 1,
        background: "linear-gradient(180deg, transparent 0%, rgba(120,200,255,0.04) 20%, rgba(120,200,255,0.06) 50%, rgba(120,200,255,0.04) 80%, transparent 100%)",
      }} />

      {/* Floating telemetry data points */}
      <TelemetryPoint x="8%" y="42%" label="SYS" value="ONLINE" />
      <TelemetryPoint x="88%" y="38%" label="MEM" value="ACTIVE" />
      <TelemetryPoint x="12%" y="78%" label="HRV" value="--" />
      <TelemetryPoint x="85%" y="72%" label="SPO2" value="--" />

      {/* Circular reticle around avatar center */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 200,
        height: 200,
        borderRadius: "50%",
        border: "1px solid rgba(120,200,255,0.06)",
      }} />
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 280,
        height: 280,
        borderRadius: "50%",
        border: "1px dashed rgba(120,200,255,0.04)",
      }} />

      {/* Tiny tick marks on the circles */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * 360;
        const rad = (angle * Math.PI) / 180;
        const r = 100;
        const x = 50 + (r / 2.8) * Math.cos(rad);
        const y = 50 + (r / 2.8) * Math.sin(rad);
        return (
          <div key={i} style={{
            position: "absolute",
            left: `${x}%`,
            top: `${y}%`,
            width: 6,
            height: 1,
            background: "rgba(120,200,255,0.15)",
            transform: `rotate(${angle}deg)`,
          }} />
        );
      })}

      {/* Bottom status bar */}
      <div style={{
        position: "absolute",
        bottom: 4,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: 16,
        alignItems: "center",
      }}>
        <StatusDot active />
        <span style={{ fontSize: 7, letterSpacing: "0.2em", color: "rgba(120,200,255,0.25)", fontFamily: "inherit", textTransform: "uppercase" }}>
          holoself os v0.3
        </span>
        <StatusDot />
      </div>
    </div>
  );
}

function CornerBracket({ position }: { position: "top-left" | "top-right" | "bottom-left" | "bottom-right" }) {
  const size = 18;
  const thickness = 1;
  const color = "rgba(120,200,255,0.2)";
  const offset = 8;

  const styles: Record<string, React.CSSProperties> = {
    "top-left": { top: offset, left: offset, borderTop: `${thickness}px solid ${color}`, borderLeft: `${thickness}px solid ${color}` },
    "top-right": { top: offset, right: offset, borderTop: `${thickness}px solid ${color}`, borderRight: `${thickness}px solid ${color}` },
    "bottom-left": { bottom: offset, left: offset, borderBottom: `${thickness}px solid ${color}`, borderLeft: `${thickness}px solid ${color}` },
    "bottom-right": { bottom: offset, right: offset, borderBottom: `${thickness}px solid ${color}`, borderRight: `${thickness}px solid ${color}` },
  };

  return (
    <div style={{
      position: "absolute",
      width: size,
      height: size,
      ...styles[position],
    }} />
  );
}

function TelemetryPoint({ x, y, label, value }: { x: string; y: string; label: string; value: string }) {
  return (
    <div style={{
      position: "absolute",
      left: x,
      top: y,
      display: "flex",
      flexDirection: "column",
      gap: 1,
    }}>
      <span style={{ fontSize: 6, letterSpacing: "0.15em", color: "rgba(120,200,255,0.2)", fontFamily: "inherit" }}>
        {label}
      </span>
      <span style={{ fontSize: 8, color: "rgba(120,200,255,0.15)", fontFamily: "inherit", letterSpacing: "0.06em" }}>
        {value}
      </span>
    </div>
  );
}

function StatusDot({ active = false }: { active?: boolean }) {
  return (
    <div style={{
      width: 3,
      height: 3,
      borderRadius: "50%",
      background: active ? "rgba(100,255,180,0.4)" : "rgba(120,200,255,0.15)",
      boxShadow: active ? "0 0 4px rgba(100,255,180,0.3)" : "none",
    }} />
  );
}
