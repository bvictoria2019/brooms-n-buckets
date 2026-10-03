const host = document.querySelector("[data-portal]");

function showDate(day, time) {
  if (!day) return "";
  const [year, month, date] = day.split("-").map(Number);
  const written = new Date(year, month - 1, date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  if (!time) return written;
  const [hour, minute] = time.split(":").map(Number);
  const clock = new Date(year, month - 1, date, hour, minute).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${written} at ${clock}`;
}

function showWhen(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || "";
  return parsed.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fillList(list, rows, emptyText, linesFor) {
  list.replaceChildren();
  if (!rows.length) {
    const item = document.createElement("li");
    item.textContent = emptyText;
    list.appendChild(item);
    return;
  }
  rows.forEach((row) => {
    const item = document.createElement("li");
    linesFor(row).filter(Boolean).forEach((line) => {
      const p = document.createElement("p");
      p.textContent = line;
      item.appendChild(p);
    });
    list.appendChild(item);
  });
}

function note(form, message, isError) {
  const el = form.querySelector(".note");
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
  el.classList.toggle("is-error", Boolean(isError));
}

async function postForm(form) {
  const payload = {};
  Array.from(form.elements).forEach((el) => {
    if (!el.name || el.type === "submit") return;
    payload[el.name] = String(el.value || "");
  });
  const response = await fetch(form.action, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please call us.");
  return data;
}

function renderCustomer(data) {
  host.querySelector("[data-signed-out]").hidden = true;
  const signedIn = host.querySelector("[data-signed-in]");
  signedIn.hidden = false;
  signedIn.querySelector("[data-hello]").textContent = `Hello, ${data.name}.`;
  fillList(signedIn.querySelector("[data-schedule]"), data.schedule, "No visits on the calendar yet.", (row) => [
    row.cleaning,
    showDate(row.day, row.time),
    row.address,
  ]);
  fillList(signedIn.querySelector("[data-requests]"), data.requests, "No requests yet.", (row) => [
    row.status,
    row.cleaning,
    row.desiredDay ? `You asked for ${showDate(row.desiredDay, row.desiredTime)}` : "",
    row.offeredDay ? `We offered ${showDate(row.offeredDay, row.offeredTime)}` : "",
    row.scheduledDay ? `On the calendar ${showDate(row.scheduledDay, row.scheduledTime)}` : "",
  ]);
  fillList(signedIn.querySelector("[data-history]"), data.history, "No notes yet.", (row) => [
    row.summary,
    [row.actor, row.status, showWhen(row.createdAt)].filter(Boolean).join(" · "),
  ]);
  fillList(signedIn.querySelector("[data-awards]"), data.awards, "No awards yet.", (row) => [
    row.title,
    showDate(row.day),
    row.note,
  ]);
}

function renderEmployee(data) {
  host.querySelector("[data-signed-out]").hidden = true;
  const signedIn = host.querySelector("[data-signed-in]");
  signedIn.hidden = false;
  signedIn.querySelector("[data-hello]").textContent = `Hello, ${data.name}.`;
  fillList(signedIn.querySelector("[data-schedule]"), data.schedule, "No customers on your schedule.", (row) => [
    row.customer,
    showDate(row.day, row.time),
    [row.address, row.zip].filter(Boolean).join(", "),
    row.phone,
    row.cleaning,
  ]);
  fillList(signedIn.querySelector("[data-history]"), data.interactions, "No customer notes yet.", (row) => [
    row.customer,
    row.summary,
    [row.status, showWhen(row.createdAt)].filter(Boolean).join(" · "),
  ]);
}

async function loadSession() {
  const response = await fetch(host.dataset.session, { headers: { accept: "application/json" } });
  if (response.status === 401) return;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The portal could not be opened.");
  if (host.dataset.portal === "employee") renderEmployee(data);
  else renderCustomer(data);
}

if (host) {
  host.querySelectorAll("form[data-portal-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const again = form.elements.namedItem("confirm");
      const password = form.elements.namedItem("password");
      if (again && password && again.value !== password.value) {
        note(form, "Those passwords do not match.", true);
        return;
      }
      try {
        await postForm(form);
        await loadSession();
      } catch (error) {
        note(form, error.message, true);
      }
    });
  });

  const logout = host.querySelector("[data-logout]");
  if (logout) {
    logout.addEventListener("click", async () => {
      await fetch("/api/portal/logout", { method: "POST" });
      window.location.reload();
    });
  }

  loadSession().catch((error) => {
    const banner = host.querySelector("[data-banner]");
    if (!banner) return;
    banner.hidden = false;
    banner.textContent = error.message;
    banner.classList.add("is-error");
  });
}
