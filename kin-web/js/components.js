import { html } from "./html.js";
import {
  CATEGORY_ICON, avatarColor, initials, avgText, countText, dialable,
} from "./models.js";

export const avatar = (name, size = 48) => html`
  <span class="avatar" aria-hidden="true"
        style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px;background:${avatarColor(name)}">${initials(name)}</span>`;

export const chip = (category) => html`
  <span class="chip chip-${String(category).toLowerCase()}"><span aria-hidden="true">${CATEGORY_ICON[category] || ""}</span> ${category}</span>`;

/** "★ 4.9 · 23 swaps" shown on every card and profile. */
export const trustLine = (avg, count) => html`
  <span class="trust-line" aria-label="${count > 0 ? `Rated ${Number(avg).toFixed(1)} stars, ${countText(count)}` : "New neighbor, no ratings yet"}">
    <span aria-hidden="true" class="star">★</span>
    <strong aria-hidden="true">${avgText(avg, count)}</strong>
    <span aria-hidden="true">· ${countText(count)}</span>
  </span>`;

export const trustedBadge = () => html`<span class="badge-trusted">✔ Trusted neighbor</span>`;

export const stars = (n) => html`
  <span class="stars" role="img" aria-label="${n} out of 5 stars">${[1, 2, 3, 4, 5].map((i) => html`<span class="${i <= n ? "on" : "off"}">${i <= n ? "★" : "☆"}</span>`)}</span>`;

export const offerNeed = (kind, text) => html`<p class="line"><strong>${kind}:</strong> ${text}</p>`;

export const reviewRow = (rating, authorName) => html`
  <li class="review">
    <div class="row between"><strong>${authorName}</strong>${stars(rating.stars)}</div>
    ${rating.note ? html`<p class="muted">${rating.note}</p>` : ""}
  </li>`;

/** Phone number with Call and SMS buttons. Only ever rendered for a confirmed swap. */
export const contactBlock = (user) => {
  const num = dialable(user.phone);
  return html`
    <div class="contact">
      <p><strong>${user.name}</strong> · ${user.phone || "no number on file"}</p>
      ${num
        ? html`<div class="row gap">
            <a class="btn" href="tel:${num}">📞 Call</a>
            <a class="btn" href="sms:${num}">💬 SMS</a>
          </div>`
        : ""}
    </div>`;
};

export const emptyNote = (text) => html`<p class="muted empty">${text}</p>`;
