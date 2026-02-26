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

    // Rule 1: WPM declining + long focus → break
    if (m.wpmTrend === "declining" && m.focusDurationMin > 90) {
      fireAlert("break", "O teu WPM está a cair e estás focado há +90min. Faz uma pausa de 5min.", 1);
      return;
    }

    // Rule 2: Bad posture > ongoing
    if (m.postureScore < 50) {
      fireAlert("posture", "Postura baixa detectada. Endireita as costas e faz o 20-20-20.", 1);
      return;
    }

    // Rule 3: Deep focus + no breaks
    if (m.focusDurationMin > 120 && m.breaksTaken === 0) {
      fireAlert("hydrate", "Deep focus há 2h+ sem pausa. Hidrata e movimenta.", 2);
      return;
    }

    // Rule 4: 60min+ focus → eye care
    if (m.focusDurationMin > 60 && m.focusDurationMin % 60 < 6) {
      fireAlert("eyecare", "1h+ de foco. 20-20-20: olha para algo a 6m por 20s.", 3);
      return;
    }

    // Rule 5: Moderate focus reminder
    if (m.focusDurationMin > 45 && m.postureScore < 70) {
      fireAlert("posture", "Postura a deteriorar. Ajusta e continua forte.", 2);
      return;
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
