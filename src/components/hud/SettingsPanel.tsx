import { useEffect, useState, useCallback } from "react";
import { useToastStore } from "./Toast";
import { IconX, IconEye, IconEyeOff } from "./Icons";

interface AppSettings {
  gemini_api_key: string;
  cartesia_api_key: string;
  cartesia_voice_id: string;
  skin_type: number;
  latitude: number;
  longitude: number;
  timezone: string;
  sleep_anchor_hour: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  gemini_api_key: "",
  cartesia_api_key: "",
  cartesia_voice_id: "a0e99841-438c-4a64-b679-ae501e7d6091",
  skin_type: 4,
  latitude: 38.72,
  longitude: -9.14,
  timezone: "Europe/Lisbon",
  sleep_anchor_hour: 23,
};

interface SettingsPanelProps {
  visible: boolean;
  onClose: () => void;
}

type Tab = "keys" | "health" | "sleep";

export function SettingsPanel({ visible, onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("keys");
  const [showGemini, setShowGemini] = useState(false);
  const [showCartesia, setShowCartesia] = useState(false);
  const toast = useToastStore((s) => s.add);

  const loadSettings = useCallback(async () => {
    try {
      if (typeof window.__TAURI__ !== "undefined") {
        const { invoke } = await import("@tauri-apps/api/core");
        const s = await invoke<AppSettings>("get_settings");
        setSettings(s);
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      loadSettings();
    }
  }, [visible, loadSettings]);

  if (!visible) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (typeof window.__TAURI__ !== "undefined") {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("save_settings", { settings });
        toast("Configurações salvas", "success");
      } else {
        toast("Salvo (modo dev)", "info");
      }
    } catch (err) {
      console.error("Failed to save settings:", err);
      toast("Erro ao salvar configurações", "error");
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "keys", label: "API Keys" },
    { id: "health", label: "Saúde" },
    { id: "sleep", label: "Sono" },
  ];

  return (
    <div
      className="scale-in"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.4)",
        backdropFilter: "blur(8px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="holo-card"
        style={{
          width: "90%",
          maxWidth: 380,
          padding: 0,
          pointerEvents: "auto",
          maxHeight: "80vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 12px" }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, color: "var(--holo-primary)", margin: 0 }}>
            Configurações
          </h3>
          <button className="holo-icon-btn" onClick={onClose} aria-label="Fechar">
            <IconX size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, padding: "0 20px", borderBottom: "1px solid var(--holo-border)" }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "8px 14px",
                background: "none",
                border: "none",
                borderBottom: tab === t.id ? "2px solid var(--holo-primary)" : "2px solid transparent",
                color: tab === t.id ? "var(--holo-primary)" : "var(--holo-text-dim)",
                fontSize: 11,
                cursor: "pointer",
                letterSpacing: "0.04em",
                transition: "all 0.2s ease",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 20, color: "var(--holo-text-dim)", fontSize: 12 }}>
              Carregando...
            </div>
          ) : (
            <>
              {tab === "keys" && (
                <div className="fade-in">
                  <label style={labelStyle}>Gemini API Key</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showGemini ? "text" : "password"}
                      value={settings.gemini_api_key}
                      onChange={(e) => update("gemini_api_key", e.target.value)}
                      placeholder="AIza..."
                      style={inputStyle}
                    />
                    <button
                      onClick={() => setShowGemini(!showGemini)}
                      style={eyeBtnStyle}
                      aria-label={showGemini ? "Esconder" : "Mostrar"}
                    >
                      {showGemini ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                    </button>
                  </div>

                  <label style={{ ...labelStyle, marginTop: 16 }}>Cartesia API Key (TTS)</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showCartesia ? "text" : "password"}
                      value={settings.cartesia_api_key}
                      onChange={(e) => update("cartesia_api_key", e.target.value)}
                      placeholder="sk-..."
                      style={inputStyle}
                    />
                    <button
                      onClick={() => setShowCartesia(!showCartesia)}
                      style={eyeBtnStyle}
                      aria-label={showCartesia ? "Esconder" : "Mostrar"}
                    >
                      {showCartesia ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                    </button>
                  </div>

                  <label style={{ ...labelStyle, marginTop: 16 }}>Voice ID (Cartesia)</label>
                  <input
                    type="text"
                    value={settings.cartesia_voice_id}
                    onChange={(e) => update("cartesia_voice_id", e.target.value)}
                    placeholder="UUID da voz"
                    style={inputStyle}
                  />

                  <p style={hintStyle}>
                    Variáveis de ambiente (GEMINI_API_KEY, CARTESIA_API_KEY) têm prioridade sobre estes campos.
                  </p>
                </div>
              )}

              {tab === "health" && (
                <div className="fade-in">
                  <label style={labelStyle}>Tipo de Pele (Fitzpatrick)</label>
                  <select
                    value={settings.skin_type}
                    onChange={(e) => update("skin_type", Number(e.target.value))}
                    style={inputStyle}
                  >
                    {[1, 2, 3, 4, 5, 6].map((t) => (
                      <option key={t} value={t}>
                        Tipo {t} — {skinTypeLabel(t)}
                      </option>
                    ))}
                  </select>

                  <label style={{ ...labelStyle, marginTop: 16 }}>Latitude</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.latitude}
                    onChange={(e) => update("latitude", Number(e.target.value))}
                    style={inputStyle}
                  />

                  <label style={{ ...labelStyle, marginTop: 16 }}>Longitude</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.longitude}
                    onChange={(e) => update("longitude", Number(e.target.value))}
                    style={inputStyle}
                  />

                  <p style={hintStyle}>
                    Latitude/longitude são usadas para calcular o índice UV e recomendação de Vitamina D.
                  </p>
                </div>
              )}

              {tab === "sleep" && (
                <div className="fade-in">
                  <label style={labelStyle}>Hora Âncora de Sono</label>
                  <select
                    value={settings.sleep_anchor_hour}
                    onChange={(e) => update("sleep_anchor_hour", Number(e.target.value))}
                    style={inputStyle}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {String(i).padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>

                  <label style={{ ...labelStyle, marginTop: 16 }}>Fuso Horário</label>
                  <input
                    type="text"
                    value={settings.timezone}
                    onChange={(e) => update("timezone", e.target.value)}
                    placeholder="Europe/Lisbon"
                    style={inputStyle}
                  />

                  <p style={hintStyle}>
                    A hora âncora define quando o agente sugere Melatonina e prepara rotina noturna.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px 16px", borderTop: "1px solid var(--holo-border)" }}>
          <button
            className="holo-btn"
            onClick={handleSave}
            disabled={saving || loading}
            style={{ width: "100%", padding: "10px", fontSize: 12, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "Salvando..." : "Salvar Configurações"}
          </button>
        </div>
      </div>
    </div>
  );
}

function skinTypeLabel(type: number): string {
  const labels: Record<number, string> = {
    1: "Muito clara, sempre queima",
    2: "Clara, queima fácil",
    3: "Média, queima moderado",
    4: "Oliva, raramente queima",
    5: "Morena, queima muito raro",
    6: "Escura, nunca queima",
  };
  return labels[type] || "";
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "rgba(255, 255, 255, 0.45)",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  background: "rgba(255, 255, 255, 0.05)",
  border: "1px solid rgba(120, 200, 255, 0.15)",
  borderRadius: 8,
  color: "rgba(255, 255, 255, 0.8)",
  fontSize: 12,
  outline: "none",
};

const eyeBtnStyle: React.CSSProperties = {
  position: "absolute",
  right: 8,
  top: "50%",
  transform: "translateY(-50%)",
  background: "none",
  border: "none",
  color: "rgba(120, 200, 255, 0.5)",
  cursor: "pointer",
  padding: 4,
  display: "flex",
  alignItems: "center",
};

const hintStyle: React.CSSProperties = {
  fontSize: 10,
  color: "rgba(255, 255, 255, 0.3)",
  marginTop: 14,
  lineHeight: 1.5,
};
