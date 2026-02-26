import { useEffect, useRef, useState, useCallback } from "react";

export interface WpmSnapshot {
  wpm: number;
  trend: "rising" | "stable" | "declining";
  fatigue: "none" | "mild" | "moderate" | "high";
  sessionMinutes: number;
}

const WINDOW_MS = 60_000; // 1-minute rolling window
const CHARS_PER_WORD = 5;
const SAMPLE_INTERVAL = 5_000; // recalc every 5s

// Fatigue thresholds (relative to personal baseline)
const MILD_DROP = 0.15;    // 15% below baseline
const MODERATE_DROP = 0.30; // 30% below baseline
const HIGH_DROP = 0.50;     // 50% below baseline

export function useKeystrokeWpm(): WpmSnapshot {
  const [snapshot, setSnapshot] = useState<WpmSnapshot>({
    wpm: 0,
    trend: "stable",
    fatigue: "none",
    sessionMinutes: 0,
  });

  const keystrokesRef = useRef<number[]>([]); // timestamps
  const baselineRef = useRef<number>(0);       // peak WPM (first 5 min)
  const historyRef = useRef<number[]>([]);     // WPM samples for trend
  const sessionStartRef = useRef<number>(Date.now());
  const calibratingRef = useRef(true);

  const handleKeydown = useCallback((e: KeyboardEvent) => {
    // Only count actual character keys (ignore modifiers, nav, function keys)
    if (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter") {
      keystrokesRef.current.push(Date.now());
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeydown);

    const interval = setInterval(() => {
      const now = Date.now();
      const windowStart = now - WINDOW_MS;

      // Prune old keystrokes
      keystrokesRef.current = keystrokesRef.current.filter(t => t > windowStart);

      const charCount = keystrokesRef.current.length;
      const currentWpm = Math.round((charCount / CHARS_PER_WORD) * (60_000 / WINDOW_MS));

      // Session time
      const sessionMinutes = Math.round((now - sessionStartRef.current) / 60_000);

      // Calibration: first 5 minutes, track peak WPM
      if (calibratingRef.current) {
        if (currentWpm > baselineRef.current) {
          baselineRef.current = currentWpm;
        }
        if (sessionMinutes >= 5 && baselineRef.current > 0) {
          calibratingRef.current = false;
        }
      }

      // Track history for trend (keep last 12 samples = 1 min)
      historyRef.current.push(currentWpm);
      if (historyRef.current.length > 12) {
        historyRef.current = historyRef.current.slice(-12);
      }

      // Calculate trend
      const hist = historyRef.current;
      let trend: WpmSnapshot["trend"] = "stable";
      if (hist.length >= 4) {
        const firstHalf = hist.slice(0, Math.floor(hist.length / 2));
        const secondHalf = hist.slice(Math.floor(hist.length / 2));
        const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        if (avgSecond > avgFirst * 1.1) trend = "rising";
        else if (avgSecond < avgFirst * 0.9) trend = "declining";
      }

      // Fatigue detection (only after calibration)
      let fatigue: WpmSnapshot["fatigue"] = "none";
      if (!calibratingRef.current && baselineRef.current > 0 && currentWpm > 0) {
        const drop = 1 - (currentWpm / baselineRef.current);
        if (drop >= HIGH_DROP) fatigue = "high";
        else if (drop >= MODERATE_DROP) fatigue = "moderate";
        else if (drop >= MILD_DROP) fatigue = "mild";
      }

      setSnapshot({ wpm: currentWpm, trend, fatigue, sessionMinutes });
    }, SAMPLE_INTERVAL);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
      clearInterval(interval);
    };
  }, [handleKeydown]);

  return snapshot;
}
