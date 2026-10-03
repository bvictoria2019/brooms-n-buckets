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

function chosenRole(form) {
  const checked = form.querySelector('input[name="role"]:checked');
  return checked ? checked.value : "";
}

function pointMemberLink(form) {
  const link = form.querySelector("[data-member-link]");
  if (!link) return;
  link.href = chosenRole(form) === "employee" ? "employee.html" : "customer.html#login";
}

async function postForm(form) {
  const payload = {};
  Array.from(form.elements).forEach((el) => {
    if (!el.name || el.type === "submit") return;
    if (el.type === "checkbox") {
      if (el.checked) payload[el.name] = el.value;
      return;
    }
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

function addParagraph(parent, text) {
  if (!text) return;
  const p = document.createElement("p");
  p.textContent = text;
  parent.appendChild(p);
}

function addList(parent, title, rows, emptyText) {
  addParagraph(parent, title);
  const list = document.createElement("ul");
  list.className = "checklist";
  const items = rows && rows.length ? rows : [emptyText];
  items.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    list.appendChild(li);
  });
  parent.appendChild(list);
}

function renderConfirmations(root, rows) {
  root.replaceChildren();
  if (!rows || !rows.length) {
    addParagraph(root, "No confirmed visits yet.");
    return;
  }
  const list = document.createElement("div");
  list.className = "confirm-list";
  rows.forEach((row) => {
    const card = document.createElement("article");
    card.className = "confirm-card";
    const title = document.createElement("h3");
    title.textContent = row.cleaning || "Confirmed visit";
    card.appendChild(title);
    addParagraph(card, `Booking number ${row.bookingNumber}`);
    addParagraph(card, row.employee ? `Assigned to ${row.employee}` : "Assigned employee is not set.");
    addParagraph(card, [row.address, row.zip].filter(Boolean).join(", "));
    addParagraph(card, showDate(row.day, row.time));
    addParagraph(card, `Arrival window: ${row.arrival}`);
    addParagraph(card, `Expected duration: ${row.duration}`);
    addParagraph(card, `Price: ${row.price}`);
    addList(card, "Included", row.included, "Included services are on the Services page.");
    addList(card, "Add-ons", row.addons, "No add-ons on this request.");
    addList(card, "Before we arrive", row.preparation, "");
    addParagraph(card, row.cancellation);
    const policy = document.createElement("p");
    const link = document.createElement("a");
    link.href = "policies/preparation.html";
    link.textContent = "Client preparation";
    policy.appendChild(link);
    card.appendChild(policy);
    list.appendChild(card);
  });
  root.appendChild(list);
}

function dayNote(calendar, staff, day) {
  const visits = (calendar || []).filter((row) => row.day === day);
  const lines = visits.length
    ? visits.map((row) => `${row.employee} is already booked for ${row.customer} at ${row.address}${row.time ? ` at ${row.time}` : ""}.`)
    : ["No other visit is on the calendar that day."];
  const people = (staff || []).map((person) => {
    const busy = visits.some((row) => row.employeeId === person.id);
    return `${person.name}: ${busy ? "already booked that day" : "free that day"}.`;
  });
  return { lines, people };
}

function renderReviews(root, data) {
  root.replaceChildren();
  const rows = data.reviews || [];
  if (!rows.length) {
    addParagraph(root, "No requests waiting.");
    return;
  }
  const list = document.createElement("div");
  list.className = "review-list";
  rows.forEach((row) => {
    const card = document.createElement("article");
    card.className = "review-card";
    const title = document.createElement("h3");
    title.textContent = row.customer;
    card.appendChild(title);
    addParagraph(card, row.status);
    addParagraph(card, row.email);
    addParagraph(card, row.phone);
    addParagraph(card, [row.address, row.zip].filter(Boolean).join(", "));
    addParagraph(card, row.property);
    addParagraph(card, row.service);
    addParagraph(card, `Asked for ${showDate(row.desiredDay, row.desiredTime)}`);
    if (row.offeredDay) addParagraph(card, `Offered ${showDate(row.offeredDay, row.offeredTime)}`);
    addParagraph(card, `Estimated duration: ${row.duration}`);
    addParagraph(card, row.travel);
    addParagraph(card, `Price: ${row.price}`);
    addParagraph(card, row.notes ? `Notes: ${row.notes}` : "No notes.");
    addParagraph(card, row.addons.length ? `Add-ons: ${row.addons.join(", ")}` : "No add-ons on this request.");
    addParagraph(card, row.card);
    const same = document.createElement("div");
    same.dataset.sameDay = "true";
    card.appendChild(same);
    const form = document.createElement("form");
    form.className = "form";
    form.dataset.review = row.id;
    const assign = document.createElement("label");
    assign.append("Assign to ");
    const select = document.createElement("select");
    select.name = "empId";
    (data.staff || []).forEach((person) => {
      const option = document.createElement("option");
      option.value = person.id;
      option.textContent = person.name;
      if (person.id === data.selfId) option.selected = true;
      select.appendChild(option);
    });
    assign.appendChild(select);
    form.appendChild(assign);
    const dayLabel = document.createElement("label");
    dayLabel.append("Date ");
    const day = document.createElement("input");
    day.type = "date";
    day.name = "day";
    day.value = row.desiredDay || "";
    dayLabel.appendChild(day);
    form.appendChild(dayLabel);
    const timeLabel = document.createElement("label");
    timeLabel.append("Start time ");
    const time = document.createElement("input");
    time.type = "time";
    time.name = "time";
    timeLabel.appendChild(time);
    form.appendChild(timeLabel);
    const arrivalLabel = document.createElement("label");
    arrivalLabel.append("Arrival window ");
    const arrivalHint = document.createElement("span");
    arrivalHint.className = "hint";
    arrivalHint.textContent = "Such as 9:00 AM – 11:00 AM";
    arrivalLabel.appendChild(arrivalHint);
    const arrival = document.createElement("input");
    arrival.name = "arrival";
    arrival.maxLength = 80;
    arrivalLabel.appendChild(arrival);
    form.appendChild(arrivalLabel);
    const durationLabel = document.createElement("label");
    durationLabel.append("Estimated duration, in hours ");
    const duration = document.createElement("input");
    duration.name = "duration";
    duration.inputMode = "decimal";
    durationLabel.appendChild(duration);
    form.appendChild(durationLabel);
    const priceLabel = document.createElement("label");
    priceLabel.append("Price, in dollars ");
    const priceHint = document.createElement("span");
    priceHint.className = "hint";
    priceHint.textContent = "Leave this empty until you quote it.";
    priceLabel.appendChild(priceHint);
    const price = document.createElement("input");
    price.name = "price";
    price.inputMode = "decimal";
    priceLabel.appendChild(price);
    form.appendChild(priceLabel);
    const noteLabel = document.createElement("label");
    noteLabel.append("Note ");
    const noteBox = document.createElement("textarea");
    noteBox.name = "note";
    noteBox.rows = 3;
    noteLabel.appendChild(noteBox);
    form.appendChild(noteLabel);
    const actions = document.createElement("div");
    actions.className = "review-actions";
    [
      ["confirm", "Confirm", "btn btn-primary"],
      ["offer", "Offer this date", "btn btn-secondary"],
      ["ask", "Ask for more information", "btn btn-secondary"],
      ["decline", "Decline", "btn btn-secondary"],
    ].forEach(([decision, label, className]) => {
      const button = document.createElement("button");
      button.type = "submit";
      button.className = className;
      button.dataset.decision = decision;
      button.textContent = label;
      actions.appendChild(button);
    });
    form.appendChild(actions);
    const status = document.createElement("p");
    status.className = "note";
    status.hidden = true;
    form.appendChild(status);
    card.appendChild(form);
    const paintDay = () => {
      const facts = dayNote(data.calendar, data.staff, day.value);
      same.replaceChildren();
      facts.lines.forEach((line) => addParagraph(same, line));
      facts.people.forEach((line) => addParagraph(same, line));
    };
    day.addEventListener("change", paintDay);
    paintDay();
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const decision = event.submitter ? event.submitter.dataset.decision : "";
      status.hidden = true;
      try {
        const response = await fetch("/api/portal/employee/review", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            bookingId: row.id,
            decision,
            empId: select.value,
            day: day.value,
            time: time.value,
            arrival: arrival.value,
            duration: duration.value,
            price: price.value,
            note: noteBox.value,
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Something went wrong. Please call us.");
        if (decision === "confirm") {
          const reason = result.mailNote ? ` ${result.mailNote}` : "";
          sessionStorage.setItem(
            "bb-mail-note",
            result.mailed
              ? "The confirmation email went to the customer."
              : `The visit is confirmed. The email did not go out.${reason}`,
          );
        }
        await loadSession();
      } catch (error) {
        status.hidden = false;
        status.textContent = error.message;
        status.classList.add("is-error");
      }
    });
    list.appendChild(card);
  });
  root.appendChild(list);
}

