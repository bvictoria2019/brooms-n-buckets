const header = document.querySelector(".site-header");
const menuBtn = document.querySelector(".menu-btn");
const nav = document.querySelector(".site-nav");

if (header) {
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

if (menuBtn && nav) {
  menuBtn.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    menuBtn.textContent = open ? "Close" : "Menu";
  });
}

document.querySelectorAll("[data-year]").forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});

document.querySelectorAll("[data-atmosphere]").forEach((el) => {
  const src = el.getAttribute("data-atmosphere");
  if (!src) return;
  const probe = new Image();
  probe.onload = () => {
    el.classList.add("has-photo");
    el.style.backgroundImage = `linear-gradient(180deg, rgba(250,247,240,0.08), rgba(250,247,240,0.72)), url("${src}")`;
  };
  probe.src = src;
});

function fieldValue(form, name) {
  const el = form.elements.namedItem(name);
  if (!el) return "";
  return String(el.value || "").trim();
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Something went wrong. Please call us and we will take it from here.");
  }
  return data;
}

function showNote(form, message, isError) {
  const note = form.querySelector(".note");
  if (!note) return;
  note.hidden = false;
  note.replaceChildren(document.createTextNode(message));
  note.classList.toggle("is-error", Boolean(isError));
}

function requestLines(payload) {
  const labels = {
    name: "Name",
    email: "Email",
    phone: "Phone",
    address: "Service address",
    zip: "ZIP code",
    city: "City or ZIP",
    propertyType: "Property type",
    commercial: "Commercial property",
    size: "Approximate size",
    bedrooms: "Bedrooms",
    bathrooms: "Bathrooms",
    cleaningType: "Cleaning type",
    frequency: "Frequency",
    date: "Desired date",
    notes: "Notes",
    interest: "Interest",
    contactMethod: "Preferred contact",
    message: "Message",
  };
  const methods = { email: "Email", phone: "Phone", text: "Text" };
  const lines = [];
  Object.entries(labels).forEach(([key, label]) => {
    let value = payload[key];
    if (!value) return;
    if (key === "contactMethod") value = methods[value] || value;
    if (key === "commercial") value = String(value).toLowerCase() === "yes" ? "Yes" : "No";
    if (key === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-").map(Number);
      value = new Date(year, month - 1, day).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
    lines.push({ label, value });
  });
  return lines;
}

function appendRequestLines(parent, payload) {
  requestLines(payload).forEach(({ label, value }) => {
    const line = document.createElement("p");
    line.textContent = `${label}: ${value}`;
    parent.append(line);
  });
}

function showReceipt(form, payload) {
  const note = form.querySelector(".note");
  if (!note) return;
  note.hidden = false;
  note.classList.remove("is-error");
  note.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = payload.kind === "book"
    ? "We have your request. It is not on the calendar until we confirm the date."
    : "We have your note. We will answer at the phone or email you gave us.";
  note.append(title);
  appendRequestLines(note, payload);
  note.scrollIntoView({ block: "nearest" });
}

function formPayload(form) {
  const payload = { kind: form.getAttribute("data-form") };
  Array.from(form.elements).forEach((el) => {
    if (!el.name || el.type === "submit") return;
    if (el.type === "radio" && !el.checked) return;
    if (el.type === "checkbox") {
      payload[el.name] = el.checked ? "yes" : "no";
      return;
    }
    payload[el.name] = String(el.value || "").trim();
  });
  return payload;
}

function bindBookConfirm(form) {
  const panel = document.querySelector("[data-confirm]");
  if (!panel || panel.dataset.bound) return;
  panel.dataset.bound = "true";
  const lines = panel.querySelector("[data-confirm-lines]");
  const actions = panel.querySelector("[data-confirm-actions]");
  const heading = panel.querySelector("h2");
  const submit = panel.querySelector("[data-confirm-submit]");
  const cancel = panel.querySelector("[data-confirm-cancel]");
  let pending = null;

  cancel.addEventListener("click", () => {
    pending = null;
    panel.hidden = true;
    form.hidden = false;
    form.scrollIntoView({ block: "start" });
  });

  submit.addEventListener("click", async () => {
    if (!pending) return;
    const payload = pending;
    submit.disabled = true;
    const note = panel.querySelector("[data-confirm-note]");
    if (note) note.hidden = true;
    try {
      await postJson("/api/inquiry", payload);
      pending = null;
      heading.textContent = "We have your request. It is not on the calendar until we confirm the date.";
      actions.hidden = true;
      form.reset();
      form.hidden = true;
    } catch (error) {
      if (!note) return;
      note.hidden = false;
      note.textContent = error.message;
      note.classList.add("is-error");
    } finally {
      submit.disabled = false;
    }
  });

  form.openConfirm = (payload) => {
    pending = payload;
    heading.textContent = "Check this request.";
    actions.hidden = false;
    lines.replaceChildren();
    appendRequestLines(lines, payload);
    const note = panel.querySelector("[data-confirm-note]");
    if (note) {
      note.hidden = true;
      note.classList.remove("is-error");
    }
    form.hidden = true;
    panel.hidden = false;
    panel.scrollIntoView({ block: "start" });
  };
}

document.querySelectorAll("form[data-form]").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const kind = form.getAttribute("data-form");
    const note = form.querySelector(".note");
    if (note) note.hidden = true;
    if (!form.reportValidity()) return;

    const payload = formPayload(form);

    try {
      if (kind === "review") {
        await postJson("/api/reviews", payload);
        form.reset();
        showNote(form, "Thank you. Your note is on this page.");
        await loadReviews();
      } else if (kind === "book") {
        bindBookConfirm(form);
        form.openConfirm(payload);
      } else {
        await postJson("/api/inquiry", payload);
        form.reset();
        showReceipt(form, payload);
      }
    } catch (error) {
      showNote(form, error.message, true);
    }
  });
});

