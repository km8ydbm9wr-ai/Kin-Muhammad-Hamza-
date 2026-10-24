// Demo backend: same interface as the Firebase backend, but data lives in this
// browser's localStorage. Used only when Firebase is not configured yet.
// NOT secure (password check is a toy hash). It exists so the app runs instantly.
import { STATUS, seedEntries, updatedTrust, counterpartUid } from "./models.js";
import {
  KinError,
  checkRequest,
  checkRespond,
  checkComplete,
  checkRate,
  checkSignedIn,
  cleanPost,
} from "./validate.js";

const KEY = "kin-demo-v1";

function toyHash(text) {
  let h = 5381;
  for (const ch of text) h = ((h << 5) + h + ch.codePointAt(0)) | 0;
  return String(h);
}

function emptyDb() {
  return { accounts: [], users: {}, swaps: [], ratings: [], session: null };
}

export function createDemoBackend(storage = globalThis.localStorage) {
  const authListeners = new Set();
  const dataListeners = new Set();

  function load() {
    try {
      const parsed = JSON.parse(storage.getItem(KEY));
      if (parsed && typeof parsed === "object") return { ...emptyDb(), ...parsed };
    } catch { /* fall through to a fresh database */ }
    return emptyDb();
  }
  let db = load();

  function save() {
    storage.setItem(KEY, JSON.stringify(db));
  }
  function snapshot() {
    return {
      users: structuredClone(db.users),
      swaps: structuredClone(db.swaps),
      ratings: structuredClone(db.ratings),
    };
  }
  function emitData() {
    const s = snapshot();
    dataListeners.forEach((fn) => fn(s));
  }
  function emitAuth() {
    authListeners.forEach((fn) => fn(db.session));
  }
  function seed() {
    for (const e of seedEntries()) {
      if (db.swaps.some((s) => s.id === e.swap.id)) continue;
      db.users[e.user.uid] = e.user;
      db.swaps.push(e.swap);
      db.ratings.push(...e.reviews);
    }
  }
  seed();
  save();

  // Another tab changed the data: reload and notify.
  globalThis.addEventListener?.("storage", (ev) => {
    if (ev.key !== KEY) return;
    const before = db.session;
    db = load();
    emitData();
    if (before !== db.session) emitAuth();
  });

  const delay = () => Promise.resolve();

  return {
    mode: "demo",

    onAuth(callback) {
      authListeners.add(callback);
      queueMicrotask(() => callback(db.session));
      return () => authListeners.delete(callback);
    },

    async signIn(email, password) {
      await delay();
      const acct = db.accounts.find((a) => a.email === email.trim().toLowerCase());
      if (!acct || acct.pw !== toyHash(password)) throw new KinError("Wrong email or password.");
      db.session = acct.uid;
      save();
      emitAuth();
    },

    async signUp({ name, phone, neighborhood, email, password }) {
      await delay();
      const key = email.trim().toLowerCase();
      if (db.accounts.some((a) => a.email === key)) throw new KinError("That email already has an account. Try signing in.");
      if (password.length < 6) throw new KinError("Password must be at least 6 characters.");
      const uid = `u-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      db.accounts.push({ uid, email: key, pw: toyHash(password) });
      db.users[uid] = { uid, name, phone, neighborhood, ratingAvg: 0, ratingCount: 0 };
      db.session = uid;
      save();
      emitData();
      emitAuth();
    },

    async signOut() {
      db.session = null;
      save();
      emitAuth();
    },

    subscribe(onData) {
      dataListeners.add(onData);
      queueMicrotask(() => onData(snapshot()));
      return () => dataListeners.delete(onData);
    },

    async seedIfNeeded() {
      seed();
      save();
      emitData();
    },

    async postSwap(uid, input) {
      checkSignedIn(uid);
      const clean = cleanPost(input);
      db.swaps.push({
        id: `s-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        ownerUid: uid, category: clean.category, offerText: clean.offerText,
        needText: clean.needText, when: clean.when, neighborhood: clean.neighborhood,
        status: STATUS.OPEN, createdAt: Date.now(), requesterUid: null,
      });
      save();
      emitData();
    },

    async requestSwap(swap, uid) {
      const live = db.swaps.find((s) => s.id === swap?.id);
      checkRequest(live, uid);
      live.status = STATUS.REQUESTED;
      live.requesterUid = uid;
      save();
      emitData();
    },

    async respond(swap, uid, accept) {
      const live = db.swaps.find((s) => s.id === swap?.id);
      checkRespond(live, uid);
      if (accept) {
        live.status = STATUS.CONFIRMED;
      } else {
        live.status = STATUS.OPEN;
        live.requesterUid = null;
      }
      save();
      emitData();
    },

    async markCompleted(swap, uid) {
      const live = db.swaps.find((s) => s.id === swap?.id);
      checkComplete(live, uid);
      live.status = STATUS.COMPLETED;
      save();
      emitData();
    },

    async rate(swap, uid, stars, note) {
      const live = db.swaps.find((s) => s.id === swap?.id);
      checkRate(live, uid, stars);
      const id = `${live.id}_${uid}`;
      if (db.ratings.some((r) => r.id === id)) throw new KinError("You already rated this swap.");
      const ratedUid = counterpartUid(live, uid);
      const rated = db.users[ratedUid];
      if (!rated) throw new KinError("That neighbor's profile was not found.");
      const next = updatedTrust(rated.ratingAvg || 0, rated.ratingCount || 0, stars);
      db.ratings.push({
        id, swapId: live.id, raterUid: uid, ratedUid, stars,
        note: String(note || "").trim(), createdAt: Date.now(),
      });
      rated.ratingAvg = next.avg;
      rated.ratingCount = next.count;
      save();
      emitData();
    },
  };
}
