import { useEffect, useMemo, useState } from "react";
import "./feedback.css";

function FeedbackHost() {
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    const onToast = (event) => {
      const id = `${Date.now()}-${Math.random()}`;
      const payload = event.detail || {};
      const toast = {
        id,
        message: payload.message || "",
        type: payload.type || "info",
      };
      setToasts((prev) => [...prev, toast]);

      const duration = Number(payload.duration) || 3200;
      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, duration);
    };

    const onConfirm = (event) => {
      const payload = event.detail || null;
      if (!payload?.resolve) return;
      setConfirm(payload);
    };

    window.addEventListener("app:toast", onToast);
    window.addEventListener("app:confirm", onConfirm);

    return () => {
      window.removeEventListener("app:toast", onToast);
      window.removeEventListener("app:confirm", onConfirm);
    };
  }, []);

  const hasToast = useMemo(() => toasts.length > 0, [toasts.length]);

  return (
    <>
      <div className={`app-toast-stack ${hasToast ? "show" : ""}`}>
        {toasts.map((toast) => (
          <div key={toast.id} className={`app-toast ${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>

      {confirm ? (
        <div className="app-confirm-overlay">
          <div className="app-confirm-card">
            <p>{confirm.message}</p>
            <div className="app-confirm-actions">
              <button
                className="cancel"
                onClick={() => {
                  confirm.resolve(false);
                  setConfirm(null);
                }}
              >
                {confirm.cancelText || "Bekor"}
              </button>
              <button
                className="ok"
                onClick={() => {
                  confirm.resolve(true);
                  setConfirm(null);
                }}
              >
                {confirm.confirmText || "Tasdiqlash"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default FeedbackHost;
