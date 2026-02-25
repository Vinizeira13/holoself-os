import { useEffect, useState } from "react";

interface VitDData {
  uv_index: number;
  optimal_minutes: number;
  d3_iu_supplement: number;
  best_window: string;
  note: string;
}

export function VitaminDWidget() {
  const [data, setData] = useState<VitDData | null>(null);

  useEffect(() => {
    fetchVitD();
    // Refresh every 2 hours
    const interval = setInterval(fetchVitD, 2 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchVitD = async () => {
    try {
      if (typeof window.__TAURI__ !== "undefined") {
        const { invoke } = await import("@tauri-apps/api/core");
        const uv = await invoke<number>("get_current_uv_index", {});
        const rec = await invoke<VitDData>("get_vitamin_d_recommendation", { uvIndex: uv });
        setData(rec);
      } else {
        // Mock for dev
        setData({
          uv_index: 3,
          optimal_minutes: 25,
          d3_iu_supplement: 2000,
          best_window: "11:00 - 14:00",
          note: "UV moderado (3). 25 minutos de exposição solar diária.",
        });
      }
    } catch (err) {
      console.error("VitD fetch error:", err);
    }
  };

  if (!data) return null;

  const uvColor = data.uv_index < 3
    ? "rgba(180, 140, 255, 0.8)"
    : data.uv_index < 6
      ? "rgba(120, 200, 255, 0.8)"
      : "rgba(100, 255, 180, 0.8)";

  return (
    <div className="holo-card fade-in" style={{ padding: "12px 16px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={labelStyle}>Vitamina D</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: uvColor, boxShadow: `0 0 6px ${uvColor}` }} />
          <span style={{ fontSize: 11, color: uvColor }}>UV {data.uv_index.toFixed(0)}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
        <div>
          <span style={valueStyle}>{data.optimal_minutes}</span>
          <span style={unitStyle}>min sol</span>
        </div>
        {data.d3_iu_supplement > 0 && (
          <div>
            <span style={valueStyle}>{data.d3_iu_supplement}</span>
            <span style={unitStyle}>IU/dia</span>
          </div>
        )}
        <div>
          <span style={{ ...valueStyle, fontSize: 12 }}>{data.best_window}</span>
          <span style={unitStyle}>janela</span>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 9,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "rgba(255, 255, 255, 0.4)",
};

const valueStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 300,
  color: "rgba(255, 255, 255, 0.9)",
  display: "block",
};

const unitStyle: React.CSSProperties = {
  fontSize: 9,
  color: "rgba(255, 255, 255, 0.4)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};
