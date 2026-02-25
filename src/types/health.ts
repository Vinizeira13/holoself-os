// HoloSelf OS — Health Domain Types

export interface SupplementEntry {
  id?: number;
  name: string;
  dosage: string;
  taken_at: string; // ISO 8601
  category: "morning" | "night" | "as_needed";
  notes?: string;
}

export interface VitalEntry {
  id?: number;
  vital_type: "heart_rate" | "hrv" | "sleep_score" | "stress_level" | "wpm";
  value: number;
  unit: string;
  recorded_at: string; // ISO 8601
  source: "manual" | "wearable" | "webcam";
}

export interface ClinicalResult {
  marker: string;
  value: number;
  unit: string;
  reference_range: string;
  status: "normal" | "low" | "high" | "critical";
}

export interface OcrResult {
  patient_name?: string;
  date?: string;
  lab?: string;
  markers: ClinicalResult[];
  raw_text?: string;
}

export interface AgentMessage {
  text: string;
  category: "supplement_reminder" | "health_insight" | "calm_nudge" | "schedule";
  priority: "low" | "medium" | "high";
  action: AgentAction | null;
}

export interface AgentAction {
  action_type: "log_supplement" | "schedule_exam" | "open_timer";
  payload: Record<string, unknown>;
}

export interface HealthTimelineEntry {
  timestamp: string;
  event_type: string;
  label: string;
  value?: number;
}

export interface HealthScheduleEntry {
  id?: number;
  exam_type: string;
  reason: string;
  scheduled_date: string;
  triggered_by?: string;
  completed: boolean;
}

export interface SystemStatus {
  version: string;
  db_connected: boolean;
  gemini_configured: boolean;
  voice_available: boolean;
  timezone: string;
  uptime_seconds: number;
}
