const ITERATIONS = 10000;
const COOKIE = "bb_portal";
const WEEK = 60 * 60 * 24 * 7;

const STATUS = {
  requested: "Requested",
  "in-review": "In review",
  scheduled: "Confirmed",
  denied: "Denied",
  "modified-for-approval": "A new time was offered",
  cancelled: "Cancelled",
  completed: "Completed",
  no_access: "We arrived and could not work",
};

const CLEANING = {
  recurring: "Recurring",
  deep: "Deep cleaning",
  move_in: "Move-in",
  move_out: "Move-out",
};

const PROPERTY = {
  house: "House",
  townhome: "Townhome",
  apartment: "Apartment",
  other: "Other",
};

const FREQUENCY = {
  weekly: "Weekly",
  every_two_weeks: "Every two weeks",
  monthly: "Monthly",
  one_time: "One time",
};

export function d1(database) {
  return {
    async one(sql, params = []) {
      return database.prepare(sql).bind(...params).first();
    },
    async all(sql, params = []) {
      const result = await database.prepare(sql).bind(...params).all();
      return result.results || [];
    },
    async run(sql, params = []) {
      await database.prepare(sql).bind(...params).run();
    },
  };
}

export function sqlite(database) {
  return {
    async one(sql, params = []) {
      return database.prepare(sql).get(...params) || null;
    },
    async all(sql, params = []) {
      return database.prepare(sql).all(...params);
    },
    async run(sql, params = []) {
      database.prepare(sql).run(...params);
    },
  };
}

function json(status, body, cookie) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  };
  if (cookie) headers["set-cookie"] = cookie;
  return new Response(JSON.stringify(body), { status, headers });
}

function clean(value, max) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function validEmail(email) {
  if (email.length < 6 || email.length > 120 || email.includes(" ")) return false;
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  return labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
}

function formatPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(national)) return "";
  return `${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`;
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return `pbkdf2$${ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(bits))}`;
}

async function passwordMatches(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  const salt = hexToBytes(parts[2]);
  if (!iterations || !salt) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits)) === parts[3];
}

