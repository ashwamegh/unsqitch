import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastMessage {
  id: number;
  text: string;
  type: ToastType;
}

let nextId = 0;
const listeners: Array<(toast: ToastMessage) => void> = [];

export function showToast(text: string, type: ToastType = "info") {
  const toast: ToastMessage = { id: nextId++, text, type };
  for (const listener of listeners) {
    listener(toast);
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: ToastMessage) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        removeToast(toast.id);
      }, 4000);
    },
    [removeToast],
  );

  useEffect(() => {
    listeners.push(addToast);
    return () => {
      const index = listeners.indexOf(addToast);
      if (index >= 0) listeners.splice(index, 1);
    };
  }, [addToast]);

  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case "success":
        return {
          bg: "bg-emerald-500/10 border-emerald-500/20 backdrop-blur-md",
          text: "text-emerald-400",
          icon: <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />,
        };
      case "error":
        return {
          bg: "bg-red-500/10 border-red-500/20 backdrop-blur-md",
          text: "text-red-400",
          icon: <AlertCircle size={16} className="text-red-400 shrink-0" />,
        };
      case "warning":
        return {
          bg: "bg-amber-500/10 border-amber-500/20 backdrop-blur-md",
          text: "text-amber-400",
          icon: <AlertTriangle size={16} className="text-amber-400 shrink-0" />,
        };
      default:
        return {
          bg: "bg-blue-500/10 border-blue-500/20 backdrop-blur-md",
          text: "text-blue-400",
          icon: <Info size={16} className="text-blue-400 shrink-0" />,
        };
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-3 pointer-events-none max-w-sm w-full">
      {toasts.map((toast) => {
        const styles = getToastStyles(toast.type);
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 border px-4 py-3.5 rounded-xl shadow-xl transition-all duration-300 transform translate-y-0 scale-100 ${styles.bg} animate-in fade-in slide-in-from-bottom-5`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {styles.icon}
              <span className={`text-xs font-semibold leading-relaxed truncate ${styles.text}`}>
                {toast.text}
              </span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-muted-foreground/60 hover:text-foreground/80 p-0.5 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
