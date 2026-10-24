// Read-only views over app state: { uid, users: {uid: user}, swaps: [], ratings: [] }
import { STATUS, involves } from "./models.js";

const newestFirst = (a, b) => b.createdAt - a.createdAt;

export function currentUser(s) {
  return s.uid ? s.users[s.uid] || null : null;
}

export function swapById(s, id) {
  return s.swaps.find((x) => x.id === id) || null;
}

/** Open swaps for the Home feed, newest first. category "All" or empty = no filter. */
export function feed(s, category) {
  return s.swaps
    .filter((x) => x.status === STATUS.OPEN && (!category || category === "All" || x.category === category))
    .sort(newestFirst);
}

export function reviewsFor(s, uid) {
  return s.ratings.filter((r) => r.ratedUid === uid).sort(newestFirst);
}

export function hasRated(s, swapId) {
  return s.ratings.some((r) => r.swapId === swapId && r.raterUid === s.uid);
}

/** Confirmed swaps I'm part of, plus requests other people sent for my listings. */
export function upcoming(s) {
  return s.swaps
    .filter(
      (x) =>
        (x.status === STATUS.CONFIRMED && involves(x, s.uid)) ||
        (x.status === STATUS.REQUESTED && x.ownerUid === s.uid)
    )
    .sort(newestFirst);
}

/** Requests I sent that are still waiting for an answer ("Pending"). */
export function requestsSent(s) {
  return s.swaps
    .filter((x) => x.status === STATUS.REQUESTED && x.requesterUid === s.uid)
    .sort(newestFirst);
}

export function past(s) {
  return s.swaps
    .filter((x) => x.status === STATUS.COMPLETED && involves(x, s.uid))
    .sort(newestFirst);
}

export function myOpenListings(s) {
  return s.swaps
    .filter((x) => x.ownerUid === s.uid && x.status === STATUS.OPEN)
    .sort(newestFirst);
}
