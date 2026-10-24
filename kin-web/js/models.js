// Pure data + logic for Kin. No DOM, no Firebase, so it is easy to test.

export const CATEGORIES = ["Kids", "Pets", "Meals", "Errands"];

export const CATEGORY_ICON = { Kids: "🧸", Pets: "🐾", Meals: "🍲", Errands: "🛍️" };

export const STATUS = {
  OPEN: "Open",
  REQUESTED: "Requested",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
};

/** Fixed neighborhood list. Coordinates are approximate centers, used only for a distance label. */
export const NEIGHBORHOODS = {
  "Brookline": [42.3318, -71.1212],
  "Cambridge": [42.3736, -71.1097],
  "Allston": [42.3539, -71.1337],
  "Back Bay": [42.3503, -71.0810],
  "Jamaica Plain": [42.3098, -71.1144],
  "Somerville": [42.3876, -71.0995],
  "Dorchester": [42.3016, -71.0676],
  "South Boston": [42.3381, -71.0476],
};
export const NEIGHBORHOOD_NAMES = Object.keys(NEIGHBORHOODS);

export function milesBetween(a, b) {
  const [lat1, lon1] = NEIGHBORHOODS[a];
  const [lat2, lon2] = NEIGHBORHOODS[b];
  const R = 3958.8;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** "1.4 mi", "Same neighborhood", or null when either side is unknown. */
export function distanceLabel(from, to) {
  if (!from || !to || !NEIGHBORHOODS[from] || !NEIGHBORHOODS[to]) return null;
  if (from === to) return "Same neighborhood";
  return `${milesBetween(from, to).toFixed(1)} mi`;
}

// ---- Trust score: one score per person across all 4 categories ----------

export const TRUSTED_MIN_AVG = 4.5;
export const TRUSTED_MIN_COUNT = 10;

export function isTrusted(avg, count) {
  return avg >= TRUSTED_MIN_AVG && count >= TRUSTED_MIN_COUNT;
}
export function avgText(avg, count) {
  return count > 0 ? Number(avg).toFixed(1) : "New";
}
export function countText(count) {
  return count === 1 ? "1 swap" : `${count} swaps`;
}
/** Running average after one more rating. Stars are clamped to 1-5. */
export function updatedTrust(avg, count, stars) {
  const s = Math.min(Math.max(Math.round(stars), 1), 5);
  const n = count + 1;
  return { avg: (avg * count + s) / n, count: n };
}

// ---- Small text helpers --------------------------------------------------

export function initials(name) {
  const letters = String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return letters || "?";
}

const AVATAR_COLORS = ["#4338ca", "#0f766e", "#7e22ce", "#be185d", "#92400e", "#1d4ed8", "#15803d", "#c2410c"];
export function avatarColor(name) {
  let sum = 0;
  for (const ch of String(name || "")) sum = (sum * 31 + ch.codePointAt(0)) % 1000003;
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

/** Keeps digits and a leading + so the value is safe inside tel:/sms: links. */
export function dialable(phone) {
  return String(phone || "")
    .split("")
    .filter((ch, i) => /\d/.test(ch) || (ch === "+" && i === 0))
    .join("");
}

export function counterpartUid(swap, uid) {
  if (swap.ownerUid === uid) return swap.requesterUid || null;
  if (swap.requesterUid === uid) return swap.ownerUid;
  return null;
}
export function involves(swap, uid) {
  return swap.ownerUid === uid || swap.requesterUid === uid;
}

// ---- Seed data: the 4 demo neighbors -------------------------------------

export const SEED_PREFIX = "seed-";

export function seedEntries(now = Date.now()) {
  const ago = (minutes) => now - minutes * 60000;
  const day = 60 * 24;

  const users = {
    sarah: { uid: "seed-sarah", name: "Sarah M.", phone: "617-555-0101", neighborhood: "Brookline", ratingAvg: 4.9, ratingCount: 23 },
    priya: { uid: "seed-priya", name: "Priya R.", phone: "617-555-0102", neighborhood: "Cambridge", ratingAvg: 5.0, ratingCount: 31 },
    marcus: { uid: "seed-marcus", name: "Marcus T.", phone: "617-555-0103", neighborhood: "Allston", ratingAvg: 4.7, ratingCount: 12 },
    james: { uid: "seed-james", name: "James K.", phone: "617-555-0104", neighborhood: "Back Bay", ratingAvg: 4.8, ratingCount: 17 },
  };

  const swaps = {
    sarah: { id: "seed-swap-sarah", ownerUid: "seed-sarah", category: "Kids", offerText: "Babysitting — Fri 6–10pm", needText: "Dog walking", when: "Fri 6–10pm", neighborhood: "Brookline", status: "Open", createdAt: ago(1) },
    priya: { id: "seed-swap-priya", ownerUid: "seed-priya", category: "Meals", offerText: "Chicken biryani — serves 4", needText: "Grocery run", when: "Thu 5pm", neighborhood: "Cambridge", status: "Open", createdAt: ago(2) },
    marcus: { id: "seed-swap-marcus", ownerUid: "seed-marcus", category: "Errands", offerText: "Grocery runs & pharmacy pickup", needText: "Babysitting — Saturday", when: "Sat 10am–2pm", neighborhood: "Allston", status: "Open", createdAt: ago(3) },
    james: { id: "seed-swap-james", ownerUid: "seed-james", category: "Pets", offerText: "Dog sitting — Sat & Sun", needText: "Home-cooked meal", when: "Sat & Sun", neighborhood: "Back Bay", status: "Open", createdAt: ago(4) },
  };

  const review = (key, n, by, stars, note, minutes) => ({
    id: `seed-rating-${key}-${n}`,
    swapId: swaps[key].id,
    raterUid: users[by].uid,
    ratedUid: users[key].uid,
    stars,
    note,
    createdAt: ago(minutes),
  });

  const reviews = {
    sarah: [
      review("sarah", 1, "priya", 5, "Arrived on time and my kids adored her. Would swap again.", day * 6),
      review("sarah", 2, "marcus", 5, "Easy to coordinate and super reliable.", day * 13),
    ],
    priya: [
      review("priya", 1, "james", 5, "The best biryani I have had in years. Generous portions.", day * 4),
      review("priya", 2, "sarah", 5, "Thoughtful, kind, and a wonderful cook.", day * 11),
    ],
    marcus: [
      review("marcus", 1, "sarah", 5, "Picked up my prescription and groceries without a hitch.", day * 5),
      review("marcus", 2, "james", 4, "Helpful and friendly. Ran a little late but let me know.", day * 15),
    ],
    james: [
      review("james", 1, "priya", 5, "My dog came home happy and tired. Great updates all weekend.", day * 3),
      review("james", 2, "marcus", 5, "Trustworthy and great with animals.", day * 9),
    ],
  };

  return ["sarah", "priya", "marcus", "james"].map((k) => ({
    user: users[k],
    swap: swaps[k],
    reviews: reviews[k],
  }));
}
