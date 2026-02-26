import { useState, useEffect, useCallback } from "react";

interface SetupStatus {
  gemini_key: boolean;
  cartesia_key: boolean;
  whisper_binary: boolean;
  whisper_model: boolean;
  camera_permission: boolean;
  mic_permission: boolean;
}

type Step = "welcome" | "apis" | "whisper" | "permissions" | "done";

const STEPS: Step[] = ["welcome", "apis", "whisper", "permissions", "done"];

interface Props {
  onComplete: () => void;
}

export function SetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("welcome");
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [geminiKey, setGeminiKey] = useState("");
  const [cartesiaKey, setCartesiaKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [whisperInstalling, setWhisperInstalling] = useState(false);
  const [whisperProgress, setWhisperProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isTauri = typeof window.__TAURI__ !== "undefined";

  // Check current setup status
  const checkStatus = useCallback(async () => {
    if (!isTauri) {
      setStatus({
        gemini_key: false,
        cartesia_key: false,
        whisper_binary: false,
        whisper_model: false,
        camera_permission: false,
        mic_permission: false,
      });
      return;
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const s = await invoke<SetupStatus>("check_setup_status");
      setStatus(s);
    } catch {
      setStatus({
        gemini_key: false,
        cartesia_key: false,
        whisper_binary: false,
        whisper_model: false,
        camera_permission: false,
        mic_permission: false,
      });
    }
  }, [isTauri]);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  const saveApiKeys = useCallback(async () => {
    if (!isTauri) return;
    setSaving(true);
    setError(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("save_api_keys", {
        geminiKey: geminiKey.trim() || null,
        cartesiaKey: cartesiaKey.trim() || null,
      });
      await checkStatus();
      setStep("whisper");
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }, [isTauri, geminiKey, cartesiaKey, checkStatus]);

  const installWhisper = useCallback(async () => {
    if (!isTauri) return;
    setWhisperInstalling(true);
    setWhisperProgress("Baixando whisper.cpp...");
    setError(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      setWhisperProgress("Clonando repositório...");
      await invoke("install_whisper_auto");
      setWhisperProgress("Instalado com sucesso!");
      await checkStatus();
      setTimeout(() => setStep("permissions"), 1000);
    } catch (err) {
      setError(`Falha na instalação: ${String(err)}`);
      setWhisperProgress("Tenta instalar manualmente (ver instruções abaixo)");
    } finally {
      setWhisperInstalling(false);
    }
  }, [isTauri, checkStatus]);

  const requestPermissions = useCallback(async () => {
    try {
      // Request camera
      await navigator.mediaDevices.getUserMedia({ video: true });
    } catch { /* user denied or not available */ }

    try {
      // Request mic
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch { /* user denied or not available */ }

    await checkStatus();
    setStep("done");
  }, [checkStatus]);

  const currentIdx = STEPS.indexOf(step);
  const totalSteps = STEPS.length;

  // Check if all essential items are configured
  const allEssentialDone = status
    ? status.gemini_key && status.cartesia_key
    : false;

  const cardStyle: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 9999,
    background: "radial-gradient(ellipse at center, #0a0e14 0%, #000508 100%)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "var(--font-mono, monospace)",
    color: "var(--holo-text, #c8d6e5)",
  };

  const panelStyle: React.CSSProperties = {
    maxWidth: 520, width: "90%", padding: "32px 28px",
    background: "rgba(0, 255, 136, 0.02)",
    border: "1px solid rgba(0, 255, 136, 0.15)",
    borderRadius: 12,
    boxShadow: "0 0 40px rgba(0, 255, 136, 0.05), inset 0 1px 0 rgba(255,255,255,0.03)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", marginTop: 6,
    background: "rgba(0,0,0,0.4)", border: "1px solid rgba(0,255,136,0.2)",
    borderRadius: 6, color: "#c8d6e5", fontFamily: "inherit", fontSize: 12,
    outline: "none",
  };

  const btnPrimary: React.CSSProperties = {
    padding: "10px 24px", marginTop: 16,
    background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.4)",
    borderRadius: 6, color: "#00ff88", cursor: "pointer",
    fontFamily: "inherit", fontSize: 12, fontWeight: 600, letterSpacing: 1,
  };

  const btnSecondary: React.CSSProperties = {
    ...btnPrimary,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#c8d6e5",
  };

  const statusDot = (ok: boolean) => (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: ok ? "#00ff88" : "#ff4757",
      boxShadow: ok ? "0 0 6px #00ff88" : "0 0 6px #ff4757",
      marginRight: 8,
    }} />
  );

  const labelStyle: React.CSSProperties = {
    fontSize: 10, color: "rgba(200,214,229,0.5)",
    textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4,
  };

  const progressBar = (
    <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
      {STEPS.map((s, i) => (
        <div key={s} style={{
          flex: 1, height: 3, borderRadius: 2,
          background: i <= currentIdx ? "#00ff88" : "rgba(255,255,255,0.08)",
          transition: "background 0.3s",
        }} />
      ))}
    </div>
  );

  return (
    <div style={cardStyle}>
      <div style={panelStyle}>
        {progressBar}

        {/* STEP: WELCOME */}
        {step === "welcome" && (
          <div>
            <div style={{ fontSize: 11, color: "#00ff88", letterSpacing: 2, marginBottom: 8 }}>
              HOLOSELF OS
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 12px", color: "#e8f0fe" }}>
              Setup Inicial
            </h2>
            <p style={{ fontSize: 12, lineHeight: 1.7, color: "rgba(200,214,229,0.7)", margin: "0 0 8px" }}>
              Vamos configurar tudo para o teu Jarvis funcionar 100%. São {totalSteps - 2} passos rápidos:
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "16px 0", fontSize: 12, lineHeight: 2 }}>
              <li>{statusDot(status?.gemini_key ?? false)} API Keys (Gemini + Cartesia)</li>
              <li>{statusDot(status?.whisper_binary ?? false)} Whisper.cpp (STT local)</li>
              <li>{statusDot(status?.camera_permission ?? false)} Permissões (câmera + mic)</li>
            </ul>
            <button style={btnPrimary} onClick={() => setStep("apis")}>
              COMEÇAR SETUP
            </button>
          </div>
        )}

        {/* STEP: API KEYS */}
        {step === "apis" && (
          <div>
            <div style={labelStyle}>PASSO 1 / 3</div>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 16px", color: "#e8f0fe" }}>
              API Keys
            </h2>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", fontSize: 12, marginBottom: 2 }}>
                {statusDot(status?.gemini_key ?? false)}
                <span style={{ fontWeight: 600 }}>Gemini API Key</span>
                <span style={{ fontSize: 10, marginLeft: 8, color: "#ff4757" }}>obrigatório</span>
              </div>
              <p style={{ fontSize: 10, color: "rgba(200,214,229,0.5)", margin: "2px 0 4px" }}>
                Usado pelo agente para raciocínio e OCR clínico.
                Obtém em <span style={{ color: "#00ff88" }}>aistudio.google.com/apikey</span>
              </p>
              <input
                type="password"
                style={inputStyle}
                placeholder="AIza..."
                value={geminiKey}
                onChange={e => setGeminiKey(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", fontSize: 12, marginBottom: 2 }}>
                {statusDot(status?.cartesia_key ?? false)}
                <span style={{ fontWeight: 600 }}>Cartesia API Key</span>
                <span style={{ fontSize: 10, marginLeft: 8, color: "#ffa502" }}>recomendado</span>
              </div>
              <p style={{ fontSize: 10, color: "rgba(200,214,229,0.5)", margin: "2px 0 4px" }}>
                Usado para TTS (voz do Jarvis). Sub-100ms latência.
                Obtém em <span style={{ color: "#00ff88" }}>play.cartesia.ai</span>
              </p>
              <input
                type="password"
                style={inputStyle}
                placeholder="sk-..."
                value={cartesiaKey}
                onChange={e => setCartesiaKey(e.target.value)}
              />
            </div>

            {error && (
              <div style={{ fontSize: 11, color: "#ff4757", marginTop: 8 }}>{error}</div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button style={btnSecondary} onClick={() => setStep("welcome")}>VOLTAR</button>
              <button
                style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }}
                onClick={saveApiKeys}
                disabled={saving}
              >
                {saving ? "SALVANDO..." : "SALVAR E CONTINUAR"}
              </button>
            </div>

            {!geminiKey && (
              <button
                style={{ ...btnSecondary, marginTop: 8, fontSize: 10 }}
                onClick={() => setStep("whisper")}
              >
                PULAR POR AGORA
              </button>
            )}
          </div>
        )}

        {/* STEP: WHISPER */}
        {step === "whisper" && (
          <div>
            <div style={labelStyle}>PASSO 2 / 3</div>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 16px", color: "#e8f0fe" }}>
              Whisper.cpp (STT Local)
            </h2>
            <p style={{ fontSize: 12, lineHeight: 1.7, color: "rgba(200,214,229,0.7)", margin: "0 0 12px" }}>
              O Whisper converte a tua voz em texto localmente (sem cloud). Precisa do binário + modelo.
            </p>

            <div style={{ fontSize: 12, marginBottom: 12 }}>
              {statusDot(status?.whisper_binary ?? false)} Binário whisper-cli
              <br />
              {statusDot(status?.whisper_model ?? false)} Modelo GGML
            </div>

            {!(status?.whisper_binary && status?.whisper_model) && (
              <>
                <button
                  style={{ ...btnPrimary, opacity: whisperInstalling ? 0.5 : 1 }}
                  onClick={installWhisper}
                  disabled={whisperInstalling}
                >
                  {whisperInstalling ? "INSTALANDO..." : "INSTALAR AUTOMATICAMENTE"}
                </button>

                {whisperProgress && (
                  <div style={{ fontSize: 11, color: "#00ff88", marginTop: 8 }}>
                    {whisperProgress}
                  </div>
                )}

                <div style={{
                  marginTop: 16, padding: 12,
                  background: "rgba(255,255,255,0.02)", borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <div style={{ fontSize: 10, color: "rgba(200,214,229,0.5)", marginBottom: 6 }}>
                    OU INSTALAR MANUALMENTE:
                  </div>
                  <pre style={{
                    fontSize: 10, color: "#00ff88", lineHeight: 1.8, margin: 0,
                    whiteSpace: "pre-wrap", wordBreak: "break-all",
                  }}>
{`# Clonar e compilar
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp && make

# Baixar modelo (base = 142MB)
bash ./models/download-ggml-model.sh base

# Testar
./main -m models/ggml-base.bin -f samples/jfk.wav`}
                  </pre>
                </div>
              </>
            )}

            {status?.whisper_binary && status?.whisper_model && (
              <div style={{ fontSize: 12, color: "#00ff88", marginTop: 8 }}>
                Whisper.cpp instalado e pronto!
              </div>
            )}

            {error && (
              <div style={{ fontSize: 11, color: "#ff4757", marginTop: 8 }}>{error}</div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button style={btnSecondary} onClick={() => setStep("apis")}>VOLTAR</button>
              <button style={btnPrimary} onClick={() => setStep("permissions")}>
                {status?.whisper_binary ? "CONTINUAR" : "PULAR POR AGORA"}
              </button>
            </div>
          </div>
        )}

        {/* STEP: PERMISSIONS */}
        {step === "permissions" && (
          <div>
            <div style={labelStyle}>PASSO 3 / 3</div>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 16px", color: "#e8f0fe" }}>
              Permissões do Sistema
            </h2>
            <p style={{ fontSize: 12, lineHeight: 1.7, color: "rgba(200,214,229,0.7)", margin: "0 0 12px" }}>
              O HoloSelf precisa de acesso à câmera (presença + postura) e microfone (voz).
              Clica abaixo para autorizar.
            </p>

            <div style={{ fontSize: 12, marginBottom: 12 }}>
              {statusDot(status?.camera_permission ?? false)} Câmera (presença + postura)
              <br />
              {statusDot(status?.mic_permission ?? false)} Microfone (comandos de voz)
            </div>

            <button style={btnPrimary} onClick={requestPermissions}>
              AUTORIZAR CÂMERA + MIC
            </button>
            <p style={{ fontSize: 10, color: "rgba(200,214,229,0.4)", marginTop: 8 }}>
              O macOS vai mostrar um popup de permissão. Clica "Permitir".
            </p>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button style={btnSecondary} onClick={() => setStep("whisper")}>VOLTAR</button>
              <button style={btnPrimary} onClick={() => setStep("done")}>
                CONTINUAR
              </button>
            </div>
          </div>
        )}

        {/* STEP: DONE */}
        {step === "done" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>
              {allEssentialDone ? "✓" : "⚡"}
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 12px", color: "#e8f0fe" }}>
              {allEssentialDone ? "Setup Completo" : "Setup Parcial"}
            </h2>

            {/* Status summary */}
            <div style={{ textAlign: "left", margin: "16px auto", maxWidth: 300, fontSize: 12, lineHeight: 2 }}>
              {statusDot(status?.gemini_key ?? false)} Gemini API
              <br />
              {statusDot(status?.cartesia_key ?? false)} Cartesia TTS
              <br />
              {statusDot(status?.whisper_binary ?? false)} Whisper.cpp
              <br />
              {statusDot(status?.camera_permission ?? false)} Câmera
              <br />
              {statusDot(status?.mic_permission ?? false)} Microfone
            </div>

            {!allEssentialDone && (
              <p style={{ fontSize: 11, color: "#ffa502", margin: "8px 0" }}>
                Alguns itens ficaram pendentes. Podes configurar depois em Configurações.
              </p>
            )}

            <button style={btnPrimary} onClick={onComplete}>
              ENTRAR NO HOLOSELF OS
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