function hexToBytes(hex) {
  if (!hex || hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function readCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  const match = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

function sessionCookie(token, request, clear = false) {
  const secure = new URL(request.url).protocol === "https:";
  const parts = [
    `${COOKIE}=${clear ? "" : token}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    clear ? "Max-Age=0" : `Max-Age=${WEEK}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function sessionFor(db, request) {
  const token = readCookie(request, COOKIE);
  if (!token) return null;
  const row = await db.one(
    "SELECT client_id, emp_id, expires_at FROM sessions WHERE token_hash = ?",
    [await sha256(token)],
  );
  if (!row || row.expires_at <= new Date().toISOString()) return null;
  return row;
}

async function startSession(db, request, who) {
  const token = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const now = new Date();
  const expires = new Date(now.getTime() + WEEK * 1000).toISOString();
  await db.run(
    `INSERT INTO sessions (id, client_id, emp_id, token_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      who.clientId || null,
      who.empId || null,
      await sha256(token),
      now.toISOString(),
      expires,
    ],
  );
  return sessionCookie(token, request);
}

function labelStatus(value) {
  return STATUS[value] || value || "";
}

function labelCleaning(value) {
  return CLEANING[value] || value || "";
}

const INCLUDED = {
  recurring: [
    "Kitchens and bathrooms cleaned and wiped down",
    "Floors vacuumed and washed",
    "Dusting of open surfaces",
    "Beds made, if you would like that",
    "Trash taken out",
  ],
  deep: [
    "Everything in a recurring clean",
    "Baseboards, doors, and switch plates",
    "Inside the microwave",
    "Detail work on fixtures and glass",
  ],
  move_in: [
    "Inside cabinets and drawers when they are empty",
    "Appliances wiped inside and out, as agreed",
    "Floors, bathrooms, and closets",
  ],
};

INCLUDED.move_out = INCLUDED.move_in;

const PREP = [
  "Pick up personal items, toys, and clothes from floors, counters, and furniture.",
  "Wash and put away dishes, or load the dishwasher, so we can clean the counters and sink.",
  "Clear small appliances, toiletries, and clutter from the counters where you can.",
  "Put away cash, jewelry, documents, and other valuables.",
  "Pets are welcome. Secure any pet that is anxious, overly excited, or uneasy with new people.",
  "Give us a way in. If we use a code, confirm that it works, and tell us about any special entry instructions.",
  "Have electricity, water, and heat or air conditioning on and working.",
  "Tell us before the appointment about any room or item you do not want cleaned.",
  "If you want a particular area emphasized, say so ahead of time so we can plan.",
];

const ADDON = {
  oven: "Inside the oven",
  refrigerator: "Inside the refrigerator",
  windows: "Interior windows, sills, tracks, and blinds",
  baseboards: "Baseboards",
  light_fixtures: "Light fixtures",
  dishes: "Dishes",
  cabinets: "Cabinets",
  declutter: "Declutter",
  pet_hair: "Pet hair",
  short_term_rental_reset: "Short-term rental reset",
};

const CANCELLATION = "24 hours’ notice or more: no extra fee. A cancellation with less than 24 hours’ notice is $40, unless it is an emergency.";

function labelAddon(row) {
  if (row.code === "other") return row.label || "Other";
  return ADDON[row.code] || row.label || row.code;
}

function durationText(minutes) {
  if (!minutes) return "Not estimated";
  const hours = Math.round((minutes / 60) * 10) / 10;
  const shown = Number.isInteger(hours) ? String(hours) : String(hours);
  return `${shown} ${shown === "1" ? "hour" : "hours"}`;
}

function moneyText(cents) {
  if (cents == null) return "Not quoted yet";
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

function rateCardNote(row) {
  if (row.cleaning_type === "deep") {
    return "The published card lists an initial deep clean at 3–8 hours and $280–$420, one time. That card is not this visit’s price.";
  }
  if (row.cleaning_type === "move_in" || row.cleaning_type === "move_out") {
    return "The published card lists move-in / move-out at 4–6 hours and $350–$550, one time. That card is not this visit’s price.";
  }
  const size = row.size_sqft;
  let band = "The published card prices bi-weekly visits by home size.";
  if (size && size < 1500) band = "The published card lists a home under 1,500 sq ft at 2 hours and $120 a visit, bi-weekly.";
  else if (size && size <= 2800) band = "The published card lists a home of 1,500–2,800 sq ft at 2.5–3 hours and $150 a visit, bi-weekly.";
  else if (size && size > 2800) band = "The published card lists a home of 2,800–4,500+ sq ft at 3.5–4 hours and $200 a visit, bi-weekly.";
  if (row.commercial) {
    return `${band} The commercial line on that card is a small office suite, 1,500–3,000 sq ft, at 2 hours a visit and $650–$850 a month. That card is not this visit’s price.`;
  }
  return `${band} That card is not this visit’s price.`;
}

function validDay(value) {
  const day = clean(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "";
  const [year, month, date] = day.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, date));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== date) return "";
  return day;
}

function hoursToMinutes(value) {
  const text = clean(value, 8);
  if (!text) return { minutes: null };
  if (!/^\d+(\.\d)?$/.test(text)) return { error: "Please check the duration." };
  const hours = Number(text);
  if (!(hours > 0) || hours > 16) return { error: "Please check the duration." };
  return { minutes: Math.round(hours * 60) };
}

function dollarsToCents(value) {
  const text = clean(value, 12);
  if (!text) return { cents: null };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { error: "Please check the price." };
  const cents = Math.round(Number(text) * 100);
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 1000000) return { error: "Please check the price." };
  return { cents };
}

async function registerCustomer(db, request) {
  const body = await readJson(request);
  if (!body) return json(400, { error: "Please check the form and try again." });
  if (clean(body.website, 80)) return json(200, { ok: true });
  const firstName = clean(body.firstName, 40);
  const lastName = clean(body.lastName, 40);
  const name = `${firstName} ${lastName}`.trim();
  const email = clean(body.email, 120).toLowerCase();
  const phone = formatPhone(body.phone);
  const password = String(body.password || "");
  const role = clean(body.role, 20);
  if (firstName.length < 1) return json(400, { error: "Please add your first name." });
  if (lastName.length < 1) return json(400, { error: "Please add your last name." });
  if (name.length > 80) return json(400, { error: "Please shorten your name." });
  if (!validEmail(email)) return json(400, { error: "Please add a valid email address." });
  if (!phone) return json(400, { error: "Please add a 10-digit phone number." });
  if (password.length < 8) return json(400, { error: "Please choose a password of at least 8 characters." });
  if (role !== "customer" && role !== "employee") {
    return json(400, { error: "Please choose Customer or Service Provider." });
  }
  const taken = await db.one(
    `SELECT email FROM clients WHERE email = ?
     UNION SELECT email FROM employees WHERE email = ?`,
    [email, email],
  );
  if (taken) return json(400, { error: "That email already has an account. Sign in instead." });
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);
  try {
    if (role === "employee") {
      const empId = crypto.randomUUID();
      await db.run(
        `INSERT INTO employees (emp_id, email, password_hash, name, phone, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [empId, email, passwordHash, name, phone, now, now],
      );
      return json(200, { ok: true, role, service_provider: true, signedIn: false }, sessionCookie("", request, true));
    }
    const clientId = crypto.randomUUID();
    await db.run(
      `INSERT INTO clients (client_id, email, password_hash, name, phone, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [clientId, email, passwordHash, name, phone, now, now],
    );
    await db.run(
      `INSERT INTO interaction_history
        (interaction_id, client_id, kind, summary, actor, created_at)
       VALUES (?, ?, 'note', 'Account created.', 'client', ?)`,
      [crypto.randomUUID(), clientId, now],
    );
    return json(200, { ok: true, role, service_provider: false, signedIn: false }, sessionCookie("", request, true));
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    if (message.includes("email already belongs") || message.includes("UNIQUE")) {
      return json(400, { error: "That email already has an account. Sign in instead." });
    }
    throw error;
  }
}

async function loginAccount(db, request) {
  const body = await readJson(request);
  if (!body) return json(400, { error: "Please check the form and try again." });
  const email = clean(body.email, 120).toLowerCase();
  const password = String(body.password || "");
  const employee = await db.one(
    "SELECT emp_id, password_hash FROM employees WHERE email = ?",
    [email],
  );
  if (employee && (await passwordMatches(password, employee.password_hash))) {
    const cookie = await startSession(db, request, { empId: employee.emp_id });
    return json(200, { ok: true, role: "employee", service_provider: true }, cookie);
  }
  const client = await db.one(
    "SELECT client_id, password_hash FROM clients WHERE email = ?",
    [email],
  );
  if (client && (await passwordMatches(password, client.password_hash))) {
    const cookie = await startSession(db, request, { clientId: client.client_id });
    return json(200, { ok: true, role: "customer", service_provider: false }, cookie);
  }
  return json(401, { error: "That email or password is not right." });
}

async function customerHome(db, request) {
  const session = await sessionFor(db, request);
  if (!session?.client_id) return json(401, { error: "Please sign in." });
  const client = await db.one(
    "SELECT name, email FROM clients WHERE client_id = ?",
    [session.client_id],
  );
  if (!client) return json(401, { error: "Please sign in." });
  await ensureReviewColumns(db);
  const schedule = await db.all(
    `SELECT b.booking_id, b.cleaning_type, b.address, b.zip, b.scheduled_on, b.scheduled_time,
            b.arrival_window, b.duration_minutes, b.amount_cents, e.name AS employee
     FROM bookings b
     LEFT JOIN employees e ON e.emp_id = b.assigned_emp_id
     WHERE b.client_id = ? AND b.request_status = 'scheduled'
     ORDER BY b.scheduled_on, b.scheduled_time`,
    [session.client_id],
  );
  const addonRows = await db.all(
    `SELECT booking_id, code, label FROM booking_addons
     WHERE booking_id IN (
       SELECT booking_id FROM bookings WHERE client_id = ? AND request_status = 'scheduled'
     )`,
    [session.client_id],
  );
  const requests = await db.all(
    `SELECT request_status, cleaning_type, desired_on, desired_time, offered_on, offered_time, scheduled_on, scheduled_time
     FROM bookings
     WHERE client_id = ?
     ORDER BY created_at DESC`,
    [session.client_id],
  );
  const history = await db.all(
    `SELECT summary, actor, request_status, created_at
     FROM interaction_history
     WHERE client_id = ?
     ORDER BY created_at DESC`,
    [session.client_id],
  );
  const awards = await db.all(
    `SELECT title, note, granted_on
     FROM awards
     WHERE client_id = ?
     ORDER BY granted_on DESC`,
    [session.client_id],
  );
  return json(200, {
    name: client.name,
    schedule: schedule.map((row) => ({
      cleaning: labelCleaning(row.cleaning_type),
      address: row.address,
      day: row.scheduled_on,
      time: row.scheduled_time,
    })),
    confirmations: schedule.map((row) => ({
      bookingNumber: row.booking_id,
      employee: row.employee || "",
      address: row.address,
      zip: row.zip,
      cleaning: labelCleaning(row.cleaning_type),
      day: row.scheduled_on,
      time: row.scheduled_time,
      arrival: row.arrival_window || "Arrival window is not set.",
      duration: durationText(row.duration_minutes),
      price: moneyText(row.amount_cents),
      included: INCLUDED[row.cleaning_type] || [],
      addons: addonRows.filter((addon) => addon.booking_id === row.booking_id).map(labelAddon),
      preparation: PREP,
      cancellation: CANCELLATION,
    })),
    requests: requests.map((row) => ({
      status: labelStatus(row.request_status),
      cleaning: labelCleaning(row.cleaning_type),
      desiredDay: row.desired_on,
      desiredTime: row.desired_time,
      offeredDay: row.offered_on,
      offeredTime: row.offered_time,
      scheduledDay: row.scheduled_on,
      scheduledTime: row.scheduled_time,
    })),
    history: history.map((row) => ({
      summary: row.summary,
      actor: row.actor === "employee" ? "Us" : "You",
      status: labelStatus(row.request_status),
      createdAt: row.created_at,
    })),
    awards: awards.map((row) => ({
      title: row.title,
      note: row.note,
      day: row.granted_on,
    })),
  });
}

async function employeeHome(db, request) {
  const session = await sessionFor(db, request);
  if (!session?.emp_id) return json(401, { error: "Please sign in." });
  const employee = await db.one(
    "SELECT name FROM employees WHERE emp_id = ?",
    [session.emp_id],
  );
  if (!employee) return json(401, { error: "Please sign in." });
  await ensureReviewColumns(db);
  const schedule = await db.all(
    `SELECT c.name, c.phone, b.address, b.zip, b.cleaning_type, b.scheduled_on, b.scheduled_time
     FROM bookings b
     JOIN clients c ON c.client_id = b.client_id
     WHERE b.assigned_emp_id = ? AND b.request_status = 'scheduled'
     ORDER BY b.scheduled_on, b.scheduled_time`,
    [session.emp_id],
  );
  const calendar = await db.all(
    `SELECT b.booking_id, b.assigned_emp_id, b.address, b.scheduled_on, b.scheduled_time, b.cleaning_type,
            c.name AS customer, e.name AS employee
     FROM bookings b
     JOIN clients c ON c.client_id = b.client_id
     LEFT JOIN employees e ON e.emp_id = b.assigned_emp_id
     WHERE b.request_status = 'scheduled'
     ORDER BY b.scheduled_on, b.scheduled_time`,
  );
  const open = await db.all(
    `SELECT b.booking_id, b.request_status, b.property_type, b.commercial, b.size_sqft, b.bedrooms, b.bathrooms,
            b.cleaning_type, b.frequency, b.address, b.zip, b.desired_on, b.desired_time, b.offered_on, b.offered_time,
            b.notes, b.duration_minutes, b.amount_cents, b.arrival_window,
            c.name AS customer, c.email, c.phone
     FROM bookings b
     JOIN clients c ON c.client_id = b.client_id
     WHERE b.request_status IN ('requested', 'in-review', 'modified-for-approval')
     ORDER BY b.desired_on, b.created_at`,
  );
  const addonRows = await db.all(
    `SELECT a.booking_id, a.code, a.label
     FROM booking_addons a
     JOIN bookings b ON b.booking_id = a.booking_id
     WHERE b.request_status IN ('requested', 'in-review', 'modified-for-approval')`,
  );
  const staff = await db.all("SELECT emp_id, name FROM employees ORDER BY name");
  const interactions = await db.all(
    `SELECT c.name, i.summary, i.request_status, i.created_at
     FROM interaction_history i
     JOIN clients c ON c.client_id = i.client_id
     WHERE i.emp_id = ?
     ORDER BY i.created_at DESC`,
    [session.emp_id],
  );
  return json(200, {
    name: employee.name,
    selfId: session.emp_id,
    staff: staff.map((row) => ({ id: row.emp_id, name: row.name })),
    calendar: calendar.map((row) => ({
      id: row.booking_id,
      employeeId: row.assigned_emp_id,
      employee: row.employee || "Unassigned",
      customer: row.customer,
      address: row.address,
      day: row.scheduled_on,
      time: row.scheduled_time,
      cleaning: labelCleaning(row.cleaning_type),
    })),
    reviews: open.map((row) => ({
      id: row.booking_id,
      status: labelStatus(row.request_status),
      customer: row.customer,
      email: row.email,
      phone: row.phone,
      address: row.address,
      zip: row.zip,
      property: propertyLine(row),
      service: `${labelCleaning(row.cleaning_type)}. ${FREQUENCY[row.frequency] || row.frequency}.`,
      desiredDay: row.desired_on,
      desiredTime: row.desired_time,
      offeredDay: row.offered_on,
      offeredTime: row.offered_time,
      notes: row.notes || "",
      duration: durationText(row.duration_minutes),
      travel: "Travel time is not calculated.",
      price: moneyText(row.amount_cents),
      addons: addonRows.filter((addon) => addon.booking_id === row.booking_id).map(labelAddon),
      card: rateCardNote(row),
    })),
    schedule: schedule.map((row) => ({
      customer: row.name,
      phone: row.phone,
      address: row.address,
      zip: row.zip,
      cleaning: labelCleaning(row.cleaning_type),
      day: row.scheduled_on,
      time: row.scheduled_time,
    })),
    interactions: interactions.map((row) => ({
      customer: row.name,
      summary: row.summary,
      status: labelStatus(row.request_status),
      createdAt: row.created_at,
    })),
  });
}

function propertyLine(row) {
  const size = row.size_sqft ? `${row.size_sqft} sq ft` : "Size not given";
  const commercial = row.commercial ? "Commercial property" : "Not a commercial property";
  return `${PROPERTY[row.property_type] || row.property_type}. ${commercial}. ${size}. ${row.bedrooms} bedrooms. ${row.bathrooms} bathrooms.`;
}

let reviewColumnsReady = false;

async function ensureReviewColumns(db) {
  if (reviewColumnsReady) return;
  await addColumn(db, "bookings", "duration_minutes", "INTEGER");
  await addColumn(db, "bookings", "arrival_window", "TEXT");
  reviewColumnsReady = true;
}

const LOCATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS locations (
  location_id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients (client_id) ON DELETE RESTRICT,
  address TEXT NOT NULL,
  zip TEXT NOT NULL,
  property_type TEXT NOT NULL,
  commercial INTEGER NOT NULL DEFAULT 0,
  size_sqft INTEGER,
  bedrooms INTEGER NOT NULL,
  bathrooms REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (length(location_id) > 0),
  CHECK (property_type IN ('house', 'townhome', 'apartment', 'other')),
  CHECK (commercial IN (0, 1)),
  CHECK (size_sqft IS NULL OR size_sqft > 0),
  CHECK (bedrooms >= 0),
  CHECK (bathrooms > 0),
  CHECK (length(address) BETWEEN 1 AND 200),
  CHECK (length(zip) BETWEEN 5 AND 10)
)`;

let homeModelReady = false;

function placeFields(place, visit) {
  const fields = {
    id: place.location_id,
    address: place.address,
    zip: place.zip,
    propertyType: PROPERTY[place.property_type] || "",
    bedrooms: String(place.bedrooms),
    bathrooms: String(place.bathrooms),
  };
  if (place.commercial) fields.commercial = "yes";
  if (place.size_sqft) fields.size = String(place.size_sqft);
  if (visit) {
    fields.cleaningType = labelCleaning(visit.cleaning_type);
    fields.frequency = FREQUENCY[visit.frequency] || "";
    if (visit.notes) fields.notes = visit.notes;
  }
  return fields;
}

async function findPlace(db, clientId, home) {
  return db.one(
    "SELECT location_id FROM locations WHERE client_id = ? AND zip = ? AND address = ? COLLATE NOCASE",
    [clientId, home.zip, home.address],
  );
}

async function writePlace(db, locationId, clientId, home, now) {
  await db.run(
    `UPDATE locations
     SET address = ?, zip = ?, property_type = ?, commercial = ?, size_sqft = ?, bedrooms = ?, bathrooms = ?, updated_at = ?
     WHERE location_id = ? AND client_id = ?`,
    [home.address, home.zip, home.propertyType, home.commercial ? 1 : 0, home.size, home.bedrooms, home.bathrooms, now, locationId, clientId],
  );
}

async function upsertLocation(db, clientId, home, locationId) {
  const now = new Date().toISOString();
  if (locationId) {
    const owned = await db.one(
      "SELECT location_id FROM locations WHERE location_id = ? AND client_id = ?",
      [locationId, clientId],
    );
    if (owned) {
      try {
        await writePlace(db, owned.location_id, clientId, home, now);
        return owned.location_id;
      } catch (error) {
        if (!/UNIQUE/i.test(String(error && error.message ? error.message : error))) throw error;
      }
    }
  }
  const existing = await findPlace(db, clientId, home);
  if (existing) {
    await writePlace(db, existing.location_id, clientId, home, now);
    return existing.location_id;
  }
  const id = crypto.randomUUID();
  try {
    await db.run(
      `INSERT INTO locations (
        location_id, client_id, address, zip, property_type, commercial, size_sqft,
        bedrooms, bathrooms, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, clientId, home.address, home.zip, home.propertyType, home.commercial ? 1 : 0, home.size, home.bedrooms, home.bathrooms, now, now],
    );
    return id;
  } catch (error) {
    if (!/UNIQUE/i.test(String(error && error.message ? error.message : error))) throw error;
    const again = await findPlace(db, clientId, home);
    if (!again) throw error;
    await writePlace(db, again.location_id, clientId, home, now);
    return again.location_id;
  }
}

async function addColumn(db, table, column, definition) {
  try {
    await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    if (!/duplicate column/i.test(message)) throw error;
  }
}

async function ensureHomeModel(db) {
  if (homeModelReady) return;
  await db.run(LOCATIONS_TABLE);
  await db.run("CREATE INDEX IF NOT EXISTS locations_client ON locations (client_id, updated_at)");
  await db.run("CREATE UNIQUE INDEX IF NOT EXISTS locations_place ON locations (client_id, zip, address COLLATE NOCASE)");
  try {
    await db.run("ALTER TABLE bookings ADD COLUMN location_id TEXT");
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    if (!/duplicate column/i.test(message)) throw error;
  }
  await db.run("CREATE INDEX IF NOT EXISTS bookings_location ON bookings (location_id)");
  await addColumn(db, "locations", "commercial", "INTEGER NOT NULL DEFAULT 0");
  await addColumn(db, "bookings", "commercial", "INTEGER NOT NULL DEFAULT 0");
  const pending = await db.all(
    `SELECT booking_id, client_id, property_type, size_sqft, bedrooms, bathrooms, address, zip
     FROM bookings WHERE location_id IS NULL ORDER BY created_at`,
  );
  for (const row of pending) {
    const locationId = await upsertLocation(db, row.client_id, {
      address: row.address,
      zip: row.zip,
      propertyType: row.property_type,
      size: row.size_sqft,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
    }, "");
    await db.run(
      "UPDATE bookings SET location_id = ? WHERE booking_id = ? AND location_id IS NULL",
      [locationId, row.booking_id],
    );
  }
  homeModelReady = true;
}

async function bookPrefill(db, request) {
  const session = await sessionFor(db, request);
  if (!session?.client_id) return json(200, { signedIn: Boolean(session?.emp_id), fields: {} });
  const client = await db.one(
    "SELECT name, email, phone FROM clients WHERE client_id = ?",
    [session.client_id],
  );
  if (!client) return json(200, { signedIn: false, fields: {} });
  await ensureHomeModel(db);
  const places = await db.all(
    `SELECT location_id, property_type, commercial, size_sqft, bedrooms, bathrooms, address, zip
     FROM locations WHERE client_id = ? ORDER BY updated_at DESC`,
    [session.client_id],
  );
  const visits = await db.all(
    `SELECT location_id, cleaning_type, frequency, notes
     FROM bookings WHERE client_id = ? AND location_id IS NOT NULL
     ORDER BY created_at DESC`,
    [session.client_id],
  );
  const visitByPlace = new Map();
  visits.forEach((visit) => {
    if (!visitByPlace.has(visit.location_id)) visitByPlace.set(visit.location_id, visit);
  });
  const locations = places.map((place) => placeFields(place, visitByPlace.get(place.location_id)));
  const fields = {
    name: client.name,
    email: client.email,
    phone: client.phone,
  };
  let source = "member";
  if (locations[0]) {
    const { id, ...home } = locations[0];
    Object.assign(fields, home);
    source = "location";
  }
  return json(200, { signedIn: true, source, fields, locations });
}

const INQUIRY_TABLE = `
CREATE TABLE IF NOT EXISTS inquiries (
  inquiry_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  client_id TEXT REFERENCES clients (client_id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  summary TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(inquiry_id) > 0),
  CHECK (kind IN ('book', 'contact')),
  CHECK (length(name) BETWEEN 1 AND 80),
  CHECK (email IS NULL OR (length(email) BETWEEN 3 AND 120 AND instr(email, '@') > 1)),
  CHECK (phone IS NULL OR length(phone) BETWEEN 7 AND 30),
  CHECK (length(summary) BETWEEN 1 AND 500),
  CHECK (length(payload) > 1)
)`;

const PROPERTY_CODE = {
  House: "house",
  house: "house",
  Townhome: "townhome",
  townhome: "townhome",
  Apartment: "apartment",
  apartment: "apartment",
  Other: "other",
  other: "other",
};

const CLEANING_CODE = {
  Recurring: "recurring",
  recurring: "recurring",
  "Deep cleaning": "deep",
  deep: "deep",
  "Move-in": "move_in",
  "Move-out": "move_out",
  move_in: "move_in",
  move_out: "move_out",
};

const FREQUENCY_CODE = {
  Weekly: "weekly",
  weekly: "weekly",
  "Every two weeks": "every_two_weeks",
  every_two_weeks: "every_two_weeks",
  Monthly: "monthly",
  monthly: "monthly",
  "One time": "one_time",
  one_time: "one_time",
};

function isoDate(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const [year, month, date] = text.split("-").map(Number);
  const stamp = new Date(year, month - 1, date);
  if (stamp.getFullYear() !== year || stamp.getMonth() !== month - 1 || stamp.getDate() !== date) return "";
  return text;
}

function wholeNumber(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  return Number(text);
}

function bathroomCount(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const count = Number(text);
  if (!(count > 0)) return null;
  return count;
}

function commercialFlag(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return text === "yes" || text === "1" || text === "true" ? 1 : 0;
}

function bookFields(body) {
  const address = clean(body.address, 200);
  const zip = clean(body.zip, 10);
  const propertyType = PROPERTY_CODE[clean(body.propertyType, 40)];
  const cleaningType = CLEANING_CODE[clean(body.cleaningType, 40)];
  const frequency = FREQUENCY_CODE[clean(body.frequency, 40)];
  const desiredOn = isoDate(body.date);
  const bedrooms = wholeNumber(body.bedrooms);
  const bathrooms = bathroomCount(body.bathrooms);
  const notes = clean(body.notes, 800);
  let size = null;
  if (String(body.size ?? "").trim()) {
    size = wholeNumber(body.size);
    if (!size) return { error: "Please check the home size." };
  }
  if (address.length < 1) return { error: "Please add the street address." };
  if (zip.length < 5) return { error: "Please add the ZIP code." };
  if (!propertyType) return { error: "Please choose a property type." };
  if (bedrooms == null) return { error: "Please add the number of bedrooms." };
  if (bathrooms == null) return { error: "Please add the number of bathrooms." };
  if (!cleaningType) return { error: "Please choose a cleaning type." };
  if (!frequency) return { error: "Please choose how often." };
  if (!desiredOn) return { error: "Please choose a date." };
  return {
    address,
    zip,
    propertyType,
    cleaningType,
    frequency,
    desiredOn,
    bedrooms,
    bathrooms,
    size,
    notes: notes || null,
    commercial: commercialFlag(body.commercial),
  };
}

async function clientIdFor(db, request) {
  const session = await sessionFor(db, request);
  if (!session?.client_id) return null;
  const client = await db.one("SELECT client_id FROM clients WHERE client_id = ?", [session.client_id]);
  return client?.client_id || null;
}

async function ensureInquiries(db) {
  await db.run(INQUIRY_TABLE);
  await db.run("CREATE INDEX IF NOT EXISTS inquiries_created ON inquiries (created_at DESC)");
}

async function saveInquiry(db, row) {
  await ensureInquiries(db);
  await db.run(
    `INSERT INTO inquiries (inquiry_id, kind, client_id, name, email, phone, summary, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      row.kind,
      row.clientId,
      row.name,
      row.email || null,
      row.phone || null,
      row.summary.slice(0, 500),
      JSON.stringify(row.payload),
      new Date().toISOString(),
    ],
  );
}

export async function routeInquiry(db, request, notify) {
  if (request.method !== "POST") return json(405, { error: "Please use the form." });
  const body = await readJson(request);
  if (!body) return json(400, { error: "Please check the form and try again." });
  if (clean(body.website, 80)) return json(200, { ok: true });
  const kind = clean(body.kind, 20);
  if (kind !== "book" && kind !== "contact") return json(400, { error: "Please use the form." });
  const name = clean(body.name, 80);
  const email = clean(body.email, 120).toLowerCase();
  const phone = formatPhone(body.phone);
  if (name.length < 1) return json(400, { error: "Please add your name." });
  if (email && !validEmail(email)) return json(400, { error: "Please add a valid email address." });
  if (!email && !phone) return json(400, { error: "Please add an email or a phone number." });
  const clientId = await clientIdFor(db, request);
  if (kind === "book" && clientId) {
    const home = bookFields(body);
    if (home.error) return json(400, { error: home.error });
    const now = new Date().toISOString();
    const bookingId = crypto.randomUUID();
    try {
      await ensureHomeModel(db);
      const locationId = await upsertLocation(db, clientId, home, clean(body.locationId, 80));
      await db.run(
        `INSERT INTO bookings (
          booking_id, client_id, location_id, request_status, property_type, commercial, size_sqft,
          bedrooms, bathrooms, cleaning_type, frequency, address, zip,
          desired_on, notes, created_at, updated_at
        ) VALUES (?, ?, ?, 'requested', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bookingId,
          clientId,
          locationId,
          home.propertyType,
          home.commercial,
          home.size,
          home.bedrooms,
          home.bathrooms,
          home.cleaningType,
          home.frequency,
          home.address,
          home.zip,
          home.desiredOn,
          home.notes,
          now,
          now,
        ],
      );
      await db.run(
        `INSERT INTO interaction_history
          (interaction_id, client_id, booking_id, kind, request_status, summary, actor, created_at)
         VALUES (?, ?, ?, 'status', 'requested', ?, 'client', ?)`,
        [crypto.randomUUID(), clientId, bookingId, `Requested a clean for ${home.address} on ${home.desiredOn}.${home.commercial ? " Commercial property." : ""}`, now],
      );
    } catch (error) {
      const message = String(error && error.message ? error.message : error);
      if (message.includes("CHECK") || message.includes("constraint")) {
        return json(400, { error: "Please check the form and try again." });
      }
      throw error;
    }
    return finishRequest(notify, "book", {
      name,
      email,
      phone,
      address: home.address,
      zip: home.zip,
      propertyType: PROPERTY[home.propertyType],
      size: home.size,
      bedrooms: home.bedrooms,
      bathrooms: home.bathrooms,
      commercial: home.commercial ? "Yes" : "No",
      cleaningType: CLEANING[home.cleaningType],
      frequency: FREQUENCY[home.frequency],
      desiredOn: home.desiredOn,
      notes: home.notes,
    }, "booking");
  }
  let summary = "";
  let payload = { name, email: email || null, phone };
  if (kind === "book") {
    const home = bookFields(body);
    if (home.error) return json(400, { error: home.error });
    summary = `Booking request for ${home.address}, ${home.zip}.`;
    payload = { ...payload, ...home };
  } else {
    const message = clean(body.message, 800);
    if (message.length < 1) return json(400, { error: "Please add a message." });
    const city = clean(body.city, 80);
    const interest = clean(body.interest, 40);
    const contactMethod = ["email", "phone", "text"].includes(clean(body.contactMethod, 20))
      ? clean(body.contactMethod, 20)
      : "email";
    summary = `Note from ${name}. ${message}`;
    payload = { ...payload, city, interest, contactMethod, message };
  }
  await saveInquiry(db, {
    kind,
    clientId,
    name,
    email: email || null,
    phone,
    summary,
    payload,
  });
  const letter = { name, email, phone, ...payload };
  if (letter.propertyType) letter.propertyType = PROPERTY[letter.propertyType] || letter.propertyType;
  if (letter.cleaningType) letter.cleaningType = CLEANING[letter.cleaningType] || letter.cleaningType;
  if (letter.frequency) letter.frequency = FREQUENCY[letter.frequency] || letter.frequency;
  if ("commercial" in letter) letter.commercial = letter.commercial ? "Yes" : "No";
  return finishRequest(notify, kind, letter, "inquiry");
}

const MAIL_FIELDS = [
  ["name", "Name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["address", "Address"],
  ["zip", "ZIP"],
  ["city", "City or ZIP"],
  ["propertyType", "Property"],
  ["commercial", "Commercial property"],
  ["size", "Size"],
  ["bedrooms", "Bedrooms"],
  ["bathrooms", "Bathrooms"],
  ["cleaningType", "Cleaning"],
  ["frequency", "Frequency"],
  ["desiredOn", "Desired date"],
  ["notes", "Notes"],
  ["interest", "Interest"],
  ["contactMethod", "Preferred contact"],
  ["message", "Message"],
];

function requestLetter(kind, fields) {
  const lines = [kind === "book" ? "Book a Clean" : "Contact", ""];
  MAIL_FIELDS.forEach(([key, label]) => {
    if (fields[key] == null || fields[key] === "") return;
    lines.push(`${label}: ${fields[key]}`);
  });
  return lines.join("\n");
}

async function finishRequest(notify, kind, fields, saved) {
  let mailed = false;
  let mailNote = "";
  if (typeof notify === "function") {
    const subject = kind === "book" ? `Book a Clean from ${fields.name}` : `Contact from ${fields.name}`;
    try {
      const result = await notify(subject, requestLetter(kind, fields));
      if (result && typeof result === "object") {
        mailed = Boolean(result.mailed);
        mailNote = String(result.note || "");
      } else {
        mailed = Boolean(result);
      }
    } catch {
      mailed = false;
      mailNote = "send failed";
    }
  }
  return json(200, { ok: true, saved, mailed, mailNote });
}

async function logout(db, request) {
  const token = readCookie(request, COOKIE);
  if (token) {
    await db.run("DELETE FROM sessions WHERE token_hash = ?", [await sha256(token)]);
  }
  return json(200, { ok: true }, sessionCookie("", request, true));
}

const OPEN_REVIEW = ["requested", "in-review", "modified-for-approval"];

function confirmationLetter(fields) {
  const lines = [
    "Your visit is confirmed.",
    "",
    `Booking number: ${fields.bookingNumber}`,
    `Assigned to: ${fields.employee || "Not assigned"}`,
    `Address: ${fields.address}`,
    `ZIP: ${fields.zip}`,
    `Service: ${fields.cleaning}`,
    `Date: ${fields.day}`,
  ];
  if (fields.time) lines.push(`Start time: ${fields.time}`);
  lines.push(
    `Arrival window: ${fields.arrival}`,
    `Expected duration: ${fields.duration}`,
    `Price: ${fields.price}`,
    "",
    "Included:",
  );
  (fields.included.length ? fields.included : ["Included services are on the Services page."]).forEach((item) => {
    lines.push(`- ${item}`);
  });
  lines.push("", "Add-ons:");
  (fields.addons.length ? fields.addons : ["No add-ons on this request."]).forEach((item) => {
    lines.push(`- ${item}`);
  });
  lines.push("", "Before we arrive:");
  fields.preparation.forEach((item) => lines.push(`- ${item}`));
  lines.push("", fields.cancellation);
  return lines.join("\n");
}

async function recordDecision(db, session, booking, status, summary, kind) {
  const now = new Date().toISOString();
  const text = clean(summary, 500);
  await db.run(
    `INSERT INTO interaction_history
      (interaction_id, client_id, emp_id, booking_id, kind, request_status, summary, actor, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'employee', ?)`,
    [crypto.randomUUID(), booking.client_id, session.emp_id, booking.booking_id, kind, status, text, now],
  );
}

async function reviewBooking(db, request, sendTo) {
  const session = await sessionFor(db, request);
  if (!session?.emp_id) return json(401, { error: "Please sign in." });
  const body = await readJson(request);
  if (!body) return json(400, { error: "Please check the form and try again." });
  const decision = clean(body.decision, 20);
  if (!["confirm", "offer", "ask", "decline"].includes(decision)) {
    return json(400, { error: "Please choose what to do with this request." });
  }
  await ensureReviewColumns(db);
  const booking = await db.one(
    `SELECT booking_id, client_id, request_status, address, zip, desired_on, cleaning_type
     FROM bookings WHERE booking_id = ?`,
    [clean(body.bookingId, 80)],
  );
  if (!booking) return json(404, { error: "That request is not here." });
  if (!OPEN_REVIEW.includes(booking.request_status)) {
    return json(400, { error: "That request is already decided." });
  }
  const note = clean(body.note, 400);
  const day = validDay(body.day);
  const timeText = clean(body.time, 5);
  let time = null;
  if (timeText) {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(timeText)) return json(400, { error: "Please check the time." });
    time = timeText;
  }
  const now = new Date().toISOString();
  if (decision === "confirm") {
    const assignee = await db.one("SELECT emp_id, name FROM employees WHERE emp_id = ?", [clean(body.empId, 80)]);
    if (!assignee) return json(400, { error: "Please choose who is going." });
    if (!day) return json(400, { error: "Please choose the date." });
    const duration = hoursToMinutes(body.duration);
    if (duration.error) return json(400, { error: duration.error });
    const price = dollarsToCents(body.price);
    if (price.error) return json(400, { error: price.error });
    const arrival = clean(body.arrival, 80);
    await db.run(
      `UPDATE bookings
       SET request_status = 'scheduled', assigned_emp_id = ?, scheduled_on = ?, scheduled_time = ?,
           duration_minutes = ?, arrival_window = ?, amount_cents = ?, updated_at = ?
       WHERE booking_id = ? AND request_status IN ('requested', 'in-review', 'modified-for-approval')`,
      [assignee.emp_id, day, time, duration.minutes, arrival || null, price.cents, now, booking.booking_id],
    );
    const saved = await db.one(
      "SELECT request_status FROM bookings WHERE booking_id = ?",
      [booking.booking_id],
    );
    if (saved?.request_status !== "scheduled") {
      return json(400, { error: "That request is already decided." });
    }
    await recordDecision(
      db,
      session,
      booking,
      "scheduled",
      `Confirmed the visit for ${booking.address} on ${day}. ${assignee.name} is assigned.`,
      "status",
    );
    const customer = await db.one("SELECT email FROM clients WHERE client_id = ?", [booking.client_id]);
    const addonRows = await db.all(
      "SELECT code, label FROM booking_addons WHERE booking_id = ?",
      [booking.booking_id],
    );
    const letter = confirmationLetter({
      bookingNumber: booking.booking_id,
      employee: assignee.name,
      address: booking.address,
      zip: booking.zip,
      cleaning: labelCleaning(booking.cleaning_type),
      day,
      time,
      arrival: arrival || "Arrival window is not set.",
      duration: durationText(duration.minutes),
      price: moneyText(price.cents),
      included: INCLUDED[booking.cleaning_type] || [],
      addons: addonRows.map(labelAddon),
      preparation: PREP,
      cancellation: CANCELLATION,
    });
    let mailed = false;
    let mailNote = "missing-address";
    if (customer?.email && validEmail(customer.email) && typeof sendTo === "function") {
      try {
        const result = await sendTo(customer.email, "Your visit is confirmed", letter);
        mailed = Boolean(result?.mailed);
        mailNote = String(result?.note || "");
      } catch {
        mailed = false;
        mailNote = "send failed";
      }
    }
    return json(200, { ok: true, mailed, mailNote });
  }
  if (decision === "offer") {
    if (!day) return json(400, { error: "Please choose the date to offer." });
    await db.run(
      `UPDATE bookings
       SET request_status = 'modified-for-approval', offered_on = ?, offered_time = ?, updated_at = ?
       WHERE booking_id = ? AND request_status IN ('requested', 'in-review', 'modified-for-approval')`,
      [day, time, now, booking.booking_id],
    );
    const extra = note ? ` ${note}` : "";
    await recordDecision(
      db,
      session,
      booking,
      "modified-for-approval",
      `Offered ${day} instead of ${booking.desired_on}.${extra}`,
      "status",
    );
    return json(200, { ok: true });
  }
  if (decision === "ask") {
    if (note.length < 1) return json(400, { error: "Please add what you need to know." });
    await db.run(
      `UPDATE bookings SET request_status = 'in-review', updated_at = ?
       WHERE booking_id = ? AND request_status IN ('requested', 'in-review', 'modified-for-approval')`,
      [now, booking.booking_id],
    );
    await recordDecision(db, session, booking, "in-review", `Asked for more information. ${note}`, "note");
    return json(200, { ok: true });
  }
  await db.run(
    `UPDATE bookings SET request_status = 'denied', updated_at = ?
     WHERE booking_id = ? AND request_status IN ('requested', 'in-review', 'modified-for-approval')`,
    [now, booking.booking_id],
  );
  await recordDecision(
    db,
    session,
    booking,
    "denied",
    note ? `Declined the request. ${note}` : "Declined the request.",
    "status",
  );
  return json(200, { ok: true });
}

export async function routePortal(db, request, sendTo) {
  const path = new URL(request.url).pathname;
  if (path === "/api/portal/customer/register" && request.method === "POST") return registerCustomer(db, request);
  if (path === "/api/portal/customer/login" && request.method === "POST") return loginAccount(db, request);
  if (path === "/api/portal/customer" && request.method === "GET") return customerHome(db, request);
  if (path === "/api/portal/employee/login" && request.method === "POST") return loginAccount(db, request);
  if (path === "/api/portal/employee" && request.method === "GET") return employeeHome(db, request);
  if (path === "/api/portal/employee/review" && request.method === "POST") return reviewBooking(db, request, sendTo);
  if (path === "/api/portal/book" && request.method === "GET") return bookPrefill(db, request);
  if (path === "/api/portal/logout" && request.method === "POST") return logout(db, request);
  return null;
}
