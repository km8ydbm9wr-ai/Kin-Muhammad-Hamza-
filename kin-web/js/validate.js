// Business rules shared by the Firebase and demo backends.
import { STATUS, involves, counterpartUid } from "./models.js";

export class KinError extends Error {}

function fail(message) {
  throw new KinError(message);
}

export function checkSignedIn(uid) {
  if (!uid) fail("You need to be signed in to do that.");
}

export function checkRequest(swap, uid) {
  checkSignedIn(uid);
  if (!swap) fail("That swap no longer exists.");
  if (swap.ownerUid === uid) fail("You can't request your own swap.");
  if (swap.status !== STATUS.OPEN) fail("This swap is no longer open.");
}

export function checkRespond(swap, uid) {
  checkSignedIn(uid);
  if (!swap || swap.ownerUid !== uid) fail("Only the person who posted this swap can answer the request.");
  if (swap.status !== STATUS.REQUESTED) fail("There is no pending request on this swap.");
}

export function checkComplete(swap, uid) {
  checkSignedIn(uid);
  if (!swap || !involves(swap, uid)) fail("You are not part of this swap.");
  if (swap.status !== STATUS.CONFIRMED) fail("Only confirmed swaps can be marked completed.");
}

export function checkRate(swap, uid, stars) {
  checkSignedIn(uid);
  if (!swap || !involves(swap, uid)) fail("You are not part of this swap.");
  if (swap.status !== STATUS.COMPLETED) fail("You can rate a swap once it is completed.");
  if (!counterpartUid(swap, uid)) fail("There is nobody to rate on this swap.");
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) fail("Pick 1 to 5 stars.");
}

export function cleanPost(input) {
  const offerText = String(input.offerText || "").trim();
  const needText = String(input.needText || "").trim();
  const when = String(input.when || "").trim();
  if (!offerText || !needText || !when) fail("Fill in what you offer, what you need, and when.");
  return { ...input, offerText, needText, when };
}
