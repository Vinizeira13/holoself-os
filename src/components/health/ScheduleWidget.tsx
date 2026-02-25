import { useEffect, useState } from "react";

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

        // First generate schedule based on current data
        const generated = await invoke<Array<{
          exam_type: string;
          reason: string;
          scheduled_date: string;
          triggered_by: string;
        }>>("get_exam_schedule");

        // Then get saved upcoming exams
        const upcoming = await invoke<Array<[number, string, string, string, boolean]>>("get_upcoming_exams");

        const items: ExamItem[] = upcoming.map(([id, exam_type, reason, scheduled_date, completed]) => ({
          id, exam_type, reason, scheduled_date, completed,
        }));

        // Add generated ones that aren't already saved
        for (const gen of generated) {
          const exists = items.some(i => i.exam_type === gen.exam_type);
          if (!exists) {
            items.push({
              id: 0,
              exam_type: gen.exam_type,
              reason: gen.reason,
              scheduled_date: gen.scheduled_date,
              completed: false,
            });
          }
        }

        setExams(items);
      } else {
        // Mock for dev
        setExams([
          { id: 1, exam_type: "vitamin_d_panel", reason: "Check trimestral Vitamina D", scheduled_date: "2026-03-08", completed: false },
          { id: 2, exam_type: "zinc_copper_panel", reason: "Rácio Zinco/Cobre pós-Winfit", scheduled_date: "2026-03-15", completed: false },
        ]);
      }
    } catch (err) {
      console.error("Schedule fetch error:", err);
    }
  };

  if (exams.length === 0) return null;

  const examTypeLabels: Record<string, string> = {
    vitamin_d_panel: "Vitamina D",
    zinc_copper_panel: "Zinco / Cobre",
    autoimmune_panel: "Autoimune (ANA)",
    magnesium_cortisol_panel: "Magnésio / Cortisol",
    iron_panel: "Ferro / Ferritina",
    thyroid_panel: "Tiroide (TSH)",
  };

  const visible = expanded ? exams : exams.slice(0, 2);

  return (
    <div className="holo-card fade-in" style={{ padding: "12px 16px" }}>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, cursor: "pointer", pointerEvents: "auto" }}
        onClick={() => setExpanded(!expanded)}
      >
        <span style={labelStyle}>Exames Agendados</span>
        <span style={{ fontSize: 10, color: "rgba(120, 200, 255, 0.6)" }}>
          {exams.length} {expanded ? "▲" : "▼"}
        </span>
      </div>

      {visible.map((exam, i) => (
        <div key={exam.id || i} style={{ marginBottom: i < visible.length - 1 ? 10 : 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.85)" }}>
              {examTypeLabels[exam.exam_type] || exam.exam_type}
            </span>
            <span style={{ fontSize: 10, color: "rgba(120, 200, 255, 0.6)" }}>
              {formatDate(exam.scheduled_date)}
            </span>
          </div>
          <p style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.4)", marginTop: 2, lineHeight: 1.4 }}>
            {exam.reason}
          </p>
        </div>
      ))}
    </div>
  );
}

function formatDate(date: string): string {
  try {
    const d = new Date(date);
    return d.toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
  } catch {
    return date;
  }
}

const labelStyle: React.CSSProperties = {
  fontSize: 9,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "rgba(255, 255, 255, 0.4)",
};
