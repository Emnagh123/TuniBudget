// Idempotency keys for money movements. The browser sends a random Idempotency-Key header with
// each transfer or operation. If the same request arrives twice (double click, network retry),
// the second one gets the first answer back instead of moving the money a second time.
import { collections } from "./db.js";
import { ApiError } from "./errors.js";

function keyOf(req) {
  const key = req.get("idempotency-key");
  if (!key) return null;
  if (!/^[A-Za-z0-9-]{16,64}$/.test(key)) throw new ApiError("INVALID_REQUEST", "The Idempotency-Key header is not valid.");
  return req.user._id + ":" + key;
}

/** Returns the stored answer of an earlier identical request, or null. */
export async function previousResponse(req) {
  const id = keyOf(req);
  if (!id) return null;
  const entry = await collections.idempotencyKeys.findOne({ _id: id });
  return entry && entry.response ? entry.response : null;
}

/** Called inside the money transaction: claims the key, so a parallel duplicate fails. */
export async function claim(req, session) {
  const id = keyOf(req);
  if (!id) return null;
  try {
    await collections.idempotencyKeys.insertOne({ _id: id, createdAt: new Date(), response: null }, { session });
  } catch (err) {
    if (err.code === 11000) throw new ApiError("DUPLICATE_REQUEST", "This operation was already sent. Refresh to see the result.");
    throw err;
  }
  return id;
}

/** Called inside the same transaction, once the answer is known. */
export async function remember(id, response, session) {
  if (id) await collections.idempotencyKeys.updateOne({ _id: id }, { $set: { response } }, { session });
}
