import { html } from "./html.js";
import * as sel from "./selectors.js";
import {
  CATEGORIES, CATEGORY_ICON, NEIGHBORHOOD_NAMES, STATUS, distanceLabel,
  isTrusted, avgText, countText, counterpartUid,
} from "./models.js";
import {
  avatar, chip, trustLine, trustedBadge, offerNeed, reviewRow, contactBlock, emptyNote,
} from "./components.js";

const nameOf = (s, uid) => s.users[uid]?.name || "Neighbor";

function demoBanner(s) {
  return s.mode === "demo"
    ? html`<p class="banner" role="note"><strong>Demo mode.</strong> Data stays in this browser. Add your Firebase keys in <code>js/firebase-config.js</code> to use the real backend.</p>`
    : "";
}

// ───────────────────────── Home ─────────────────────────

function swapCard(s, swap) {
  const owner = s.users[swap.ownerUid];
  const me = sel.currentUser(s);
  const meta = [swap.when, swap.neighborhood, distanceLabel(me?.neighborhood, swap.neighborhood)]
    .filter(Boolean)
    .join(" · ");
  return html`
    <li>
      <a class="card" href="#/swap/${swap.id}">
        ${avatar(owner?.name || "Neighbor")}
        <div class="card-body">
          <div class="row between">
            <h2>${owner?.name || "Neighbor"}</h2>
            ${chip(swap.category)}
          </div>
          ${trustLine(owner?.ratingAvg || 0, owner?.ratingCount || 0)}
          ${offerNeed("Offers", swap.offerText)}
          ${offerNeed("Needs", swap.needText)}
          <p class="meta">${meta}</p>
        </div>
      </a>
    </li>`;
}

export function homeScreen(s, ui) {
  const items = sel.feed(s, ui.filter);
  return html`
    <header class="top"><h1>Kin</h1><p class="tagline">Your neighborhood is your kin</p></header>
    <div class="pills" role="group" aria-label="Filter by category">
      ${["All", ...CATEGORIES].map(
        (c) => html`<button type="button" class="pill" aria-pressed="${String(ui.filter === c)}"
          data-action="set" data-path="filter" data-value="${c}">${c}</button>`
      )}
    </div>
    ${items.length
      ? html`<ul class="cards">${items.map((x) => swapCard(s, x))}</ul>`
      : html`<div class="empty-state">
          <p><strong>${s.swaps.length === 0 ? "Loading neighbors…" : "No swaps here yet"}</strong></p>
          <p class="muted">${s.swaps.length === 0 ? "Fetching swaps near you." : "Try another category or post your own swap."}</p>
        </div>`}`;
}

// ───────────────────────── Detail ─────────────────────────

