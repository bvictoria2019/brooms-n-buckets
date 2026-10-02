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
  note.textContent = message;
  note.classList.toggle("is-error", Boolean(isError));
}

document.querySelectorAll("form[data-form]").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const kind = form.getAttribute("data-form");
    const note = form.querySelector(".note");
    if (note) note.hidden = true;
    if (!form.reportValidity()) return;

    const payload = { kind };
    Array.from(form.elements).forEach((el) => {
      if (!el.name || el.type === "submit") return;
      if (el.type === "radio" && !el.checked) return;
      payload[el.name] = String(el.value || "").trim();
    });

    try {
      if (kind === "review") {
        await postJson("/api/reviews", payload);
        form.reset();
        showNote(form, "Thank you. Your note is on this page.");
        await loadReviews();
      } else {
        await postJson("/api/inquiry", payload);
        form.reset();
        showNote(form, "We have your request. We will answer at the phone or email you gave us.");
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

loadReviews();
