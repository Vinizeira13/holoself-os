import { useEffect, useState } from "react";
import { IconCalendar } from "../hud/Icons";

interface ExamItem {
  id: number;
  exam_type: string;
  reason: string;
  scheduled_date: string;
  completed: boolean;
}

export function ScheduleWidget() {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      if (typeof window.__TAURI__ !== "undefined") {
        const { invoke } = await import("@tauri-apps/api/core");
        const generated = await invoke<Array<{
          exam_type: string; reason: string; scheduled_date: string; triggered_by: string;
        }>>("get_exam_schedule");
        const upcoming = await invoke<Array<[number, string, string, string, boolean]>>("get_upcoming_exams");

        const items: ExamItem[] = upcoming.map(([id, exam_type, reason, scheduled_date, completed]) => ({
          id, exam_type, reason, scheduled_date, completed,
        }));

        for (const gen of generated) {
          if (!items.some(i => i.exam_type === gen.exam_type)) {
            items.push({ id: 0, exam_type: gen.exam_type, reason: gen.reason, scheduled_date: gen.scheduled_date, completed: false });
          }
        }
        setExams(items);
      } else {
        setExams([
          { id: 1, exam_type: "vitamin_d_panel", reason: "Check trimestral", scheduled_date: "2026-03-08", completed: false },
          { id: 2, exam_type: "zinc_copper_panel", reason: "Rácio pós-Winfit", scheduled_date: "2026-03-15", completed: false },
          { id: 3, exam_type: "thyroid_panel", reason: "TSH semestral", scheduled_date: "2026-04-20", completed: false },
        ]);
      }
    } catch (err) {
      console.error("Schedule fetch error:", err);
    }
  };

  if (exams.length === 0) return null;

  const labels: Record<string, string> = {
    vitamin_d_panel: "Vit D",
    zinc_copper_panel: "Zn/Cu",
    autoimmune_panel: "ANA",
    magnesium_cortisol_panel: "Mg/Cortisol",
    iron_panel: "Fe/Ferritina",
    thyroid_panel: "TSH",
  };

  const visible = expanded ? exams : exams.slice(0, 3);

  return (
    <div className="holo-card">
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, cursor: "pointer", pointerEvents: "auto" }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <IconCalendar size={8} />
          <span className="holo-label">EXAMES</span>
        </div>
        <span className="holo-label">{exams.length}</span>
      </div>

      {visible.map((exam, i) => {
        const daysUntil = Math.ceil((new Date(exam.scheduled_date).getTime() - Date.now()) / 86400000);
        const urgentColor = daysUntil < 7 ? "var(--holo-warn)" : daysUntil < 14 ? "var(--holo-primary)" : "var(--holo-text-dim)";

        return (
          <div
            key={exam.id || i}
            style={{
              padding: "3px 5px",
              marginBottom: i < visible.length - 1 ? 2 : 0,
              borderLeft: `1px solid ${urgentColor}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 9, color: "var(--holo-text)", fontWeight: 500 }}>
                {labels[exam.exam_type] || exam.exam_type}
              </span>
              <span style={{ fontSize: 8, color: urgentColor }}>
                {daysUntil > 0 ? `${daysUntil}d` : "Hoje"}
              </span>
            </div>
          </div>
        );
      })}

      {exams.length > 3 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            marginTop: 3, width: "100%", padding: "2px",
            background: "none", border: "none",
            color: "var(--holo-text-dim)", fontSize: 8,
            cursor: "pointer",
          }}
        >
          +{exams.length - 3} mais
        </button>
      )}
    </div>
  );
}
