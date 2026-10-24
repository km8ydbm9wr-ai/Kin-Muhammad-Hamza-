// App state: auth + live copies of users / swaps / ratings, backed by either
// the Firebase backend or the demo backend.

export const state = {
  mode: "demo",
  ready: false, // true once we know whether someone is signed in
  uid: null,
  users: {},
  swaps: [],
  ratings: [],
  toast: null, // { text, kind: "ok" | "error" }
};

const listeners = new Set();
export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const notify = () => listeners.forEach((fn) => fn(state));

let backend = null;
let unsubscribeData = null;
let toastTimer = null;

export function toast(text, kind = "ok") {
  state.toast = { text, kind };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    state.toast = null;
    notify();
  }, 4000);
  notify();
}

export function init(be) {
  backend = be;
  state.mode = be.mode;
  be.onAuth((uid) => {
    unsubscribeData?.();
    unsubscribeData = null;
    state.uid = uid;
    state.ready = true;
    if (uid) {
      unsubscribeData = be.subscribe(
        (data) => {
          state.users = data.users;
          state.swaps = data.swaps;
          state.ratings = data.ratings;
          notify();
        },
        (err) =>
          toast(
            `Could not load data from Firestore: ${err.message || err}. Check that Firestore exists and the rules in firestore.rules are published.`,
            "error"
          )
      );
      be.seedIfNeeded().catch((err) => toast(`Could not load the demo neighbors: ${err.message || err}`, "error"));
    } else {
      state.users = {};
      state.swaps = [];
      state.ratings = [];
    }
    notify();
  });
}

const need = () => {
  if (!backend) throw new Error("App is not ready yet.");
  return backend;
};

export const api = {
  signIn: (email, password) => need().signIn(email, password),
  signUp: (fields) => need().signUp(fields),
  signOut: () => need().signOut(),
  postSwap: (input) => need().postSwap(state.uid, input),
  requestSwap: (swap) => need().requestSwap(swap, state.uid),
  respond: (swap, accept) => need().respond(swap, state.uid, accept),
  markCompleted: (swap) => need().markCompleted(swap, state.uid),
  rate: (swap, stars, note) => need().rate(swap, state.uid, stars, note),
};

/** Friendly text for Firebase Auth and Firestore errors. */
export function friendlyError(err) {
  const code = err && err.code;
  const map = {
    "auth/invalid-credential": "Wrong email or password.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/user-not-found": "No account with that email. Try creating one.",
    "auth/email-already-in-use": "That email already has an account. Try signing in.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/network-request-failed": "Network problem. Check your connection and try again.",
    "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
    "auth/operation-not-allowed": "Email/Password sign-in is not enabled in your Firebase console yet.",
    "permission-denied": "Firestore refused that action. Check the rules in firestore.rules are published.",
  };
  return map[code] || (err && err.message) || "Something went wrong. Please try again.";
}
