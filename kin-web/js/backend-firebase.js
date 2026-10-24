// Real backend: Firebase Auth (email + password) and Cloud Firestore.
// Loaded only when js/firebase-config.js has real values.
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  writeBatch,
  runTransaction,
  Timestamp,
  deleteField,
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

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

const toMs = (v) =>
  v && typeof v.toMillis === "function" ? v.toMillis() : typeof v === "number" ? v : Date.now();
const toTs = (ms) => Timestamp.fromMillis(ms);

export function createFirebaseBackend(config) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const userDoc = (u) => ({
    uid: u.uid, name: u.name, phone: u.phone, neighborhood: u.neighborhood,
    ratingAvg: u.ratingAvg, ratingCount: u.ratingCount,
  });
  const swapDoc = (s) => {
    const d = {
      id: s.id, ownerUid: s.ownerUid, category: s.category, offerText: s.offerText,
      needText: s.needText, when: s.when, neighborhood: s.neighborhood,
      status: s.status, createdAt: toTs(s.createdAt),
    };
    if (s.requesterUid) d.requesterUid = s.requesterUid;
    return d;
  };
  const ratingDoc = (r) => ({
    id: r.id, swapId: r.swapId, raterUid: r.raterUid, ratedUid: r.ratedUid,
    stars: r.stars, note: r.note || "", createdAt: toTs(r.createdAt),
  });

  return {
    mode: "firebase",

    onAuth(callback) {
      return onAuthStateChanged(auth, (user) => callback(user ? user.uid : null));
    },

    async signIn(email, password) {
      await signInWithEmailAndPassword(auth, email, password);
    },

    async signUp({ name, phone, neighborhood, email, password }) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;
      await setDoc(doc(db, "users", uid), userDoc({ uid, name, phone, neighborhood, ratingAvg: 0, ratingCount: 0 }));
    },

    async signOut() {
      await fbSignOut(auth);
    },

    /** Streams the three collections whole (fine at demo scale, needs no indexes). */
    subscribe(onData, onError) {
      const data = { users: {}, swaps: [], ratings: [] };
      let reported = false;
      const fail = (err) => {
        if (reported) return;
        reported = true;
        onError(err);
      };
      const emit = () => onData({ users: { ...data.users }, swaps: [...data.swaps], ratings: [...data.ratings] });

      const unsubs = [
        onSnapshot(collection(db, "users"), (snap) => {
          const users = {};
          snap.forEach((d) => {
            const x = d.data();
            users[d.id] = {
              uid: d.id, name: x.name || "Neighbor", phone: x.phone || "",
              neighborhood: x.neighborhood || "", ratingAvg: Number(x.ratingAvg) || 0,
              ratingCount: Number(x.ratingCount) || 0,
            };
          });
          data.users = users;
          emit();
        }, fail),
        onSnapshot(collection(db, "swaps"), (snap) => {
          data.swaps = snap.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id, ownerUid: x.ownerUid, category: x.category,
              offerText: x.offerText || "", needText: x.needText || "", when: x.when || "",
              neighborhood: x.neighborhood || "", status: x.status,
              createdAt: toMs(x.createdAt), requesterUid: x.requesterUid || null,
            };
          });
          emit();
        }, fail),
        onSnapshot(collection(db, "ratings"), (snap) => {
          data.ratings = snap.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id, swapId: x.swapId, raterUid: x.raterUid, ratedUid: x.ratedUid,
              stars: Number(x.stars) || 0, note: x.note || "", createdAt: toMs(x.createdAt),
            };
          });
          emit();
        }, fail),
      ];
      return () => unsubs.forEach((u) => u());
    },

    /** Writes the 4 demo neighbors if missing. Existing seed docs are never touched. */
    async seedIfNeeded() {
      for (const entry of seedEntries()) {
        const swapRef = doc(db, "swaps", entry.swap.id);
        if ((await getDoc(swapRef)).exists()) continue;
        const batch = writeBatch(db);
        batch.set(doc(db, "users", entry.user.uid), userDoc(entry.user));
        batch.set(swapRef, swapDoc(entry.swap));
        for (const r of entry.reviews) batch.set(doc(db, "ratings", r.id), ratingDoc(r));
        await batch.commit();
      }
    },

    async postSwap(uid, input) {
      checkSignedIn(uid);
      const clean = cleanPost(input);
      const ref = doc(collection(db, "swaps"));
      await setDoc(ref, swapDoc({
        id: ref.id, ownerUid: uid, category: clean.category, offerText: clean.offerText,
        needText: clean.needText, when: clean.when, neighborhood: clean.neighborhood,
        status: STATUS.OPEN, createdAt: Date.now(),
      }));
    },

    async requestSwap(swap, uid) {
      checkRequest(swap, uid);
      await updateDoc(doc(db, "swaps", swap.id), { status: STATUS.REQUESTED, requesterUid: uid });
    },

    async respond(swap, uid, accept) {
      checkRespond(swap, uid);
      const ref = doc(db, "swaps", swap.id);
      if (accept) await updateDoc(ref, { status: STATUS.CONFIRMED });
      else await updateDoc(ref, { status: STATUS.OPEN, requesterUid: deleteField() });
    },

    async markCompleted(swap, uid) {
      checkComplete(swap, uid);
      await updateDoc(doc(db, "swaps", swap.id), { status: STATUS.COMPLETED });
    },

    /** Writes the rating and updates the rated person's trust score in one transaction. */
    async rate(swap, uid, stars, note) {
      checkRate(swap, uid, stars);
      const ratedUid = counterpartUid(swap, uid);
      const ratingRef = doc(db, "ratings", `${swap.id}_${uid}`);
      const userRef = doc(db, "users", ratedUid);
      await runTransaction(db, async (tx) => {
        const existing = await tx.get(ratingRef);
        if (existing.exists()) throw new KinError("You already rated this swap.");
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) throw new KinError("That neighbor's profile was not found.");
        const d = userSnap.data();
        const next = updatedTrust(Number(d.ratingAvg) || 0, Number(d.ratingCount) || 0, stars);
        tx.set(ratingRef, ratingDoc({
          id: ratingRef.id, swapId: swap.id, raterUid: uid, ratedUid, stars,
          note: String(note || "").trim(), createdAt: Date.now(),
        }));
        tx.update(userRef, { ratingAvg: next.avg, ratingCount: next.count });
      });
    },
  };
}
