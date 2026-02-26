import { useEffect, useRef, useState, useCallback } from "react";

export interface PresenceState {
  isPresent: boolean;
  awayDurationMs: number; // how long user has been away (0 if present)
  lastSeenAt: number;     // timestamp of last detection
  cameraAvailable: boolean;
}

interface PresenceOptions {
  onReturn?: (awayMs: number) => void;   // fired when user comes back
  onLeave?: () => void;                  // fired when user leaves
  checkIntervalMs?: number;              // how often to check (default 2000)
  absenceThresholdMs?: number;           // how long before "away" (default 10000)
  brightnessThreshold?: number;          // face zone brightness threshold 0-255 (default 35)
  enabled?: boolean;
}

const DEFAULT_CHECK_MS = 2000;
const DEFAULT_ABSENCE_MS = 10_000;
const DEFAULT_BRIGHTNESS = 35;

/**
 * usePresenceDetector — lightweight face presence via webcam brightness analysis.
 * No ML deps. Uses center-zone brightness variance to detect a face.
 * High variance in center zone = face present (skin tones, features, shadows).
 * Low variance = empty chair / wall.
 */
export function usePresenceDetector(options: PresenceOptions = {}): PresenceState & {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  start: () => void;
  stop: () => void;
} {
  const {
    onReturn,
    onLeave,
    checkIntervalMs = DEFAULT_CHECK_MS,
    absenceThresholdMs = DEFAULT_ABSENCE_MS,
    brightnessThreshold = DEFAULT_BRIGHTNESS,
    enabled = true,
  } = options;

  const [state, setState] = useState<PresenceState>({
    isPresent: true,
    awayDurationMs: 0,
    lastSeenAt: Date.now(),
    cameraAvailable: false,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasPresentRef = useRef(true);
  const lastSeenRef = useRef(Date.now());
  const awayStartRef = useRef(0);

  const analyzeFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;
    const w = 160; // Downscale for perf
    const h = 120;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, w, h);

    // Analyze center zone (face area) — middle 40% of frame
    const cx = Math.floor(w * 0.3);
    const cy = Math.floor(h * 0.2);
    const cw = Math.floor(w * 0.4);
    const ch = Math.floor(h * 0.6);
    const imageData = ctx.getImageData(cx, cy, cw, ch);
    const data = imageData.data;

    // Calculate brightness variance in center zone
    let sum = 0;
    let sumSq = 0;
    const pixelCount = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      sum += brightness;
      sumSq += brightness * brightness;
    }

    const mean = sum / pixelCount;
    const variance = (sumSq / pixelCount) - (mean * mean);
    const stdDev = Math.sqrt(Math.max(0, variance));

    // High stddev = face present (skin, shadows, features)
    // Low stddev = flat background (wall, empty chair)
    const faceDetected = stdDev > brightnessThreshold;

    const now = Date.now();

    if (faceDetected) {
      lastSeenRef.current = now;

      if (!wasPresentRef.current) {
        // User returned!
        const awayMs = awayStartRef.current > 0 ? now - awayStartRef.current : 0;
        wasPresentRef.current = true;
        awayStartRef.current = 0;
        setState(s => ({ ...s, isPresent: true, awayDurationMs: 0, lastSeenAt: now }));
        onReturn?.(awayMs);
      } else {
        setState(s => ({ ...s, lastSeenAt: now, awayDurationMs: 0 }));
      }
    } else {
      const timeSinceLastSeen = now - lastSeenRef.current;

      if (timeSinceLastSeen > absenceThresholdMs && wasPresentRef.current) {
        // User left
        wasPresentRef.current = false;
        awayStartRef.current = now;
        setState(s => ({ ...s, isPresent: false, awayDurationMs: timeSinceLastSeen }));
        onLeave?.();
      } else if (!wasPresentRef.current) {
        setState(s => ({ ...s, awayDurationMs: now - awayStartRef.current }));
      }
    }
  }, [absenceThresholdMs, brightnessThreshold, onReturn, onLeave]);

  const start = useCallback(async () => {
    if (streamRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user", frameRate: 10 },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      setState(s => ({ ...s, cameraAvailable: true }));

      // Start analysis loop
      intervalRef.current = setInterval(analyzeFrame, checkIntervalMs);
    } catch {
      setState(s => ({ ...s, cameraAvailable: false }));
    }
  }, [analyzeFrame, checkIntervalMs]);

  const stop = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (enabled) start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { ...state, videoRef, start, stop };
}
