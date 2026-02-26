import { useEffect, useRef, useState, useCallback } from "react";

export interface VoiceListenerState {
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  lastTranscript: string | null;
  error: string | null;
}

interface VoiceListenerOptions {
  onTranscript: (text: string) => void;
  silenceThresholdMs?: number;   // ms of silence before processing chunk
  minSpeechMs?: number;          // minimum speech duration to process
  amplitudeThreshold?: number;   // 0-1, voice detection sensitivity
  enabled?: boolean;
}

const DEFAULT_SILENCE_MS = 1500;
const DEFAULT_MIN_SPEECH_MS = 500;
const DEFAULT_AMPLITUDE = 0.015;

export function useVoiceListener(options: VoiceListenerOptions): VoiceListenerState & {
  start: () => void;
  stop: () => void;
  toggle: () => void;
} {
  const {
    onTranscript,
    silenceThresholdMs = DEFAULT_SILENCE_MS,
    minSpeechMs = DEFAULT_MIN_SPEECH_MS,
    amplitudeThreshold = DEFAULT_AMPLITUDE,
    enabled = true,
  } = options;

  const [state, setState] = useState<VoiceListenerState>({
    isListening: false,
    isProcessing: false,
    isSpeaking: false,
    lastTranscript: null,
    error: null,
  });

  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechStartRef = useRef<number>(0);
  const isSpeakingRef = useRef(false);
  const rafRef = useRef<number>(0);

  // Voice Activity Detection loop
  const checkVAD = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);

    // Calculate RMS amplitude
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const val = (data[i] - 128) / 128;
      sum += val * val;
    }
    const rms = Math.sqrt(sum / data.length);

    const now = Date.now();

    if (rms > amplitudeThreshold) {
      // Voice detected
      if (!isSpeakingRef.current) {
        isSpeakingRef.current = true;
        speechStartRef.current = now;
        setState(s => ({ ...s, isSpeaking: true }));

        // Start recording
        if (recorderRef.current?.state === "inactive") {
          chunksRef.current = [];
          recorderRef.current.start();
        }
      }

      // Reset silence timer
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    } else if (isSpeakingRef.current) {
      // Silence detected while was speaking
      if (!silenceTimerRef.current) {
        silenceTimerRef.current = setTimeout(() => {
          const speechDuration = now - speechStartRef.current;
          isSpeakingRef.current = false;
          setState(s => ({ ...s, isSpeaking: false }));

          // Stop recording if speech was long enough
          if (speechDuration >= minSpeechMs && recorderRef.current?.state === "recording") {
            recorderRef.current.stop();
          } else if (recorderRef.current?.state === "recording") {
            // Too short, discard
            recorderRef.current.stop();
            chunksRef.current = [];
          }
          silenceTimerRef.current = null;
        }, silenceThresholdMs);
      }
    }

    rafRef.current = requestAnimationFrame(checkVAD);
  }, [amplitudeThreshold, silenceThresholdMs, minSpeechMs]);

  const processAudioChunk = useCallback(async (blob: Blob) => {
    if (blob.size < 1000) return; // Too small, skip

    setState(s => ({ ...s, isProcessing: true }));

    try {
      // Convert blob to WAV and save as temp file via Tauri
      if (typeof window.__TAURI__ !== "undefined") {
        const { invoke } = await import("@tauri-apps/api/core");
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = Array.from(new Uint8Array(arrayBuffer));

        // Save temp audio file
        const tempPath = await invoke<string>("save_temp_audio", { audioData: bytes });

        // Transcribe via Whisper.cpp
        const transcript = await invoke<string>("process_voice_input", {
          audioPath: tempPath,
          language: "pt",
        });

        if (transcript && transcript.trim().length > 0) {
          const text = transcript.trim();
          setState(s => ({ ...s, lastTranscript: text, isProcessing: false }));
          onTranscript(text);
        } else {
          setState(s => ({ ...s, isProcessing: false }));
        }
      }
    } catch (err) {
      setState(s => ({
        ...s,
        isProcessing: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [onTranscript]);

  const start = useCallback(async () => {
    if (streamRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });

      streamRef.current = stream;

      // Setup audio analysis
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Setup recorder
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
          chunksRef.current = [];
          processAudioChunk(blob);
        }
      };

      recorderRef.current = recorder;
      setState(s => ({ ...s, isListening: true, error: null }));

      // Start VAD loop
      rafRef.current = requestAnimationFrame(checkVAD);
    } catch (err) {
      setState(s => ({
        ...s,
        error: err instanceof Error ? err.message : "Microfone não disponível",
      }));
    }
  }, [checkVAD, processAudioChunk]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    recorderRef.current = null;
    isSpeakingRef.current = false;
    setState({
      isListening: false,
      isProcessing: false,
      isSpeaking: false,
      lastTranscript: null,
      error: null,
    });
  }, []);

  const toggle = useCallback(() => {
    if (state.isListening) stop();
    else start();
  }, [state.isListening, start, stop]);

  // Auto-start if enabled
  useEffect(() => {
    if (enabled && !state.isListening) start();
    return () => { if (state.isListening) stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { ...state, start, stop, toggle };
}
