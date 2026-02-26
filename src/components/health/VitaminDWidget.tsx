import { useEffect, useState } from "react";
import { LoadingSkeleton } from "../hud/LoadingSkeleton";
import { IconSun } from "../hud/Icons";

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
        setData({
          uv_index: 3,
          optimal_minutes: 25,
          d3_iu_supplement: 2000,
          best_window: "11:00 - 14:00",
          note: "UV moderado. 25 min exposição.",
        });
      }
    } catch (err) {
      console.error("VitD fetch error:", err);
    }
  };

  if (!data) return (
    <div className="holo-card" style={{ padding: "10px 14px" }}>
      <span className="holo-label">Vitamina D</span>
      <div style={{ marginTop: 6 }}><LoadingSkeleton count={2} height={14} /></div>
    </div>
  );

  const uvColor = data.uv_index < 3
    ? "var(--holo-secondary)"
    : data.uv_index < 6
      ? "var(--holo-primary)"
      : "var(--holo-accent)";

  return (
    <div className="holo-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span className="holo-label">VIT D</span>
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <IconSun size={8} />
          <span style={{ fontSize: 8, color: uvColor, fontWeight: 500 }}>UV {data.uv_index.toFixed(0)}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
        <span className="holo-metric holo-glow" style={{ color: uvColor }}>{data.optimal_minutes}</span>
        <span className="holo-label">min</span>
        {data.d3_iu_supplement > 0 && (
          <>
            <span style={{ fontSize: 12, fontWeight: 200 }}>{data.d3_iu_supplement}</span>
            <span className="holo-label">IU</span>
          </>
        )}
      </div>
      <div style={{ marginTop: 4, fontSize: 8, color: "var(--holo-text-dim)", borderLeft: `1px solid ${uvColor}`, paddingLeft: 4 }}>
        {data.best_window}
      </div>
    </div>
  );
}
