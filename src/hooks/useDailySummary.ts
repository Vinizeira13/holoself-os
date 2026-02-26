import { useEffect, useRef, useCallback } from "react";

interface DailySummaryOptions {
  onSummaryReady: (summary: string) => void;
  targetHour?: number; // hour of day to trigger (default 22)
  enabled?: boolean;
}

interface DayStats {
  adherencePercent: number;
  breaksTaken: number;
  avgPostureScore: number;
  focusMinutes: number;
  voiceCommands: number;
}

/**
 * useDailySummary — triggers a daily TTS summary at targetHour (default 22h).
 * Queries Tauri backend for day stats, generates natural-language summary.
 */
export function useDailySummary(options: DailySummaryOptions) {
  const {
    onSummaryReady,
    targetHour = 22,
    enabled = true,
  } = options;

  const firedTodayRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async (): Promise<DayStats | null> => {
    if (typeof window.__TAURI__ === "undefined") {
      // Fallback for browser dev
      return {
        adherencePercent: 80,
        breaksTaken: 3,
        avgPostureScore: 72,
        focusMinutes: 360,
        voiceCommands: 8,
      };
    }

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const stats = await invoke<DayStats>("get_daily_stats");
      return stats;
    } catch {
      return null;
    }
  }, []);

  const generateSummary = useCallback((stats: DayStats): string => {
    const parts: string[] = [];

    parts.push(`Relatório do dia.`);

    // Adherence
    if (stats.adherencePercent >= 90) {
      parts.push(`Aderência excelente: ${stats.adherencePercent}%.`);
    } else if (stats.adherencePercent >= 70) {
      parts.push(`Aderência boa: ${stats.adherencePercent}%.`);
    } else {
      parts.push(`Aderência precisa melhorar: ${stats.adherencePercent}%.`);
    }

    // Breaks
    parts.push(`Fizeste ${stats.breaksTaken} pausa${stats.breaksTaken !== 1 ? "s" : ""} hoje.`);

    // Posture
    if (stats.avgPostureScore >= 80) {
      parts.push(`Postura média ótima: ${stats.avgPostureScore} de 100.`);
    } else if (stats.avgPostureScore >= 60) {
      parts.push(`Postura média razoável: ${stats.avgPostureScore} de 100. Tenta manter as costas retas amanhã.`);
    } else {
      parts.push(`Postura média baixa: ${stats.avgPostureScore} de 100. Atenção especial amanhã.`);
    }

    // Focus
    const hours = Math.floor(stats.focusMinutes / 60);
    const mins = stats.focusMinutes % 60;
    parts.push(`Tempo de foco total: ${hours}h${mins > 0 ? ` ${mins}min` : ""}.`);

    // Voice
    if (stats.voiceCommands > 0) {
      parts.push(`Usaste ${stats.voiceCommands} comando${stats.voiceCommands !== 1 ? "s" : ""} de voz.`);
    }

    parts.push(`Bom descanso. Amanhã continuamos.`);

    return parts.join(" ");
  }, []);

  const lastFiredDateRef = useRef<string>("");

  const checkTime = useCallback(async () => {
    if (!enabled || firedTodayRef.current) return;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10); // "YYYY-MM-DD"

    if (now.getHours() === targetHour && now.getMinutes() < 5) {
      // Prevent multiple fires on same day
      if (lastFiredDateRef.current === todayStr) return;
      firedTodayRef.current = true;
      lastFiredDateRef.current = todayStr;

      const stats = await fetchStats();
      if (stats) {
        const summary = generateSummary(stats);
        onSummaryReady(summary);
      }
    }

    // Reset at midnight
    if (now.getHours() === 0 && now.getMinutes() < 2) {
      firedTodayRef.current = false;
    }
  }, [enabled, targetHour, fetchStats, generateSummary, onSummaryReady]);

  useEffect(() => {
    if (!enabled) return;

    // Check every minute
    intervalRef.current = setInterval(checkTime, 60_000);
    // Also check immediately
    checkTime();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, checkTime]);
}
