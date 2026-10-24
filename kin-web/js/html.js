// Tiny HTML templating helper that escapes every interpolated value by default,
// so text typed by neighbors can never inject markup.

class Safe {
  constructor(text) {
    this.text = text;
  }
  toString() {
    return this.text;
  }
}

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

function part(value) {
  if (value instanceof Safe) return value.text;
  if (Array.isArray(value)) return value.map(part).join("");
  if (value === false || value === null || value === undefined) return "";
  return esc(value);
}

/** Tagged template: values are escaped unless they came from another html`` call. */
export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((value, i) => {
    out += part(value) + strings[i + 1];
  });
  return new Safe(out);
}

export const toText = (safe) => String(safe);