function renderCustomer(data) {
  host.querySelector("[data-signed-out]").hidden = true;
  const signedIn = host.querySelector("[data-signed-in]");
  signedIn.hidden = false;
  signedIn.querySelector("[data-hello]").textContent = `Hello, ${data.name}.`;
  const confirmations = signedIn.querySelector("[data-confirmations]");
  if (confirmations) renderConfirmations(confirmations, data.confirmations);
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
  const mailNote = sessionStorage.getItem("bb-mail-note");
  if (mailNote) {
    sessionStorage.removeItem("bb-mail-note");
    const banner = host.querySelector("[data-banner]");
    if (banner) {
      banner.hidden = false;
      banner.textContent = mailNote;
      banner.classList.toggle("is-error", mailNote.includes("did not"));
    }
  }
  const reviews = signedIn.querySelector("[data-open-requests]");
  if (reviews) renderReviews(reviews, data);
  const calendar = signedIn.querySelector("[data-calendar]");
  if (calendar) {
    fillList(calendar, data.calendar || [], "Nothing is confirmed yet.", (row) => [
      row.employee,
      row.customer,
      showDate(row.day, row.time),
      row.address,
      row.cleaning,
    ]);
  }
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

function openPortal(data) {
  const provider = data.service_provider === true || data.role === "employee";
  if (provider && host.dataset.portal !== "employee") {
    window.location.assign("employee.html");
    return true;
  }
  if (!provider && host.dataset.portal === "employee" && data.role === "customer") {
    window.location.assign("customer.html");
    return true;
  }
  return false;
}

function showSignInNote() {
  const message = sessionStorage.getItem("bb-signin-note");
  if (!message) return;
  const signedOut = host.querySelector("[data-signed-out]");
  if (!signedOut || signedOut.hidden) return;
  const form = signedOut.querySelector("[data-pane='login']") || signedOut.querySelector("form");
  if (!form) return;
  sessionStorage.removeItem("bb-signin-note");
  note(form, message, false);
}

async function loadSession() {
  const response = await fetch(host.dataset.session, { headers: { accept: "application/json" } });
  if (response.status === 401) {
    const other = host.dataset.portal === "employee" ? "/api/portal/customer" : "/api/portal/employee";
    const alt = await fetch(other, { headers: { accept: "application/json" } });
    if (alt.ok) {
      window.location.assign(host.dataset.portal === "employee" ? "customer.html" : "employee.html");
      return;
    }
    showSignInNote();
    return;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The portal could not be opened.");
  if (host.dataset.portal === "employee") renderEmployee(data);
  else renderCustomer(data);
}

if (host) {
  function showAuthPane() {
    if (host.dataset.portal !== "customer") return;
    const signedOut = host.querySelector("[data-signed-out]");
    if (!signedOut || signedOut.hidden) return;
    const signup = location.hash === "#signup";
    const loginPane = signedOut.querySelector("[data-pane='login']");
    const signupPane = signedOut.querySelector("[data-pane='signup']");
    if (loginPane) loginPane.hidden = signup;
    if (signupPane) signupPane.hidden = !signup;
  }

  window.addEventListener("hashchange", showAuthPane);
  showAuthPane();
  host.querySelectorAll("form[data-portal-form]").forEach((form) => {
    const roles = form.querySelectorAll('input[name="role"]');
    roles.forEach((box) => {
      box.addEventListener("change", () => {
        if (box.checked) {
          roles.forEach((other) => {
            if (other !== box) other.checked = false;
          });
        }
        pointMemberLink(form);
      });
    });
    pointMemberLink(form);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const again = form.elements.namedItem("confirm");
      const password = form.elements.namedItem("password");
      if (again && password && again.value !== password.value) {
        note(form, "Those passwords do not match.", true);
        return;
      }
      if (roles.length && !chosenRole(form)) {
        note(form, "Please choose Customer or Service Provider.", true);
        return;
      }
      try {
        const data = await postForm(form);
        if (form.action.includes("/register")) {
          const provider = data.service_provider === true || data.role === "employee";
          sessionStorage.setItem("bb-signin-note", "Your account is ready. Please sign in.");
          if (provider) {
            window.location.assign("employee.html");
            return;
          }
          location.hash = "login";
          showAuthPane();
          showSignInNote();
          return;
        }
        if (openPortal(data)) return;
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
