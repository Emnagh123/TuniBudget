import { useEffect } from "react";
import Icon from "./Icon.jsx";

/** A short message in the corner. It closes itself after 5 seconds. */
export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  const isError = toast.type === "error";
  return (
    <div className={"toast" + (isError ? " toast--error" : "")} role={isError ? "alert" : "status"}>
      <Icon name={isError ? "warning" : "check"} size={18} />
      <span>{toast.message}</span>
      <button type="button" className="toast__close" onClick={onClose} aria-label="Close message">
        <Icon name="cross" size={16} />
      </button>
    </div>
  );
}
