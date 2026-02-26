import { useEffect, useRef, useState, useCallback } from "react";

export interface PostureState {
  score: number;           // 0-100 posture score
  isBadPosture: boolean;   // currently bad
  badDurationMs: number;   // how long bad posture continuous
  headPosition: { x: number; y: number } | null; // normalized 0-1
}

interface PostureOptions {
  onBadPosture?: (durationMs: number) => void; // fires when bad > threshold
  badPostureThresholdMs?: number;              // default 5min
  checkIntervalMs?: number;                    // default 3000
  // Head position thresholds (normalized 0-1, center = 0.5)
  yMinThreshold?: number;  // head too low (default 0.65)
  yMaxThreshold?: number;  // head too high / too close (default 0.2)
}

const DEFAULT_BAD_MS = 5 * 60_000; // 5 minutes
const DEFAULT_CHECK_MS = 3000;

/**
 * usePostureMonitor — lightweight head position tracking via webcam.
 * Uses brightness centroid in face zone to estimate head position.
 * No ML — uses the same camera stream as presence detector.
 * Requires a <video> element ref (can share with usePresenceDetector).
 */
export function usePostureMonitor(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options: PostureOptions = {}
): PostureState {
  const {
    onBadPosture,
    badPostureThresholdMs = DEFAULT_BAD_MS,
    checkIntervalMs = DEFAULT_CHECK_MS,
    yMinThreshold = 0.65,
    yMaxThreshold = 0.2,
  } = options;

  const [state, setState] = useState<PostureState>({
    score: 100,
    isBadPosture: false,
    badDurationMs: 0,
    headPosition: null,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const badStartRef = useRef(0);
  const scoresRef = useRef<number[]>([]); // rolling window for smoothing
  const alertedRef = useRef(false);

  const analyzePosture = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    const canvas = canvasRef.current;
    const w = 160;
    const h = 120;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, w, h);

    // Find brightness centroid (weighted center of bright pixels)
    // This approximates head/face position
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    let sumX = 0, sumY = 0, totalWeight = 0;
    const threshold = 50; // min brightness to consider

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const brightness = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);

        if (brightness > threshold) {
          // Weight center pixels more (face is usually centered horizontally)
          const xDist = Math.abs(x / w - 0.5);
          const weight = brightness * (1 - xDist * 0.5);
          sumX += x * weight;
          sumY += y * weight;
          totalWeight += weight;
        }
      }
    }

    if (totalWeight < 100) {
      // Not enough data (no face / dark frame)
      return;
    }

    const headX = (sumX / totalWeight) / w; // 0-1
    const headY = (sumY / totalWeight) / h; // 0-1

    // Score calculation
    // Good posture: head centered vertically (0.3-0.5 range)
    // Bad posture: head too low (slouching) or too high (leaning forward)
    let posScore = 100;

    if (headY > yMinThreshold) {
      // Head too low — slouching
      posScore -= Math.min(60, (headY - yMinThreshold) * 300);
    } else if (headY < yMaxThreshold) {
      // Head too high/close — leaning into screen
      posScore -= Math.min(40, (yMaxThreshold - headY) * 200);
    }

    // Horizontal deviation penalty (leaning to one side)
    const xDeviation = Math.abs(headX - 0.5);
    if (xDeviation > 0.15) {
      posScore -= Math.min(20, (xDeviation - 0.15) * 100);
    }

    posScore = Math.max(0, Math.min(100, Math.round(posScore)));

    // Smooth with rolling average (last 10 readings)
    scoresRef.current.push(posScore);
    if (scoresRef.current.length > 10) scoresRef.current.shift();
    const avgScore = Math.round(
      scoresRef.current.reduce((a, b) => a + b, 0) / scoresRef.current.length
    );

    const isBad = avgScore < 60;
    const now = Date.now();

    if (isBad) {
      if (badStartRef.current === 0) badStartRef.current = now;
      const duration = now - badStartRef.current;

      if (duration > badPostureThresholdMs && !alertedRef.current) {
        alertedRef.current = true;
        onBadPosture?.(duration);
      }

      setState({
        score: avgScore,
        isBadPosture: true,
        badDurationMs: duration,
        headPosition: { x: headX, y: headY },
      });
    } else {
      badStartRef.current = 0;
      alertedRef.current = false;
      setState({
        score: avgScore,
        isBadPosture: false,
        badDurationMs: 0,
        headPosition: { x: headX, y: headY },
      });
    }
  }, [videoRef, yMinThreshold, yMaxThreshold, badPostureThresholdMs, onBadPosture]);

  useEffect(() => {
    intervalRef.current = setInterval(analyzePosture, checkIntervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [analyzePosture, checkIntervalMs]);

  return state;
}
