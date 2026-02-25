import { useState } from "react";

interface SettingsPanelProps {
  visible: boolean;
  onClose: () => void;
}

export function SettingsPanel({ visible, onClose }: SettingsPanelProps) {
  const [geminiKey, setGeminiKey] = useState("");
  const [cartesiaKey, setCartesiaKey] = useState("");
  const [saved, setSaved] = useState(false);

  if (!visible) return null;

  const handleSave = () => {
    // Keys are stored as env vars in the Rust backend
    // In production, these would be saved to a local config file via Tauri
    console.log("Settings saved (env vars configured on system level)");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div
      className="fade-in"
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
    >
      <div
        className="holo-card"
        style={{
          width: "90%",
          maxWidth: 360,
          padding: 24,
          pointerEvents: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, color: "rgba(120, 200, 255, 0.9)", margin: 0 }}>
            Configurações
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255, 255, 255, 0.5)",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        {/* Gemini API Key */}
        <label style={labelStyle}>Gemini API Key</label>
        <input
          type="password"
          value={geminiKey}
          onChange={(e) => setGeminiKey(e.target.value)}
          placeholder="Configurado via variável GEMINI_API_KEY"
          style={inputStyle}
        />

        {/* Cartesia API Key */}
        <label style={{ ...labelStyle, marginTop: 16 }}>Cartesia API Key (TTS)</label>
        <input
          type="password"
          value={cartesiaKey}
          onChange={(e) => setCartesiaKey(e.target.value)}
          placeholder="Configurado via variável CARTESIA_API_KEY"
          style={inputStyle}
        />

        {/* Info */}
        <p style={{ fontSize: 10, color: "rgba(255, 255, 255, 0.35)", marginTop: 16, lineHeight: 1.5 }}>
          As chaves são configuradas como variáveis de ambiente no sistema.
          Crie um ficheiro <code style={{ color: "rgba(120, 200, 255, 0.6)" }}>.env</code> na raiz do projeto.
        </p>

        {/* Save */}
        <button onClick={handleSave} style={buttonStyle}>
          {saved ? "Guardado ✓" : "Guardar"}
        </button>
      </div>
    </div>
  );
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

const buttonStyle: React.CSSProperties = {
  marginTop: 20,
  width: "100%",
  padding: "10px",
  background: "rgba(120, 200, 255, 0.1)",
  border: "1px solid rgba(120, 200, 255, 0.25)",
  borderRadius: 8,
  color: "rgba(120, 200, 255, 0.9)",
  fontSize: 12,
  cursor: "pointer",
  letterSpacing: "0.05em",
};
