import { formatMillimes, splitMillimes } from "../utils/money.js";

/** Large balance: the whole dinars are big, the millimes are lighter. */
export function BigMoney({ millimes, size = 38, unit = "TND" }) {
  const { negative, whole, fraction } = splitMillimes(millimes);
  return (
    <p className="big-money" style={{ "--money-size": size + "px" }}>
      <span className="big-money__whole">{(negative ? "−" : "") + whole}</span>
      <span className="big-money__fraction">{fraction}</span>
      {unit && <span className="big-money__unit">{unit}</span>}
    </p>
  );
}

/**
 * Amount of a ledger entry. Debits and credits always carry a sign (colour is not the
 * only signal). With neutral: true (transfers between own accounts) there is no sign.
 */
export function Amount({ millimes, type, neutral = false }) {
  if (neutral) return <span className="num neutral">{formatMillimes(millimes)}</span>;
  const credit = type === "credit";
  return (
    <span className={"num " + (credit ? "pos" : "neg")}>
      {formatMillimes(credit ? millimes : -millimes, { signed: true })}
    </span>
  );
}
