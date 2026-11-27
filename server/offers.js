// Discounts and special offers, created by admins (routes/admin.js) and applied at checkout.
//
// An offer is a percentage off the Premium price:
//   - with a code (e.g. RAMADAN30): the user types it at checkout;
//   - without a code ("automatic"): applied by itself to everyone, or to one chosen user.
// It can be limited to monthly or yearly, to a date range and to a number of uses.
// The discount is always computed here, on the server, from the stored offer.
import { collections } from "./db.js";
import { ApiError } from "./errors.js";
import { PRICES } from "./plans.js";

export const CODE_PATTERN = /^[A-Z0-9]{3,20}$/;

function isUsable(offer, interval, userId, now) {
  return (
    offer.active &&
    offer.intervals.includes(interval) &&
    (!offer.startsAt || offer.startsAt <= now) &&
    (!offer.endsAt || offer.endsAt > now) &&
    (offer.maxUses === null || offer.uses < offer.maxUses) &&
    (!offer.userId || offer.userId === userId)
  );
}

/** The price after a discount, in whole millimes (never below 0). */
export function discounted(amount, percentOff) {
  return Math.max(0, Math.round((amount * (100 - percentOff)) / 100));
}

/**
 * Finds the offer for this checkout: the typed code if there is one (an unknown or expired code is
 * an error), otherwise the best automatic offer for this user. Returns null when nothing applies.
 */
export async function findOffer({ code, interval, userId, now = new Date(), session }) {
  if (code) {
    const offer = await collections.offers.findOne({ code }, { session });
    if (!offer || !isUsable(offer, interval, userId, now)) {
      throw new ApiError("INVALID_PROMO", "This promo code is not valid for this plan.");
    }
    return offer;
  }
  const automatic = await collections.offers
    .find({ code: null, active: true, $or: [{ userId: null }, { userId }] }, { session })
    .toArray();
  const usable = automatic.filter((o) => isUsable(o, interval, userId, now));
  usable.sort((a, b) => b.percentOff - a.percentOff);
  return usable[0] || null;
}

/** { interval, originalAmount, amount, offer } — the price the user will pay. */
export async function quote({ interval, code, userId, session }) {
  const originalAmount = PRICES[interval].amount;
  const offer = await findOffer({ code, interval, userId, session });
  return {
    interval,
    originalAmount,
    amount: offer ? discounted(originalAmount, offer.percentOff) : originalAmount,
    offer: offer ? publicOffer(offer) : null,
  };
}

/** What a user may see of an offer (no usage counters, no target user). */
export function publicOffer(offer) {
  return { _id: offer._id, name: offer.name, code: offer.code, percentOff: offer.percentOff, endsAt: offer.endsAt };
}

/**
 * Inside the checkout transaction: counts one use. The condition is checked by MongoDB in the same
 * write, so two people cannot both take the last use of a limited offer.
 */
export async function useOffer(offer, session) {
  const result = await collections.offers.updateOne(
    { _id: offer._id, active: true, $or: [{ maxUses: null }, { $expr: { $lt: ["$uses", "$maxUses"] } }] },
    { $inc: { uses: 1 } },
    { session }
  );
  if (result.modifiedCount !== 1) throw new ApiError("INVALID_PROMO", "This offer has just run out. Please try again.");
}
