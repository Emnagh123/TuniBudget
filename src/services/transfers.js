// Transfers run on the server as one MongoDB transaction (see server/routes/transfers.js).
// The server sends back the journal of steps (begin, lock, debit, credit, commit or rollback),
// also when the transfer fails, so the Transfer page can show where it stopped.
import { request } from "./api.js";
import { formatTnd } from "../utils/money.js";

/** The five steps of a transfer, with their titles. Used for the "what will happen" preview. */
export function planTransferSteps({ fromName, toName, amount, simulateFailure }) {
  const money = formatTnd(amount);
  return [
    { key: "begin", title: "Start of the transaction", detail: "Everything that follows is one single block." },
    { key: "lock", title: "Both accounts are locked", detail: "No other transfer can change them meanwhile." },
    { key: "debit", title: "Debit " + fromName, detail: "− " + money },
    simulateFailure
      ? { key: "credit", title: "Crash before the credit", detail: toName + " was never credited." }
      : { key: "credit", title: "Credit " + toName, detail: "+ " + money },
    simulateFailure
      ? { key: "rollback", title: "Rollback", detail: "The debit is undone: no balance changes." }
      : { key: "commit", title: "Commit", detail: "Debit and credit are saved together." },
  ];
}

export function transfer({ fromAccountId, toAccountId, amount, description = "", simulateFailure = false }) {
  return request("POST", "/transfers", {
    body: { fromAccountId, toAccountId, amount, description: String(description || ""), simulateFailure: Boolean(simulateFailure) },
    idempotent: true,
  });
}
