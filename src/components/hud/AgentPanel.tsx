import { useState } from "react";
import { useAgentStore } from "../../stores/agentStore";
import type { AgentAction } from "../../types/health";

/**
 * AgentPanel — The Jarvis-like message display
 * Calm Technology: messages appear gently, no alarms, solution-focused.
 */
export function AgentPanel() {
  const { message, isLoading } = useAgentStore();
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  if (isLoading || !message) return null;

  const categoryStyle = getCategoryStyle(message.category);

  const handleAction = async (action: AgentAction) => {
    setActionStatus("A processar...");
    try {
      if (typeof window.__TAURI__ !== "undefined") {
        const { invoke } = await import("@tauri-apps/api/core");
        const result = await invoke<string>("execute_agent_action", {
          actionType: action.action_type,
          payload: action.payload,
        });
        setActionStatus(result);
      } else {
        // Mock for browser dev
        setActionStatus(`${(action.payload as Record<string, string>).name ?? "Item"} registado (dev mode)`);
      }
      // Clear after 3s
      setTimeout(() => setActionStatus(null), 3000);
    } catch (err) {
      setActionStatus(`Erro: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setActionStatus(null), 5000);
    }
  };

  return (
    <div
      className="fade-in"
      style={{
        position: "absolute",
        bottom: 24,
        left: 16,
        right: 16,
        zIndex: 50,
      }}
    >
      <div className="holo-card" style={{ padding: "14px 18px" }}>
        {/* Category indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: categoryStyle.color,
              boxShadow: `0 0 6px ${categoryStyle.color}`,
            }}
          />
          <span
            style={{
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "rgba(255, 255, 255, 0.4)",
            }}
          >
            {categoryStyle.label}
          </span>
        </div>

        {/* Agent message */}
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: "rgba(255, 255, 255, 0.85)",
            fontWeight: 400,
          }}
        >
          {message.text}
        </p>

        {/* Action button or status */}
        {actionStatus ? (
          <p
            style={{
              marginTop: 10,
              fontSize: 11,
              color: "rgba(100, 255, 180, 0.8)",
            }}
          >
            {actionStatus}
          </p>
        ) : message.action ? (
          <button
            onClick={() => handleAction(message.action!)}
            style={{
              marginTop: 12,
              padding: "8px 16px",
              background: "rgba(120, 200, 255, 0.1)",
              border: "1px solid rgba(120, 200, 255, 0.25)",
              borderRadius: 8,
              color: "rgba(120, 200, 255, 0.9)",
              fontSize: 11,
              cursor: "pointer",
              letterSpacing: "0.05em",
              transition: "all 0.2s ease",
              pointerEvents: "auto",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(120, 200, 255, 0.18)";
              e.currentTarget.style.borderColor = "rgba(120, 200, 255, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(120, 200, 255, 0.1)";
              e.currentTarget.style.borderColor = "rgba(120, 200, 255, 0.25)";
            }}
          >
            Confirmar
          </button>
        ) : null}
      </div>
    </div>
  );
}

function getCategoryStyle(category: string) {
  switch (category) {
    case "supplement_reminder":
      return { label: "Suplementação", color: "rgba(100, 255, 180, 0.8)" };
    case "health_insight":
      return { label: "Insight", color: "rgba(120, 200, 255, 0.8)" };
    case "calm_nudge":
      return { label: "Bem-estar", color: "rgba(180, 140, 255, 0.7)" };
    case "schedule":
      return { label: "Agenda", color: "rgba(255, 200, 100, 0.7)" };
    default:
      return { label: "Sistema", color: "rgba(255, 255, 255, 0.5)" };
  }
}
