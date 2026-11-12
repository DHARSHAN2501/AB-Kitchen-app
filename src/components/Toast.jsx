import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const TOAST_EVENT = 'app:show-toast';

export const showToast = ({
  title = 'Success',
  message = '',
  variant = 'success',
  duration = 3500
} = {}) => {
  try {
    window.dispatchEvent(
      new CustomEvent(TOAST_EVENT, {
        detail: {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title,
          message,
          variant,
          duration
        }
      })
    );
  } catch (e) {
    console.warn('Toast dispatch failed:', e);
  }
};

const VARIANT_STYLES = {
  success: {
    container: 'bg-white border-emerald-200 ring-emerald-500/15 text-slate-900',
    iconWrap: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800',
    Icon: CheckCircle2
  },
  warning: {
    container: 'bg-white border-amber-200 ring-amber-500/15 text-slate-900',
    iconWrap: 'bg-amber-50 text-amber-600 border-amber-200',
    badge: 'bg-amber-100 text-amber-800',
    Icon: AlertTriangle
  },
  danger: {
    container: 'bg-white border-rose-200 ring-rose-500/15 text-slate-900',
    iconWrap: 'bg-rose-50 text-rose-600 border-rose-200',
    badge: 'bg-rose-100 text-rose-800',
    Icon: XCircle
  },
  info: {
    container: 'bg-white border-blue-200 ring-blue-500/15 text-slate-900',
    iconWrap: 'bg-blue-50 text-blue-600 border-blue-200',
    badge: 'bg-blue-100 text-blue-800',
    Icon: Info
  }
};

export const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleToast = (e) => {
      const detail = e.detail;
      if (!detail) return;
      setToasts((prev) => [...prev.slice(-2), detail]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== detail.id));
      }, detail.duration || 3500);
    };

    window.addEventListener(TOAST_EVENT, handleToast);
    return () => window.removeEventListener(TOAST_EVENT, handleToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-20 right-4 sm:right-6 z-[9999] flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2rem)] pointer-events-none"
      aria-live="polite"
    >
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      {toasts.map((toast) => {
        const style = VARIANT_STYLES[toast.variant] || VARIANT_STYLES.success;
        const Icon = style.Icon;
        return (
          <div
            key={toast.id}
            style={{ animation: 'toastSlideIn 0.22s ease-out forwards' }}
            className={`pointer-events-auto rounded-2xl border shadow-2xl ring-4 p-3.5 flex items-start gap-3 ${style.container}`}
          >
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${style.iconWrap}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${style.badge}`}>
                  {toast.title}
                </span>
              </div>
              {toast.message && (
                <p className="text-xs font-bold text-slate-800 mt-1 leading-snug">
                  {toast.message}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer shrink-0"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
