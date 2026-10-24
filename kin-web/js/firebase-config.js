// Paste your Firebase web app config here (Firebase console -> Project settings ->
// Your apps -> Web app -> SDK setup and configuration).
//
// While every value below still says REPLACE_ME, Kin runs in DEMO MODE: it works
// fully offline and keeps its data in this browser only. Fill this in and reload to
// switch to the real Firebase backend (Auth + Firestore).
//
// These values are not secrets; access is controlled by Firestore security rules.

export const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

export function isFirebaseConfigured(config = firebaseConfig) {
  return Object.values(config).every((v) => typeof v === "string" && v && !v.includes("REPLACE_ME"));
}
