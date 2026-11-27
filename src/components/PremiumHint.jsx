import Icon from "./Icon.jsx";

/**
 * A small "this is a Premium feature" line with a button to the Premium page.
 * It only explains: the server enforces every limit (a hidden button is not a security check).
 */
export default function PremiumHint({ children, goTo, compact = false }) {
  return (
    <p className={"premium-hint" + (compact ? " premium-hint--compact" : "")}>
      <Icon name="lock" />
      <span>{children}</span>
      <button type="button" className="btn btn--small btn--primary" onClick={() => goTo("premium")}>
        Go Premium
      </button>
    </p>
  );
}

/** The gold "Premium" pill shown next to a Premium user's name. */
export function PremiumBadge({ label = "Premium" }) {
  return <span className="premium-badge">{label}</span>;
}
