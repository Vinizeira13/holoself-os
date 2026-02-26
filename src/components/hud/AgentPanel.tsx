import { useState } from "react";
import { useAgentStore } from "../../stores/agentStore";
import { useToastStore } from "./Toast";
import { LoadingSkeleton } from "./LoadingSkeleton";
import type { AgentAction } from "../../types/health";

/**
 * AgentPanel — The Jarvis-like message display
 * Calm Technology: messages appear gently, no alarms, solution-focused.
 */
export function AgentPanel() {
  const { message, isLoading } = useAgentStore();
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const toast = useToastStore((s) => s.add);

  if (isLoading) {
    return (
      <div style={{ position: "absolute", bottom: 24, left: 16, right: 16, zIndex: 50 }}>
        <div className="holo-card" style={{ padding: "14px 18px" }}>
          <LoadingSkeleton count={2} height={14} />
        </div>
      </div>
    );
  }

  if (!message) return null;

  const categoryStyle = getCategoryStyle(message.category);

  const handleAction = async (action: AgentAction) => {
    setExecuting(true);
    setActionStatus("A processar...");
    try {
      if (typeof window.__TAURI__ !== "undefined") {
        const { invoke } = await import("@tauri-apps/api/core");
        const result = await invoke<string>("execute_agent_action", {
          actionType: action.action_type,
          payload: action.payload,
        });
        setActionStatus(result);
        toast(result, "success");
      } else {
        const name = (action.payload as Record<string, string>).name ?? "Item";
        setActionStatus(`${name} registado (dev mode)`);
        toast(`${name} registado`, "success");
      }
      setTimeout(() => setActionStatus(null), 3000);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setActionStatus(`Erro: ${errMsg}`);
      toast(`Erro: ${errMsg}`, "error");
      setTimeout(() => setActionStatus(null), 5000);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div
      className="slide-up"
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: categoryStyle.color,
              boxShadow: `0 0 6px ${categoryStyle.color}`,
            }}
          />
          <span style={{
            fontSize: 9,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "var(--holo-text-dim)",
          }}>
            {categoryStyle.label}
          </span>
        </div>

        {/* Agent message */}
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--holo-text)", fontWeight: 400 }}>
          {message.text}
        </p>

        {/* Action button or status */}
        {actionStatus ? (
          <p style={{ marginTop: 10, fontSize: 11, color: "var(--holo-accent)" }}>
            {actionStatus}
          </p>
        ) : message.action ? (
          <button
            className="holo-btn"
            onClick={() => handleAction(message.action!)}
            disabled={executing}
            style={{ marginTop: 12, opacity: executing ? 0.5 : 1 }}
          >
            {executing ? "A processar..." : "Confirmar"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function getCategoryStyle(category: string) {
  switch (category) {
    case "supplement_reminder":
      return { label: "Suplementação", color: "var(--holo-accent)" };
    case "health_insight":
      return { label: "Insight", color: "var(--holo-primary)" };
    case "calm_nudge":
      return { label: "Bem-estar", color: "var(--holo-secondary)" };
    case "schedule":
      return { label: "Agenda", color: "rgba(255, 200, 100, 0.7)" };
    default:
      return { label: "Sistema", color: "var(--holo-text-dim)" };
  }
}
