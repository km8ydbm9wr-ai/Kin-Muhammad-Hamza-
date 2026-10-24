import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";
import { state, init, subscribe, api, toast, friendlyError } from "./store.js";
import { html } from "./html.js";
import * as sel from "./selectors.js";
import { NEIGHBORHOOD_NAMES } from "./models.js";
import {
  homeScreen, detailScreen, postScreen, mySwapsScreen, profileScreen,
  authScreen, rateSheet, tabBar,
} from "./screens.js";

const root = document.getElementById("app");
const toastEl = document.getElementById("toast");

// ───────────── UI-only state (drafts, filters, sheets) ─────────────

const freshAuth = () => ({ name: "", phone: "", neighborhood: NEIGHBORHOOD_NAMES[0], email: "", password: "" });
const freshPost = () => ({ category: "Kids", offer: "", need: "", when: "", neighborhood: null });

const ui = {
  filter: "All",
  authMode: "signup",
  auth: freshAuth(),
  authError: null,
  post: freshPost(),
  rate: { swapId: null, stars: 5, note: "" },
  busy: false,
};

function setPath(path, value) {
  const keys = path.split(".");
  let target = ui;
  for (const k of keys.slice(0, -1)) target = target[k];
  target[keys[keys.length - 1]] = value;
}

// ───────────── Routing ─────────────

const TABS = ["home", "post", "myswaps", "profile"];
let lastTab = "home";

function parseRoute() {
  const parts = (location.hash.replace(/^#\/?/, "") || "home").split("/").filter(Boolean);
  if (parts[0] === "swap" && parts[1]) return { name: "swap", id: decodeURIComponent(parts[1]), from: lastTab };
  const name = TABS.includes(parts[0]) ? parts[0] : "home";
  return { name };
}

// ───────────── Rendering ─────────────

let routeKey = "";

function focusSelector(el) {
  if (!el || el === document.body) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  const d = el.dataset || {};
  if (!d.action) return null;
  let s = `[data-action="${CSS.escape(d.action)}"]`;
  for (const k of ["id", "value", "path"]) if (d[k] !== undefined) s += `[data-${k}="${CSS.escape(d[k])}"]`;
  return s;
}

function screenFor(route) {
  switch (route.name) {
    case "post": return postScreen(state, ui);
    case "myswaps": return mySwapsScreen(state, ui);
    case "profile": return profileScreen(state);
    case "swap": return detailScreen(state, ui, route.id);
    default: return homeScreen(state, ui);
  }
}

function render() {
  const route = parseRoute();
  if (TABS.includes(route.name)) lastTab = route.name;
  const key = state.ready ? `${state.uid ? "in" : "out"}:${location.hash}` : "boot";
  const routeChanged = key !== routeKey;
  routeKey = key;

  // Remember focus + scroll so live updates don't disturb the user.
  const active = document.activeElement;
  const selector = root.contains(active) ? focusSelector(active) : null;
  const caret = active && "selectionStart" in active ? (() => { try { return [active.selectionStart, active.selectionEnd]; } catch { return null; } })() : null;
  const scrollY = window.scrollY;

  let content;
  if (!state.ready) {
    content = html`<div class="empty-state"><p><strong>Loading…</strong></p></div>`;
  } else if (!state.uid) {
    content = html`<main id="main">${authScreen(state, ui)}</main>`;
  } else {
    const sheet = rateSheet(state, ui);
    const sheetOpen = !!ui.rate.swapId && String(sheet) !== "";
    content = html`
      <div ${sheetOpen ? html`inert` : ""}>
        <main id="main" class="screen">${screenFor(route)}</main>
        ${tabBar(route)}
      </div>
      ${sheet}`;
  }
  root.innerHTML = String(content);

  // Toast lives outside #app so its live region isn't torn down on every render.
  toastEl.className = state.toast ? `toast ${state.toast.kind}` : "toast hidden";
  toastEl.textContent = state.toast ? state.toast.text : "";

  if (routeChanged) {
    window.scrollTo(0, 0);
    const h1 = root.querySelector("h1");
    if (h1) { h1.setAttribute("tabindex", "-1"); h1.focus({ preventScroll: true }); }
  } else {
    window.scrollTo(0, scrollY);
    const target = selector && root.querySelector(selector);
    if (target) {
      target.focus({ preventScroll: true });
      if (caret && caret[0] !== null) { try { target.setSelectionRange(caret[0], caret[1]); } catch { /* not a text field */ } }
    } else if (ui.rate.swapId) {
      root.querySelector('[role="radio"][aria-checked="true"]')?.focus({ preventScroll: true });
    }
  }
}

let scheduled = false;
function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => { scheduled = false; render(); });
}

// ───────────── Actions ─────────────

async function run(work) {
  ui.busy = true;
  render();
  try {
    await work();
  } catch (err) {
    toast(friendlyError(err), "error");
  } finally {
    ui.busy = false;
    render();
  }
}

const swapFor = (id) => sel.swapById(state, id);

