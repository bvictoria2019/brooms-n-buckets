const ITERATIONS = 10000;
const COOKIE = "bb_portal";
const WEEK = 60 * 60 * 24 * 7;

const STATUS = {
  requested: "Requested",
  "in-review": "In review",
  scheduled: "Scheduled",
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
  const schedule = await db.all(
    `SELECT cleaning_type, address, scheduled_on, scheduled_time
     FROM bookings
     WHERE client_id = ? AND request_status = 'scheduled'
     ORDER BY scheduled_on, scheduled_time`,
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
  const schedule = await db.all(
    `SELECT c.name, c.phone, b.address, b.zip, b.cleaning_type, b.scheduled_on, b.scheduled_time
     FROM bookings b
     JOIN clients c ON c.client_id = b.client_id
     WHERE b.assigned_emp_id = ? AND b.request_status = 'scheduled'
     ORDER BY b.scheduled_on, b.scheduled_time`,
    [session.emp_id],
  );
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

async function bookPrefill(db, request) {
  const session = await sessionFor(db, request);
  if (!session?.client_id) return json(200, { signedIn: Boolean(session?.emp_id), fields: {} });
  const client = await db.one(
    "SELECT name, email, phone, address, zip FROM clients WHERE client_id = ?",
    [session.client_id],
  );
  if (!client) return json(200, { signedIn: false, fields: {} });
  const service = await db.one(
    `SELECT property_type, size_sqft, bedrooms, bathrooms, cleaning_type, frequency, address, zip, notes
     FROM service_history
     WHERE client_id = ? AND outcome = 'completed'
     ORDER BY rendered_on DESC, created_at DESC
     LIMIT 1`,
    [session.client_id],
  );
  const fields = {
    name: client.name,
    email: client.email,
    phone: client.phone,
  };
  if (client.address) fields.address = client.address;
  if (client.zip) fields.zip = client.zip;
  if (service) {
    fields.address = service.address;
    fields.zip = service.zip;
    fields.propertyType = PROPERTY[service.property_type] || "";
    if (service.size_sqft) fields.size = String(service.size_sqft);
    fields.bedrooms = String(service.bedrooms);
    fields.bathrooms = String(service.bathrooms);
    fields.cleaningType = labelCleaning(service.cleaning_type);
    fields.frequency = FREQUENCY[service.frequency] || "";
    if (service.notes) fields.notes = service.notes;
  }
  return json(200, { signedIn: true, source: service ? "last-service" : "member", fields });
}

async function logout(db, request) {
  const token = readCookie(request, COOKIE);
  if (token) {
    await db.run("DELETE FROM sessions WHERE token_hash = ?", [await sha256(token)]);
  }
  return json(200, { ok: true }, sessionCookie("", request, true));
}

export async function routePortal(db, request) {
  const path = new URL(request.url).pathname;
  if (path === "/api/portal/customer/register" && request.method === "POST") return registerCustomer(db, request);
  if (path === "/api/portal/customer/login" && request.method === "POST") return loginAccount(db, request);
  if (path === "/api/portal/customer" && request.method === "GET") return customerHome(db, request);
  if (path === "/api/portal/employee/login" && request.method === "POST") return loginAccount(db, request);
  if (path === "/api/portal/employee" && request.method === "GET") return employeeHome(db, request);
  if (path === "/api/portal/book" && request.method === "GET") return bookPrefill(db, request);
  if (path === "/api/portal/logout" && request.method === "POST") return logout(db, request);
  return null;
}
