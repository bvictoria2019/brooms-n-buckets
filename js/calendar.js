// FullCalendar 6.1.21, MIT. https://fullcalendar.io/license
const host = document.querySelector("[data-calendar]");

function showWhen(day, time) {
  if (!day) return "";
  const [year, month, date] = day.split("-").map(Number);
  const written = new Date(year, month - 1, date).toLocaleDateString("en-US", {
    weekday: "long",
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

function pad(mins) {
  const hours = Math.min(24, Math.max(0, Math.floor(mins / 60)));
  return `${String(hours).padStart(2, "0")}:00:00`;
}

function addMinutes(day, time, minutes) {
  const [year, month, date] = day.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const stamp = new Date(year, month - 1, date, hour, minute + minutes);
  const nextDay = `${stamp.getFullYear()}-${String(stamp.getMonth() + 1).padStart(2, "0")}-${String(stamp.getDate()).padStart(2, "0")}`;
  const nextTime = `${String(stamp.getHours()).padStart(2, "0")}:${String(stamp.getMinutes()).padStart(2, "0")}:00`;
  return `${nextDay}T${nextTime}`;
}

function eventFrom(row) {
  const title = [row.customer, row.cleaning].filter(Boolean).join(" · ") || "Visit";
  const details = {
    customer: row.customer || "",
    phone: row.phone || "",
    address: [row.address, row.zip].filter(Boolean).join(", "),
    cleaning: row.cleaning || "",
    day: row.day || "",
    time: row.time || "",
  };
  if (!row.day) return null;
  if (!row.time) return { title, start: row.day, allDay: true, extendedProps: details };
  return {
    title,
    start: `${row.day}T${row.time}:00`,
    end: addMinutes(row.day, row.time, 60),
    extendedProps: details,
  };
}

function windowFor(events) {
  let min = 7 * 60;
  let max = 19 * 60;
  events.forEach((event) => {
    if (event.allDay) return;
    const startMins = event.start.slice(11, 13) * 60 + Number(event.start.slice(14, 16));
    const sameDay = event.end.slice(0, 10) === event.start.slice(0, 10);
    const endMins = sameDay
      ? event.end.slice(11, 13) * 60 + Number(event.end.slice(14, 16))
      : 24 * 60;
    if (startMins < min) min = Math.floor(startMins / 60) * 60;
    if (endMins > max) max = Math.ceil(endMins / 60) * 60;
  });
  return { slotMinTime: pad(min), slotMaxTime: pad(max) };
}

function showVisit(details) {
  const panel = document.querySelector("[data-visit]");
  if (!panel) return;
  panel.hidden = false;
  panel.querySelector("[data-visit-customer]").textContent = details.customer;
  panel.querySelector("[data-visit-when]").textContent = showWhen(details.day, details.time);
  panel.querySelector("[data-visit-where]").textContent = details.address;
  panel.querySelector("[data-visit-phone]").textContent = details.phone;
  panel.querySelector("[data-visit-cleaning]").textContent = details.cleaning;
}

function showBanner(message) {
  const banner = document.querySelector("[data-banner]");
  if (!banner) return;
  banner.hidden = false;
  banner.textContent = message;
  banner.classList.add("is-error");
}

function draw(schedule) {
  const events = (schedule || []).map(eventFrom).filter(Boolean);
  const empty = document.querySelector("[data-empty]");
  if (empty) empty.hidden = events.length > 0;
  const narrow = window.matchMedia("(max-width: 700px)").matches;
  const calendar = new FullCalendar.Calendar(document.getElementById("provider-calendar"), {
    initialView: narrow ? "timeGridDay" : "timeGridWeek",
    headerToolbar: {
      left: "prev,next",
      center: "title",
      right: "today timeGridDay,timeGridWeek",
    },
    buttonText: { today: "Today", day: "Day", week: "Week" },
    allDayText: "Anytime",
    ...windowFor(events),
    slotDuration: "00:30:00",
    slotLabelFormat: { hour: "numeric", minute: "2-digit", meridiem: "short" },
    height: "auto",
    nowIndicator: true,
    displayEventEnd: false,
    editable: false,
    events,
    eventClick(info) {
      info.jsEvent.preventDefault();
      showVisit(info.event.extendedProps);
    },
  });
  calendar.render();
}

async function openCalendar() {
  if (!window.FullCalendar) {
    showBanner("The calendar could not be opened.");
    return;
  }
  const response = await fetch("/api/portal/employee", { headers: { accept: "application/json" } });
  if (response.status === 401) {
    const customer = await fetch("/api/portal/customer", { headers: { accept: "application/json" } });
    window.location.assign(customer.ok ? "customer.html" : "employee.html");
    return;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    showBanner(data.error || "The calendar could not be opened.");
    return;
  }
  const hello = document.querySelector("[data-hello]");
  if (hello) hello.textContent = `Hello, ${data.name}.`;
  draw(data.schedule);
}

if (host) {
  const logout = document.querySelector("[data-logout]");
  if (logout) {
    logout.addEventListener("click", async () => {
      await fetch("/api/portal/logout", { method: "POST" });
      window.location.assign("employee.html");
    });
  }
  openCalendar().catch(() => showBanner("The calendar could not be opened."));
}
