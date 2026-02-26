import { useEffect, useState } from "react";
import { create } from "zustand";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastStore {
  toasts: ToastItem[];
  add: (message: string, type?: ToastType) => void;
  remove: (id: number) => void;
}

let nextId = 0;

const MAX_TOASTS = 5;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (message, type = "info") => {
    const id = nextId++;
    set((s) => ({
      // Limit max toasts to prevent spam
      toasts: [...s.toasts, { id, message, type }].slice(-MAX_TOASTS),
    }));
    // Auto-remove after 4.2s (component fades at 3.5s + 700ms buffer for animation)
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4200);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

const typeColors: Record<ToastType, string> = {
  success: "rgba(100, 255, 180, 0.9)",
  error: "rgba(255, 160, 100, 0.9)",
  info: "rgba(120, 200, 255, 0.9)",
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div style={{ position: "absolute", top: 72, left: 16, right: 16, zIndex: 250, pointerEvents: "none" }}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: ToastItem }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="holo-card"
      style={{
        padding: "10px 16px",
        marginBottom: 6,
        fontSize: 12,
        color: typeColors[toast.type],
        textAlign: "center",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-8px)",
        transition: "all 0.3s ease",
      }}
    >
      {toast.message}
    </div>
  );
}
