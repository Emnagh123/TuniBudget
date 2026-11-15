import Icon from "./Icon.jsx";

/** Status of a budget. Always an icon and a text, never colour alone. */
export default function BudgetStatus({ status, percent }) {
  if (status === "exceeded") {
    return (
      <span className="badge badge--exceeded">
        <Icon name="warning" size={14} />
        Exceeded, {percent} %
      </span>
    );
  }
  if (status === "near") {
    return (
      <span className="badge badge--near">
        <Icon name="clock" size={14} />
        Near the limit, {percent} %
      </span>
    );
  }
  return <span className="muted small num">{percent} %</span>;
}