const actions = {
  set: (d) => { setPath(d.path, d.value); render(); },

  back: () => { if (history.length > 1) history.back(); else location.hash = "#/home"; },

  "auth-mode": (d) => { ui.authMode = d.value; ui.authError = null; render(); },

  "sign-out": async () => {
    try { await api.signOut(); } catch (err) { toast(friendlyError(err), "error"); return; }
    ui.auth = freshAuth(); ui.post = freshPost(); ui.filter = "All"; ui.rate = { swapId: null, stars: 5, note: "" };
    location.hash = "#/home";
  },

  request: (d) => run(async () => {
    await api.requestSwap(swapFor(d.id));
    toast("Request sent. It shows as Pending under My Swaps.");
  }),

  accept: (d) => run(async () => { await api.respond(swapFor(d.id), true); toast("Swap confirmed. You can now call or text each other."); }),
  decline: (d) => run(async () => { await api.respond(swapFor(d.id), false); toast("Request declined. Your listing is open again."); }),
  complete: (d) => run(async () => { await api.markCompleted(swapFor(d.id)); toast("Marked completed. You can rate it under Past."); }),

  "open-rate": (d) => { ui.rate = { swapId: d.id, stars: 5, note: "" }; render(); },
  "close-rate": () => { ui.rate = { swapId: null, stars: 5, note: "" }; render(); },
  "close-rate-backdrop": (_d, e) => { if (e.target === e.currentTarget) actions["close-rate"](); },
  "set-stars": (d) => { ui.rate.stars = Number(d.value); render(); },
};

const forms = {
  async auth() {
    const a = ui.auth;
    const email = a.email.trim();
    ui.authError = null;
    if (!email.includes("@")) { ui.authError = "Enter a valid email address."; return render(); }
    if (a.password.length < 6) { ui.authError = "Password must be at least 6 characters."; return render(); }
    if (ui.authMode === "signup" && (!a.name.trim() || !a.phone.trim())) {
      ui.authError = "Enter your name and phone number."; return render();
    }
    ui.busy = true; render();
    try {
      if (ui.authMode === "signup") {
        await api.signUp({ name: a.name.trim(), phone: a.phone.trim(), neighborhood: a.neighborhood, email, password: a.password });
      } else {
        await api.signIn(email, a.password);
      }
      ui.auth = freshAuth();
      location.hash = "#/home";
    } catch (err) {
      ui.authError = friendlyError(err);
    } finally {
      ui.busy = false; render();
    }
  },

  async post() {
    const me = sel.currentUser(state);
    const p = ui.post;
    if (!p.offer.trim() || !p.need.trim() || !p.when.trim()) return;
    await run(async () => {
      await api.postSwap({
        category: p.category, offerText: p.offer, needText: p.need, when: p.when,
        neighborhood: p.neighborhood || me?.neighborhood || NEIGHBORHOOD_NAMES[0],
      });
      ui.post = freshPost();
      toast("Posted. Your swap is live for neighbors.");
      location.hash = "#/home";
    });
  },

  async rate() {
    const swap = swapFor(ui.rate.swapId);
    if (!swap) return;
    await run(async () => {
      await api.rate(swap, ui.rate.stars, ui.rate.note);
      ui.rate = { swapId: null, stars: 5, note: "" };
      toast("Thanks! Their trust score has been updated.");
    });
  },
};

// ───────────── Event wiring (delegated, so re-rendering is safe) ─────────────

root.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el || !root.contains(el) || el.disabled) return;
  const handler = actions[el.dataset.action];
  if (handler) handler(el.dataset, { target: e.target, currentTarget: el });
});

root.addEventListener("submit", (e) => {
  e.preventDefault();
  const handler = forms[e.target.dataset.form];
  if (handler) handler();
});

function postReady() {
  const p = ui.post;
  return !!(p.offer.trim() && p.need.trim() && p.when.trim()) && !ui.busy;
}

root.addEventListener("input", (e) => {
  const path = e.target.dataset?.bind;
  if (!path) return;
  setPath(path, e.target.value);
  // Update the Post button in place so typing never loses focus.
  const submit = e.target.form?.querySelector('button[type="submit"]');
  if (submit && e.target.form.dataset.form === "post") submit.disabled = !postReady();
});

root.addEventListener("change", (e) => {
  const path = e.target.dataset?.bind;
  if (path) setPath(path, e.target.value);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && ui.rate.swapId) actions["close-rate"]();
});

window.addEventListener("hashchange", render);
subscribe(scheduleRender);

// ───────────── Boot ─────────────

async function boot() {
  const forceDemo = new URLSearchParams(location.search).has("demo");
  let backend;
  try {
    if (!forceDemo && isFirebaseConfigured(firebaseConfig)) {
      const mod = await import("./backend-firebase.js");
      backend = mod.createFirebaseBackend(firebaseConfig);
    } else {
      const mod = await import("./backend-demo.js");
      backend = mod.createDemoBackend();
    }
  } catch (err) {
    root.innerHTML = String(html`
      <main class="auth"><h1>Kin</h1>
        <p class="error" role="alert">Could not start the app: ${err.message || err}</p>
        <p class="muted">If you are offline, Firebase can't load. You can open the offline demo instead.</p>
        <a class="btn-primary big" href="?demo=1">Open demo mode</a>
      </main>`);
    return;
  }
  init(backend);
}

boot();
