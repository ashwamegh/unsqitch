import { useState, useEffect, useCallback } from 'react';

interface ToastMessage {
  id: number;
  text: string;
}

let nextId = 0;
const listeners: Array<(toast: ToastMessage) => void> = [];

export function showToast(text: string) {
  const toast: ToastMessage = { id: nextId++, text };
  for (const listener of listeners) {
    listener(toast);
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: ToastMessage) => {
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 3000);
  }, []);

  useEffect(() => {
    listeners.push(addToast);
    return () => {
      const index = listeners.indexOf(addToast);
      if (index >= 0) listeners.splice(index, 1);
    };
  }, [addToast]);

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div key={toast.id} className="bg-foreground text-background px-4 py-2 rounded shadow-lg text-sm animate-in fade-in slide-in-from-bottom-2">
          {toast.text}
        </div>
      ))}
    </div>
  );
}