function reviewCard(review) {
  const article = document.createElement("article");
  article.className = "review";
  const headerEl = document.createElement("header");
  const who = document.createElement("strong");
  const place = review.neighborhood ? ` · ${review.neighborhood}` : "";
  who.textContent = `${review.firstName}${place}`;
  const when = document.createElement("span");
  when.className = "muted";
  const date = new Date(review.createdAt);
  when.textContent = Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  headerEl.append(who, when);
  article.append(headerEl);
  if (review.stars) {
    const stars = document.createElement("p");
    stars.className = "muted";
    stars.textContent = `${review.stars} of 5`;
    article.append(stars);
  }
  const body = document.createElement("p");
  body.textContent = review.body;
  article.append(body);
  return article;
}

async function loadReviews() {
  const list = document.querySelector("[data-reviews]");
  if (!list) return;
  list.replaceChildren();
  try {
    const response = await fetch("/api/reviews");
    const data = await response.json();
    const reviews = Array.isArray(data.reviews) ? data.reviews : [];
    if (!reviews.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No notes yet. When a neighbor shares one, it will appear here.";
      list.append(empty);
      return;
    }
    reviews.forEach((review) => list.append(reviewCard(review)));
  } catch {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Reviews cannot be loaded right now.";
    list.append(empty);
  }
}

const CONTACT_INTEREST = {
  Recurring: "Recurring cleaning",
  "Deep cleaning": "Deep cleaning",
  "Move-in": "Move-in / move-out",
  "Move-out": "Move-in / move-out",
};

function isYes(value) {
  return String(value ?? "").trim().toLowerCase() === "yes";
}

function writeFields(form, fields) {
  let filled = false;
  Object.entries(fields).forEach(([name, value]) => {
    const el = form.elements.namedItem(name);
    if (!el || value == null || value === "") return;
    if (el.type === "checkbox") {
      if (el.checked || !isYes(value)) return;
      el.checked = true;
      filled = true;
      return;
    }
    if (String(el.value || "").trim()) return;
    el.value = String(value);
    filled = true;
  });
  return filled;
}

const HOME_FIELDS = ["address", "zip", "propertyType", "commercial", "size", "bedrooms", "bathrooms", "cleaningType", "frequency", "notes"];

function applyHome(form, location) {
  HOME_FIELDS.forEach((name) => {
    const el = form.elements.namedItem(name);
    if (!el) return;
    if (el.type === "checkbox") {
      el.checked = isYes(location && location[name]);
      return;
    }
    const value = location && location[name] != null ? String(location[name]) : "";
    el.value = value;
  });
}

function bindLocations(form, locations) {
  const wrap = form.querySelector("[data-locations]");
  const select = form.querySelector("[data-location-select]");
  if (!wrap || !select || !locations || !locations.length) return;
  select.replaceChildren();
  locations.forEach((location) => {
    const option = document.createElement("option");
    option.value = location.id;
    option.textContent = [location.address, location.zip].filter(Boolean).join(", ");
    select.append(option);
  });
  const other = document.createElement("option");
  other.value = "";
  other.textContent = "A different location";
  select.append(other);
  const current = locations.find((location) => location.address === fieldValue(form, "address")) || locations[0];
  select.value = current.id;
  if (!select.dataset.bound) {
    select.dataset.bound = "true";
    select.addEventListener("change", () => {
      const chosen = locations.find((location) => location.id === select.value);
      applyHome(form, chosen || null);
    });
  }
  wrap.hidden = false;
}

function showPrefill(form, source, extra, count) {
  const line = form.querySelector("[data-prefill]");
  if (!line) return;
  line.hidden = false;
  let lead = "We filled this in from your account.";
  if (source === "location") {
    lead = count > 1
      ? "Choose a saved location, or add a different one."
      : "We filled this in from a location on your account.";
  } else if (source === "last-service") {
    lead = "We filled this in from your account and your last clean.";
  } else if (source === "last-request") {
    lead = "We filled this in from your account and your last request.";
  }
  line.textContent = source === "member" ? lead : `${lead}${extra}`;
}

function contactFields(fields) {
  const next = {
    name: fields.name,
    email: fields.email,
    phone: fields.phone,
    city: fields.zip,
    message: fields.notes,
  };
  if (fields.cleaningType && CONTACT_INTEREST[fields.cleaningType]) {
    next.interest = CONTACT_INTEREST[fields.cleaningType];
  }
  return next;
}

async function prefillKnown() {
  const book = document.querySelector("form[data-form='book']");
  const contact = document.querySelector("form[data-form='contact']");
  if (!book && !contact) return;
  try {
    const response = await fetch("/api/portal/book", { headers: { accept: "application/json" } });
    if (!response.ok) return;
    const data = await response.json();
    const fields = data.fields || {};
    const locations = data.locations || [];
    if (book && writeFields(book, fields)) showPrefill(book, data.source, " The date is still yours to choose.", locations.length);
    if (book) bindLocations(book, locations);
    if (contact && writeFields(contact, contactFields(fields))) showPrefill(contact, data.source, "", locations.length);
  } catch {
    /* The form still works when the person is not signed in. */
  }
}

loadReviews();
prefillKnown();