export function detailScreen(s, ui, swapId) {
  const swap = sel.swapById(s, swapId);
  const back = html`<button type="button" class="back" data-action="back">‹ Back</button>`;
  if (!swap) {
    return html`<header class="top row">${back}<h1 class="inline">Swap</h1></header>
      <div class="empty-state"><p><strong>Swap not found</strong></p><p class="muted">It may have been removed.</p></div>`;
  }
  const owner = s.users[swap.ownerUid];
  const me = sel.currentUser(s);
  const reviews = sel.reviewsFor(s, swap.ownerUid).slice(0, 2);
  const otherUid = s.uid ? counterpartUid(swap, s.uid) : null;
  const other = otherUid ? s.users[otherUid] : null;
  const matched = swap.status === STATUS.CONFIRMED && other;
  const mine = swap.ownerUid === s.uid;
  const sentByMe = swap.requesterUid === s.uid && swap.status === STATUS.REQUESTED;
  const dist = distanceLabel(me?.neighborhood, swap.neighborhood);

  let action;
  if (mine) {
    action = html`<p class="muted center">This is your listing · ${swap.status}</p>`;
  } else if (swap.status === STATUS.OPEN) {
    action = html`<button type="button" class="btn-primary big" data-action="request" data-id="${swap.id}" ${ui.busy ? "disabled" : ""}>Request Swap</button>`;
  } else if (sentByMe) {
    action = html`<button type="button" class="btn-primary big" disabled>Request sent · Pending</button>`;
  } else {
    action = html`<p class="muted center">${swap.requesterUid === s.uid ? `Status: ${swap.status}` : "This swap is no longer open."}</p>`;
  }

  return html`
    <header class="top row">${back}<h1 class="inline">Swap</h1></header>
    <section class="person">
      ${avatar(owner?.name || "Neighbor", 64)}
      <div>
        <h2 class="name">${owner?.name || "Neighbor"}</h2>
        ${trustLine(owner?.ratingAvg || 0, owner?.ratingCount || 0)}
        <div class="row gap wrap">${chip(swap.category)} ${owner && isTrusted(owner.ratingAvg, owner.ratingCount) ? trustedBadge() : ""}</div>
      </div>
    </section>

    <section class="box"><h3>Offers</h3><p>${swap.offerText}</p></section>
    <section class="box"><h3>Needs</h3><p>${swap.needText}</p></section>

    <dl class="facts">
      <div><dt>🕒 When</dt><dd>${swap.when}</dd></div>
      <div><dt>📍 Neighborhood</dt><dd>${swap.neighborhood}${dist ? html` · ${dist}` : ""}</dd></div>
    </dl>
    <p class="muted small">Exact address is shared only after a match, by call or text.</p>

    ${matched
      ? html`<section class="box matched"><h3>You're matched</h3>${contactBlock(other)}</section>`
      : ""}

    <section>
      <h3>Reviews</h3>
      ${reviews.length
        ? html`<ul class="reviews">${reviews.map((r) => reviewRow(r, nameOf(s, r.raterUid)))}</ul>`
        : emptyNote("No reviews yet.")}
    </section>

    <div class="action-bar">${action}</div>`;
}

// ───────────────────────── Post ─────────────────────────

export function postScreen(s, ui) {
  const me = sel.currentUser(s);
  const hood = ui.post.neighborhood || me?.neighborhood || NEIGHBORHOOD_NAMES[0];
  const ready = ui.post.offer.trim() && ui.post.need.trim() && ui.post.when.trim() && !ui.busy;
  return html`
    <header class="top"><h1>Post a swap</h1></header>
    <form data-form="post" class="form" novalidate>
      <fieldset>
        <legend>Category</legend>
        <div class="grid2">
          ${CATEGORIES.map(
            (c) => html`<button type="button" class="cat-btn cat-${c.toLowerCase()}" aria-pressed="${String(ui.post.category === c)}"
              data-action="set" data-path="post.category" data-value="${c}"><span aria-hidden="true">${CATEGORY_ICON[c]}</span> ${c}</button>`
          )}
        </div>
      </fieldset>

      <label for="post-offer">I offer</label>
      <input id="post-offer" data-bind="post.offer" value="${ui.post.offer}" maxlength="120" placeholder="e.g. Babysitting — Fri 6–10pm" autocomplete="off">

      <label for="post-need">I need</label>
      <input id="post-need" data-bind="post.need" value="${ui.post.need}" maxlength="120" placeholder="e.g. Dog walking" autocomplete="off">

      <label for="post-when">When</label>
      <input id="post-when" data-bind="post.when" value="${ui.post.when}" maxlength="60" placeholder="e.g. Fri 6–10pm" autocomplete="off">

      <label for="post-hood">Neighborhood</label>
      <select id="post-hood" data-bind="post.neighborhood">
        ${NEIGHBORHOOD_NAMES.map((n) => html`<option value="${n}" ${n === hood ? "selected" : ""}>${n}</option>`)}
      </select>
      <p class="muted small">Only your neighborhood is shown. Your exact address is never posted.</p>

      <button type="submit" class="btn-primary big" ${ready ? "" : "disabled"}>${ui.busy ? "Posting…" : "Post"}</button>
    </form>`;
}

// ───────────────────────── My Swaps ─────────────────────────

function swapSummary(swap) {
  return html`${offerNeed("Offers", swap.offerText)}${offerNeed("Needs", swap.needText)}
    <p class="meta">${[swap.when, swap.neighborhood].filter(Boolean).join(" · ")}</p>`;
}

function rowHeader(name, swap) {
  return html`<div class="row between"><div class="row gap">${avatar(name, 36)}<h3 class="name">${name}</h3></div>${chip(swap.category)}</div>`;
}

function upcomingRow(s, ui, swap) {
  const otherUid = counterpartUid(swap, s.uid);
  const other = otherUid ? s.users[otherUid] : null;
  const name = other?.name || "Neighbor";
  const incoming = swap.status === STATUS.REQUESTED;
  return html`
    <li class="swap-row" data-swap="${swap.id}">
      ${rowHeader(name, swap)}
      ${swapSummary(swap)}
      ${incoming
        ? html`<p class="status warn">${name} requested this swap</p>
          <div class="row gap">
            <button type="button" class="btn-primary" data-action="accept" data-id="${swap.id}" ${ui.busy ? "disabled" : ""}>Accept</button>
            <button type="button" class="btn danger" data-action="decline" data-id="${swap.id}" ${ui.busy ? "disabled" : ""}>Decline</button>
          </div>`
        : html`<p class="status ok">✔ Confirmed</p>
          ${other ? contactBlock(other) : ""}
          <button type="button" class="btn" data-action="complete" data-id="${swap.id}" ${ui.busy ? "disabled" : ""}>Mark completed</button>`}
    </li>`;
}

function sentRow(s, swap) {
  const name = nameOf(s, swap.ownerUid);
  return html`
    <li class="swap-row" data-swap="${swap.id}">
      ${rowHeader(name, swap)}
      ${swapSummary(swap)}
      <p class="status warn">⏳ Pending</p>
    </li>`;
}

function pastRow(s, swap) {
  const otherUid = counterpartUid(swap, s.uid);
  const name = otherUid ? nameOf(s, otherUid) : "Neighbor";
  const rated = sel.hasRated(s, swap.id);
  return html`
    <li class="swap-row" data-swap="${swap.id}">
      ${rowHeader(name, swap)}
      ${swapSummary(swap)}
      ${rated
        ? html`<p class="status muted">★ Rated</p>`
        : html`<button type="button" class="btn-primary" data-action="open-rate" data-id="${swap.id}">☆ Rate</button>`}
    </li>`;
}

export function mySwapsScreen(s, ui) {
  const up = sel.upcoming(s);
  const sent = sel.requestsSent(s);
  const past = sel.past(s);
  return html`
    <header class="top"><h1>My Swaps</h1></header>
    <section aria-labelledby="sec-up">
      <h2 id="sec-up" class="section">Upcoming</h2>
      ${up.length ? html`<ul class="swap-list">${up.map((x) => upcomingRow(s, ui, x))}</ul>` : emptyNote("No upcoming swaps yet.")}
    </section>
    <section aria-labelledby="sec-sent">
      <h2 id="sec-sent" class="section">Requests sent</h2>
      ${sent.length ? html`<ul class="swap-list">${sent.map((x) => sentRow(s, x))}</ul>` : emptyNote("Swaps you request will show up here.")}
    </section>
    <section aria-labelledby="sec-past">
      <h2 id="sec-past" class="section">Past</h2>
      ${past.length ? html`<ul class="swap-list">${past.map((x) => pastRow(s, x))}</ul>` : emptyNote("Completed swaps appear here so you can rate them.")}
    </section>`;
}

export function rateSheet(s, ui) {
  const swap = ui.rate.swapId ? sel.swapById(s, ui.rate.swapId) : null;
  if (!swap) return "";
  const otherUid = counterpartUid(swap, s.uid);
  const name = otherUid ? nameOf(s, otherUid) : "your neighbor";
  return html`
    <div class="overlay" data-action="close-rate-backdrop">
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="rate-title">
        <form data-form="rate">
          <h2 id="rate-title">How was your swap with ${name}?</h2>
          <div class="star-picker" role="radiogroup" aria-label="Rating">
            ${[1, 2, 3, 4, 5].map(
              (n) => html`<button type="button" role="radio" aria-checked="${String(ui.rate.stars === n)}" aria-label="${n} star${n === 1 ? "" : "s"}"
                class="${n <= ui.rate.stars ? "on" : "off"}" data-action="set-stars" data-value="${n}">${n <= ui.rate.stars ? "★" : "☆"}</button>`
            )}
          </div>
          <label for="rate-note">Add a note (optional)</label>
          <textarea id="rate-note" data-bind="rate.note" rows="3" maxlength="300" placeholder="What went well?">${ui.rate.note}</textarea>
          <p class="muted small">Your rating updates their trust score across all categories.</p>
          <div class="row gap">
            <button type="button" class="btn" data-action="close-rate">Cancel</button>
            <button type="submit" class="btn-primary" ${ui.busy ? "disabled" : ""}>${ui.busy ? "Saving…" : "Submit"}</button>
          </div>
        </form>
      </div>
    </div>`;
}

// ───────────────────────── Profile ─────────────────────────

export function profileScreen(s) {
  const me = sel.currentUser(s);
  const name = me?.name || "Neighbor";
  const avg = me?.ratingAvg || 0;
  const count = me?.ratingCount || 0;
  const reviews = sel.reviewsFor(s, s.uid);
  const listings = sel.myOpenListings(s);
  return html`
    <header class="top row between"><h1>Profile</h1><button type="button" class="btn" data-action="sign-out">Sign out</button></header>
    ${demoBanner(s)}
    <section class="profile-head">
      ${avatar(name, 96)}
      <h2 class="name">${name}</h2>
      ${me?.neighborhood ? html`<p class="muted">📍 ${me.neighborhood}</p>` : ""}
      <div class="big-score" role="group" aria-label="${count > 0 ? `Trust score ${avg.toFixed(1)} stars, ${countText(count)}` : "Trust score: new neighbor, no swaps yet"}">
        <div class="big-avg"><span class="star" aria-hidden="true">★</span> <span aria-hidden="true">${avgText(avg, count)}</span></div>
        <div class="muted" aria-hidden="true">${countText(count)}</div>
      </div>
      ${me && isTrusted(avg, count) ? trustedBadge() : ""}
    </section>

    <section aria-labelledby="sec-reviews">
      <h2 id="sec-reviews" class="section">Reviews</h2>
      ${reviews.length
        ? html`<ul class="reviews">${reviews.map((r) => reviewRow(r, nameOf(s, r.raterUid)))}</ul>`
        : emptyNote("No reviews yet. Complete a swap to earn your first one.")}
    </section>

    <section aria-labelledby="sec-listings">
      <h2 id="sec-listings" class="section">My open listings</h2>
      ${listings.length
        ? html`<ul class="cards">${listings.map(
            (x) => html`<li><a class="card plain" href="#/swap/${x.id}">
              <div class="card-body">
                <div class="row between">${chip(x.category)}<span class="meta">${x.neighborhood}</span></div>
                ${offerNeed("Offers", x.offerText)}${offerNeed("Needs", x.needText)}
                <p class="meta">${x.when}</p>
              </div></a></li>`
          )}</ul>`
        : emptyNote("You have no open listings. Tap Post to add one.")}
    </section>`;
}

// ───────────────────────── Auth ─────────────────────────

export function authScreen(s, ui) {
  const signUp = ui.authMode === "signup";
  const a = ui.auth;
  return html`
    <div class="auth">
      <header class="auth-head">
        <div class="logo" aria-hidden="true">🏘️</div>
        <h1>Kin</h1>
        <p class="tagline">Your neighborhood is your kin</p>
      </header>
      ${demoBanner(s)}
      <div class="segmented" role="group" aria-label="Sign in or create account">
        <button type="button" aria-pressed="${String(!signUp)}" data-action="auth-mode" data-value="signin">Sign In</button>
        <button type="button" aria-pressed="${String(signUp)}" data-action="auth-mode" data-value="signup">Create Account</button>
      </div>
      <form data-form="auth" class="form" novalidate>
        ${signUp
          ? html`
            <label for="auth-name">Name</label>
            <input id="auth-name" data-bind="auth.name" value="${a.name}" maxlength="40" placeholder="e.g. Sarah M." autocomplete="name">
            <label for="auth-phone">Phone</label>
            <input id="auth-phone" data-bind="auth.phone" value="${a.phone}" maxlength="25" inputmode="tel" placeholder="617-555-0100" autocomplete="tel">
            <p class="muted small">Your phone number is only shown to a neighbor after you both confirm a swap.</p>
            <label for="auth-hood">Neighborhood</label>
            <select id="auth-hood" data-bind="auth.neighborhood">
              ${NEIGHBORHOOD_NAMES.map((n) => html`<option value="${n}" ${n === a.neighborhood ? "selected" : ""}>${n}</option>`)}
            </select>`
          : ""}
        <label for="auth-email">Email</label>
        <input id="auth-email" type="email" data-bind="auth.email" value="${a.email}" autocomplete="email" autocapitalize="none" spellcheck="false" inputmode="email">
        <label for="auth-pw">Password (6+ characters)</label>
        <input id="auth-pw" type="password" data-bind="auth.password" value="${a.password}" autocomplete="${signUp ? "new-password" : "current-password"}">
        ${ui.authError ? html`<p class="error" role="alert">${ui.authError}</p>` : ""}
        <button type="submit" class="btn-primary big" ${ui.busy ? "disabled" : ""}>${ui.busy ? "Please wait…" : signUp ? "Create Account" : "Sign In"}</button>
      </form>
    </div>`;
}

// ───────────────────────── Tab bar ─────────────────────────

export function tabBar(route) {
  const tabs = [
    ["home", "Home", "🏠"],
    ["post", "Post", "➕"],
    ["myswaps", "My Swaps", "🔁"],
    ["profile", "Profile", "👤"],
  ];
  const active = route.name === "swap" ? route.from || "home" : route.name;
  return html`<nav class="tabbar" aria-label="Main">
    ${tabs.map(
      ([key, label, icon]) => html`<a href="#/${key}" ${active === key ? html`aria-current="page"` : ""}><span aria-hidden="true">${icon}</span><span>${label}</span></a>`
    )}
  </nav>`;
}
