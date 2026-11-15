import Icon from "./Icon.jsx";

export function Loading({ label = "Loading" }) {
  return (
    <div className="state state--center" role="status">
      <span className="spinner" aria-hidden="true" />
      <p>{label}…</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state state--center" role="alert">
      <Icon name="warning" size={24} />
      <p className="state__title">Something went wrong</p>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn--small" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="state">
      <p className="state__title">{title}</p>
      {children && <p>{children}</p>}
    </div>
  );
}
