import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { sqlite } from "./portal.js";
import { addDays, chicagoDate, sendDueReminders } from "./reminders.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function openDb() {
  const database = new DatabaseSync(":memory:");
  database.exec(fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8"));
  return sqlite(database);
}

const hash = "x".repeat(40);
const nowStamp = "2026-10-07T13:00:00.000Z";

async function addPerson(db, table, id, email, name) {
  await db.run(
    `INSERT INTO ${table} (${table === "clients" ? "client_id" : "emp_id"}, email, password_hash, name, phone, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, email, hash, name, "214-555-0199", nowStamp, nowStamp],
  );
}

async function addVisit(db, id, clientId, empId, day, status = "scheduled") {
  await db.run(
    `INSERT INTO bookings (
      booking_id, client_id, assigned_emp_id, request_status, property_type, commercial,
      bedrooms, bathrooms, cleaning_type, frequency, address, zip, desired_on, scheduled_on,
      scheduled_time, arrival_window, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'house', 0, 3, 2, 'recurring', 'monthly', '1500 Chester Drive', '75025', ?, ?, '13:09', '12:30 PM', ?, ?)`,
    [id, clientId, empId, status, day, status === "scheduled" ? day : null, nowStamp, nowStamp],
  );
}

test("two days ahead uses the Dallas date", () => {
  const morning = new Date("2026-10-07T13:00:00.000Z");
  assert.equal(chicagoDate(morning), "2026-10-07");
  assert.equal(addDays(chicagoDate(morning), 2), "2026-10-09");
  const lateNight = new Date("2026-10-07T04:30:00.000Z");
  assert.equal(chicagoDate(lateNight), "2026-10-06");
  assert.equal(addDays(chicagoDate(lateNight), 2), "2026-10-08");
});

test("a due visit is posted once and emailed once", async () => {
  const db = openDb();
  await addPerson(db, "clients", "client-1", "guest@example.com", "Guest One");
  await addPerson(db, "clients", "client-2", "a@b", "No Mail");
  await addPerson(db, "employees", "emp-1", "alice@example.com", "Alice Jones");
  await addVisit(db, "due", "client-1", "emp-1", "2026-10-09");
  await addVisit(db, "later", "client-1", "emp-1", "2026-10-10");
  await addVisit(db, "open", "client-1", "emp-1", "2026-10-09", "requested");
  await addVisit(db, "nomail", "client-2", "emp-1", "2026-10-09");
  const sent = [];
  const sendTo = async (to, subject, text) => {
    sent.push({ to, subject, text });
    return { mailed: true, note: "queued" };
  };
  const now = new Date(nowStamp);
  const first = await sendDueReminders(db, sendTo, now);
  assert.equal(first.day, "2026-10-09");
  assert.equal(first.mailed, 1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "guest@example.com");
  assert.equal(sent[0].subject, "Your visit is in two days");
  assert.match(sent[0].text, /1500 Chester Drive/);
  assert.match(sent[0].text, /October 9, 2026/);
  assert.match(sent[0].text, /12:30 PM/);
  assert.match(sent[0].text, /\$40/);
  const notes = await db.all(
    "SELECT summary, actor FROM interaction_history WHERE summary LIKE 'Reminder:%'",
  );
  assert.equal(notes.length, 2);
  assert.equal(notes[0].actor, "employee");
  const second = await sendDueReminders(db, sendTo, now);
  assert.equal(second.visits, 0);
  assert.equal(sent.length, 1);
  const notesAfter = await db.all("SELECT interaction_id FROM interaction_history WHERE summary LIKE 'Reminder:%'");
  assert.equal(notesAfter.length, 2);
});

test("a failed email can be tried again without a second portal note", async () => {
  const db = openDb();
  await addPerson(db, "clients", "client-3", "retry@example.com", "Retry Guest");
  await addPerson(db, "employees", "emp-3", "sam@example.com", "Sam Schedule");
  await addVisit(db, "retry-visit", "client-3", "emp-3", "2026-10-09");
  let calls = 0;
  const sendTo = async () => {
    calls += 1;
    if (calls === 1) return { mailed: false, note: "send failed" };
    return { mailed: true, note: "queued" };
  };
  const now = new Date(nowStamp);
  const first = await sendDueReminders(db, sendTo, now);
  assert.equal(first.mailed, 0);
  assert.equal(first.results[0].note, "send failed");
  const second = await sendDueReminders(db, sendTo, now);
  assert.equal(second.mailed, 1);
  assert.equal(calls, 2);
  const notes = await db.all("SELECT interaction_id FROM interaction_history WHERE booking_id = 'retry-visit'");
  assert.equal(notes.length, 1);
});
