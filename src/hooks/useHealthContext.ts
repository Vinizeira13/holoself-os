import { useEffect, useRef, useState, useCallback } from "react";

export interface HealthMetrics {
  wpm: number;
  wpmTrend: "rising" | "stable" | "declining";
  postureScore: number;
  isPresent: boolean;
  focusDurationMin: number;  // minutes since last break
  breaksTaken: number;
  lastBreakAt: number;
}

export interface ProactiveAlert {
  id: string;
  type: "break" | "posture" | "hydrate" | "supplement" | "eyecare" | "welcome_back";
  message: string;
  priority: number; // 1 = high, 3 = low
  timestamp: number;
}

interface ProactiveOptions {
  onAlert: (alert: ProactiveAlert) => void;
  checkIntervalMs?: number; // default 5min
  minAlertGapMs?: number;   // min gap between alerts (default 10min)
}

const DEFAULT_CHECK_MS = 5 * 60_000;  // 5 min
const DEFAULT_GAP_MS = 10 * 60_000;   // 10 min

/**
 * useHealthContext — aggregates all health metrics and runs proactive rules engine.
 * Fires alerts when conditions are met (max 1 per 10min to avoid spam).
 */
export function useHealthContext(
  metrics: HealthMetrics,
  options: ProactiveOptions
) {
  const {
    onAlert,
    checkIntervalMs = DEFAULT_CHECK_MS,
    minAlertGapMs = DEFAULT_GAP_MS,
  } = options;

  const [alerts, setAlerts] = useState<ProactiveAlert[]>([]);
  const lastAlertRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  const generateId = () => `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const fireAlert = useCallback((type: ProactiveAlert["type"], message: string, priority: number) => {
    const now = Date.now();
    if (now - lastAlertRef.current < minAlertGapMs) return; // Rate limit

    const alert: ProactiveAlert = {
      id: generateId(),
      type,
      message,
      priority,
      timestamp: now,
    };

    lastAlertRef.current = now;
    setAlerts(prev => [alert, ...prev].slice(0, 20)); // Keep last 20
    onAlert(alert);
  }, [onAlert, minAlertGapMs]);

  const evaluate = useCallback(() => {
    const m = metricsRef.current;
    if (!m.isPresent) return; // Don't alert if user is away

    // Collect all matching alerts, fire the highest priority one
    type AlertType = ProactiveAlert["type"];
    const candidates: { type: AlertType; msg: string; priority: number }[] = [];

    // Rule 1: WPM declining + long focus → break (priority 1 = highest)
    if (m.wpmTrend === "declining" && m.focusDurationMin > 90) {
      candidates.push({ type: "break", msg: "O teu WPM está a cair e estás focado há +90min. Faz uma pausa de 5min.", priority: 1 });
    }

    // Rule 2: Bad posture > ongoing
    if (m.postureScore < 50) {
      candidates.push({ type: "posture", msg: "Postura baixa detectada. Endireita as costas e faz o 20-20-20.", priority: 1 });
    }

    // Rule 3: Deep focus + no breaks
    if (m.focusDurationMin > 120 && m.breaksTaken === 0) {
      candidates.push({ type: "hydrate", msg: "Deep focus há 2h+ sem pausa. Hidrata e movimenta.", priority: 2 });
    }

    // Rule 4: 60min+ focus → eye care
    if (m.focusDurationMin > 60 && m.focusDurationMin % 60 < 6) {
      candidates.push({ type: "eyecare", msg: "1h+ de foco. 20-20-20: olha para algo a 6m por 20s.", priority: 3 });
    }

    // Rule 5: Moderate focus reminder
    if (m.focusDurationMin > 45 && m.postureScore < 70) {
      candidates.push({ type: "posture", msg: "Postura a deteriorar. Ajusta e continua forte.", priority: 2 });
    }

    // Fire highest priority alert (lowest number = highest priority)
    if (candidates.length > 0) {
      const best = candidates.sort((a, b) => a.priority - b.priority)[0];
      fireAlert(best.type, best.msg, best.priority);
    }
  }, [fireAlert]);

  useEffect(() => {
    intervalRef.current = setInterval(evaluate, checkIntervalMs);
    // Also run once immediately after mount
    const timer = setTimeout(evaluate, 10_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearTimeout(timer);
    };
  }, [evaluate, checkIntervalMs]);

  return { alerts };
}
