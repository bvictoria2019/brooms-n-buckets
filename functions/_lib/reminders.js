import { CANCELLATION, validEmail } from "./portal.js";

const CHICAGO = "America/Chicago";

let reminderColumnReady = false;

export function chicagoDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CHICAGO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(isoDate, days) {
  const [year, month, day] = String(isoDate).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function longDate(isoDate) {
  const [year, month, day] = String(isoDate).split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function reminderSummary(row) {
  const arrival = row.arrival_window || "Arrival window is not set.";
  return `Reminder: ${row.address} on ${longDate(row.scheduled_on)}. Arrival window: ${arrival}. ${CANCELLATION}`.slice(0, 500);
}

function reminderLetter(row) {
  const lines = [
    "Your visit is in two days.",
    "",
    `Address: ${row.address}`,
    `ZIP: ${row.zip}`,
    `Date: ${longDate(row.scheduled_on)}`,
    `Arrival window: ${row.arrival_window || "Arrival window is not set."}`,
  ];
  if (row.scheduled_time) lines.push(`Start time: ${row.scheduled_time}`);
  if (row.employee) lines.push(`Assigned to: ${row.employee}`);
  lines.push("", CANCELLATION);
  return lines.join("\n");
}

async function ensureReminderColumn(db) {
  if (reminderColumnReady) return;
  try {
    await db.run("ALTER TABLE bookings ADD COLUMN reminder_sent_on TEXT");
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    if (!/duplicate column/i.test(message)) throw error;
  }
  reminderColumnReady = true;
}

export async function sendDueReminders(db, sendTo, now = new Date()) {
  await ensureReminderColumn(db);
  const today = chicagoDate(now);
  const day = addDays(today, 2);
  const visits = await db.all(
    `SELECT b.booking_id, b.client_id, b.assigned_emp_id, b.address, b.zip, b.scheduled_on,
            b.scheduled_time, b.arrival_window, b.reminder_sent_on, c.email, e.name AS employee
     FROM bookings b
     JOIN clients c ON c.client_id = b.client_id
     LEFT JOIN employees e ON e.emp_id = b.assigned_emp_id
     WHERE b.request_status = 'scheduled' AND b.scheduled_on = ? AND b.reminder_sent_on IS NULL`,
    [day],
  );
  const results = [];
  for (const row of visits) {
    const summary = reminderSummary(row);
    const posted = await db.one(
      `SELECT interaction_id FROM interaction_history
       WHERE booking_id = ? AND kind = 'note' AND summary LIKE 'Reminder:%'`,
      [row.booking_id],
    );
    if (!posted && row.assigned_emp_id) {
      await db.run(
        `INSERT INTO interaction_history
          (interaction_id, client_id, emp_id, booking_id, kind, request_status, summary, actor, created_at)
         VALUES (?, ?, ?, ?, 'note', NULL, ?, 'employee', ?)`,
        [crypto.randomUUID(), row.client_id, row.assigned_emp_id, row.booking_id, summary, now.toISOString()],
      );
    }
    let mailed = false;
    let note = "missing-address";
    const email = String(row.email || "").trim();
    if (validEmail(email) && typeof sendTo === "function") {
      try {
        const result = await sendTo(email, "Your visit is in two days", reminderLetter(row));
        mailed = Boolean(result?.mailed);
        note = String(result?.note || "");
      } catch {
        mailed = false;
        note = "send failed";
      }
    }
    if (mailed || !validEmail(email)) {
      await db.run(
        "UPDATE bookings SET reminder_sent_on = ?, updated_at = ? WHERE booking_id = ? AND reminder_sent_on IS NULL",
        [today, now.toISOString(), row.booking_id],
      );
    }
    results.push({
      bookingId: row.booking_id,
      posted: Boolean(posted || row.assigned_emp_id),
      mailed,
      note,
    });
  }
  return {
    ok: true,
    day,
    visits: results.length,
    posted: results.filter((row) => row.posted).length,
    mailed: results.filter((row) => row.mailed).length,
    results,
  };
}
