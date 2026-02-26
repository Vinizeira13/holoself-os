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
  const [showCartesia, setShowCartesia] = useState(false);

  const isTauri = typeof window.__TAURI__ !== "undefined";

  const checkStatus = useCallback(async () => {
    if (!isTauri) {
      setStatus({
        gemini_key: false, cartesia_key: false,
        whisper_binary: false, whisper_model: false,
        camera_permission: false, mic_permission: false,
      });
      return;
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const s = await invoke<SetupStatus>("check_setup_status");
      setStatus(s);
    } catch {
      setStatus({
        gemini_key: false, cartesia_key: false,
        whisper_binary: false, whisper_model: false,
        camera_permission: false, mic_permission: false,
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
    setWhisperProgress("A clonar whisper.cpp...");
    setError(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      setWhisperProgress("A compilar e descarregar modelo (~1.6GB)... pode demorar 2-5min");
      await invoke("install_whisper_auto");
      setWhisperProgress("Instalado com sucesso!");
      await checkStatus();
      setTimeout(() => setStep("permissions"), 1000);
    } catch (err) {
      setError(`Falha na instalação: ${String(err)}`);
      setWhisperProgress("");
    } finally {
      setWhisperInstalling(false);
    }
  }, [isTauri, checkStatus]);

  const requestPermissions = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch { /* user denied */ }
    await checkStatus();
    setStep("done");
  }, [checkStatus]);

  const currentIdx = STEPS.indexOf(step);

  // Only Gemini is truly essential — Cartesia has native fallback
  const essentialDone = status ? status.gemini_key : false;

  // Styles
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
    outline: "none", boxSizing: "border-box",
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

  const dot = (ok: boolean) => (
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

  const linkStyle: React.CSSProperties = {
    color: "#00ff88", textDecoration: "underline", cursor: "pointer",
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
              Configuração Inicial
            </h2>
            <p style={{ fontSize: 12, lineHeight: 1.7, color: "rgba(200,214,229,0.7)", margin: "0 0 8px" }}>
              3 passos rápidos para ativar o teu agente de saúde pessoal:
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "16px 0", fontSize: 12, lineHeight: 2.2 }}>
              <li>
                {dot(status?.gemini_key ?? false)}
                <strong>Gemini API Key</strong>
                <span style={{ fontSize: 10, color: "rgba(200,214,229,0.4)", marginLeft: 6 }}>— cérebro do agente (gratuito)</span>
              </li>
              <li>
                {dot((status?.whisper_binary && status?.whisper_model) ?? false)}
                <strong>Whisper.cpp</strong>
                <span style={{ fontSize: 10, color: "rgba(200,214,229,0.4)", marginLeft: 6 }}>— voz → texto (local, privado)</span>
              </li>
              <li>
                {dot(status?.camera_permission ?? false)}
                <strong>Câmera + Microfone</strong>
                <span style={{ fontSize: 10, color: "rgba(200,214,229,0.4)", marginLeft: 6 }}>— presença e postura</span>
              </li>
            </ul>
            <p style={{ fontSize: 10, color: "rgba(200,214,229,0.35)", margin: "0 0 16px" }}>
              A voz do agente funciona nativamente via macOS. Sem API de TTS necessária.
            </p>
            <button style={btnPrimary} onClick={() => setStep("apis")}>
              COMEÇAR
            </button>
          </div>
        )}

        {/* STEP: API KEYS */}
        {step === "apis" && (
          <div>
            <div style={labelStyle}>PASSO 1 / 3</div>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 16px", color: "#e8f0fe" }}>
              Gemini API Key
            </h2>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", fontSize: 12, marginBottom: 2 }}>
                {dot(status?.gemini_key ?? false)}
                <span style={{ fontWeight: 600 }}>Gemini API Key</span>
                <span style={{ fontSize: 10, marginLeft: 8, color: "#ff4757" }}>obrigatório</span>
              </div>
              <p style={{ fontSize: 11, color: "rgba(200,214,229,0.6)", margin: "4px 0 8px", lineHeight: 1.6 }}>
                O cérebro do HoloSelf. Usa o Gemini 2.0 Flash (grátis, 15 req/min).
              </p>
              <p style={{ fontSize: 10, color: "rgba(200,214,229,0.45)", margin: "0 0 8px", lineHeight: 1.5 }}>
                1. Vai a{" "}
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={linkStyle}>
                  aistudio.google.com/apikey
                </a>
                <br />
                2. Clica "Create API Key" → copia a key
                <br />
                3. Cola abaixo
              </p>
              <input
                type="password"
                style={inputStyle}
                placeholder="AIza..."
                value={geminiKey}
                onChange={e => setGeminiKey(e.target.value)}
              />
            </div>

            {/* Cartesia — collapsed optional section */}
            <div style={{
              marginBottom: 16, padding: 12,
              background: "rgba(255,255,255,0.02)", borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div
                style={{ fontSize: 11, color: "rgba(200,214,229,0.5)", cursor: "pointer", userSelect: "none" }}
                onClick={() => setShowCartesia(!showCartesia)}
              >
                {showCartesia ? "▾" : "▸"} Cartesia TTS{" "}
                <span style={{ fontSize: 9, color: "rgba(200,214,229,0.3)" }}>
                  (opcional — voz premium, sub-100ms)
                </span>
              </div>
              {showCartesia && (
                <div style={{ marginTop: 8 }}>
                  <p style={{ fontSize: 10, color: "rgba(200,214,229,0.45)", margin: "0 0 6px" }}>
                    Sem Cartesia, o agente usa a voz nativa do macOS (Luciana PT-BR).
                    Com Cartesia, a voz é mais natural e mais rápida.
                  </p>
                  <input
                    type="password"
                    style={inputStyle}
                    placeholder="sk-..."
                    value={cartesiaKey}
                    onChange={e => setCartesiaKey(e.target.value)}
                  />
                </div>
              )}
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

            {!geminiKey && !status?.gemini_key && (
              <button
                style={{ ...btnSecondary, marginTop: 8, fontSize: 10, opacity: 0.6 }}
                onClick={() => setStep("whisper")}
              >
                PULAR (o agente funcionará com respostas pré-definidas)
              </button>
            )}
          </div>
        )}

        {/* STEP: WHISPER */}
        {step === "whisper" && (
          <div>
            <div style={labelStyle}>PASSO 2 / 3</div>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px", color: "#e8f0fe" }}>
              Whisper.cpp — Voz para Texto
            </h2>
            <p style={{ fontSize: 12, lineHeight: 1.7, color: "rgba(200,214,229,0.7)", margin: "0 0 12px" }}>
              Transcrição 100% local. Privacidade total. O modelo{" "}
              <span style={{ color: "#00ff88" }}>large-v3-turbo</span> tem ~5% WER em Português.
            </p>

            <div style={{ fontSize: 12, marginBottom: 12, lineHeight: 2 }}>
              {dot(status?.whisper_binary ?? false)} Binário whisper-cli
              <br />
              {dot(status?.whisper_model ?? false)} Modelo (~1.6GB)
            </div>

            {!(status?.whisper_binary && status?.whisper_model) ? (
              <>
                <button
                  style={{ ...btnPrimary, opacity: whisperInstalling ? 0.5 : 1 }}
                  onClick={installWhisper}
                  disabled={whisperInstalling}
                >
                  {whisperInstalling ? "INSTALANDO..." : "INSTALAR AUTOMATICAMENTE"}
                </button>

                {whisperProgress && (
                  <div style={{ fontSize: 11, color: "#00ff88", marginTop: 8, lineHeight: 1.5 }}>
                    {whisperProgress}
                  </div>
                )}

                <details style={{ marginTop: 16 }}>
                  <summary style={{ fontSize: 10, color: "rgba(200,214,229,0.4)", cursor: "pointer" }}>
                    Instruções manuais (se a instalação automática falhar)
                  </summary>
                  <pre style={{
                    fontSize: 10, color: "#00ff88", lineHeight: 1.8, margin: "8px 0 0",
                    whiteSpace: "pre-wrap", wordBreak: "break-all",
                    padding: 12, background: "rgba(0,0,0,0.3)", borderRadius: 6,
                  }}>
{`git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp && make
bash ./models/download-ggml-model.sh large-v3-turbo`}
                  </pre>
                </details>
              </>
            ) : (
              <div style={{ fontSize: 12, color: "#00ff88", marginTop: 8, fontWeight: 600 }}>
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
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px", color: "#e8f0fe" }}>
              Permissões do Sistema
            </h2>
            <p style={{ fontSize: 12, lineHeight: 1.7, color: "rgba(200,214,229,0.7)", margin: "0 0 12px" }}>
              O macOS vai pedir autorização. Clica "Permitir" nos dois popups.
            </p>

            <div style={{ fontSize: 12, marginBottom: 16, lineHeight: 2.2 }}>
              {dot(status?.camera_permission ?? false)}
              <strong>Câmera</strong>
              <span style={{ fontSize: 10, color: "rgba(200,214,229,0.4)", marginLeft: 6 }}>presença + monitor de postura</span>
              <br />
              {dot(status?.mic_permission ?? false)}
              <strong>Microfone</strong>
              <span style={{ fontSize: 10, color: "rgba(200,214,229,0.4)", marginLeft: 6 }}>comandos de voz</span>
            </div>

            <button style={btnPrimary} onClick={requestPermissions}>
              AUTORIZAR CÂMERA + MIC
            </button>

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
              {essentialDone ? "✓" : "⚡"}
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px", color: "#e8f0fe" }}>
              {essentialDone ? "Tudo Pronto" : "Setup Parcial"}
            </h2>
            <p style={{ fontSize: 11, color: "rgba(200,214,229,0.5)", margin: "0 0 16px" }}>
              {essentialDone
                ? "O HoloSelf está operacional."
                : "O agente funciona com respostas pré-definidas. Configura a API Key depois para inteligência total."}
            </p>

            <div style={{ textAlign: "left", margin: "0 auto 20px", maxWidth: 320, fontSize: 12, lineHeight: 2.2 }}>
              {dot(status?.gemini_key ?? false)} Gemini (inteligência)
              <br />
              {dot((status?.whisper_binary && status?.whisper_model) ?? false)} Whisper (voz → texto)
              <br />
              {dot(status?.camera_permission ?? false)} Câmera + Mic
              <br />
              {dot(status?.cartesia_key ?? false)}
              <span style={{ color: "rgba(200,214,229,0.4)" }}>
                Cartesia TTS
                <span style={{ fontSize: 9, marginLeft: 4 }}>
                  {status?.cartesia_key ? "(premium)" : "(usando voz nativa macOS)"}
                </span>
              </span>
            </div>

            <button style={btnPrimary} onClick={onComplete}>
              ENTRAR NO HOLOSELF OS
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
