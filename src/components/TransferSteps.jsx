import Icon from "./Icon.jsx";

const MARKERS = { ok: "check", failed: "cross", rolledback: "undo" };

/**
 * The journal of a transfer. A step without a status is still pending (preview).
 * status: "ok" | "failed" | "rolledback"
 */
export default function TransferSteps({ steps, compact = false }) {
  return (
    <ol className={"journal" + (compact ? " journal--compact" : "")}>
      {steps.map((step) => (
        <li key={step.key} className="journal__item">
          <div className="journal__rail">
            <span className={"journal__marker" + (step.status ? " journal__marker--" + step.status : "")}>
              {step.status && <Icon name={MARKERS[step.status]} size={14} />}
            </span>
            <span className="journal__line" />
          </div>
          <div className="journal__body">
            <p className={"journal__title" + (step.status ? "" : " journal__title--pending")}>{step.title}</p>
            <p className="muted small num">{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
