-- Brooms & Buckets. Cloudflare D1 (SQLite).
--
-- clients is both the registration and the logon. client_id is the unique
-- client number. employees use the same logon. emp_id is the unique employee
-- number. In both cases the email is the username. One email belongs to one
-- side. password_hash and token_hash hold hashes, never the password or the
-- session token.
--
-- A booking starts as requested. request_status moves through review until
-- the visit is scheduled, or the request is changed or denied. assigned_emp_id
-- is the employee scheduled to see that customer. The client portal reads
-- that client's own rows. The employee portal reads visits assigned to that
-- emp_id, and interaction_history rows that name that emp_id.
-- service_history is written when that visit is rendered. service_id is unique
-- per rendered service. One booking produces at most one service row.
-- payment_history is the money for a client. A finished clean points at the
-- service. A last-minute fee can point at the booking alone.
-- An award is recorded when one is given. Nothing here grants one by itself.
--
-- A public review is first_name, neighborhood, stars, and body.
-- The email stays on the client and is not on the review.

PRAGMA foreign_keys = ON;

CREATE TABLE clients (
  client_id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  zip TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (length(client_id) > 0),
  CHECK (length(email) BETWEEN 3 AND 120 AND instr(email, '@') > 1),
  CHECK (length(password_hash) >= 40),
  CHECK (length(name) BETWEEN 1 AND 80),
  CHECK (length(phone) BETWEEN 7 AND 30)
);

CREATE UNIQUE INDEX clients_email ON clients (email);

CREATE TABLE employees (
  emp_id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (length(emp_id) > 0),
  CHECK (length(email) BETWEEN 3 AND 120 AND instr(email, '@') > 1),
  CHECK (length(password_hash) >= 40),
  CHECK (length(name) BETWEEN 1 AND 80),
  CHECK (phone IS NULL OR length(phone) BETWEEN 7 AND 30)
);

CREATE UNIQUE INDEX employees_email ON employees (email);

CREATE TRIGGER employees_email_is_free
BEFORE INSERT ON employees
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'email already belongs to a client')
  WHERE EXISTS (SELECT 1 FROM clients WHERE email = NEW.email);
END;

CREATE TRIGGER clients_email_is_free
BEFORE INSERT ON clients
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'email already belongs to an employee')
  WHERE EXISTS (SELECT 1 FROM employees WHERE email = NEW.email);
END;

CREATE TRIGGER employees_email_stays_free
BEFORE UPDATE OF email ON employees
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'email already belongs to a client')
  WHERE EXISTS (SELECT 1 FROM clients WHERE email = NEW.email);
END;

CREATE TRIGGER clients_email_stays_free
BEFORE UPDATE OF email ON clients
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'email already belongs to an employee')
  WHERE EXISTS (SELECT 1 FROM employees WHERE email = NEW.email);
END;

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients (client_id) ON DELETE CASCADE,
  emp_id TEXT REFERENCES employees (emp_id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  CHECK (length(token_hash) >= 40),
  CHECK (expires_at > created_at),
  CHECK (
    (client_id IS NOT NULL AND emp_id IS NULL)
    OR (client_id IS NULL AND emp_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX sessions_token ON sessions (token_hash);
CREATE INDEX sessions_client ON sessions (client_id);
CREATE INDEX sessions_employee ON sessions (emp_id);

CREATE TABLE bookings (
  booking_id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients (client_id) ON DELETE RESTRICT,
  assigned_emp_id TEXT REFERENCES employees (emp_id) ON DELETE RESTRICT,
  -- Shared by each visit in one recurring run. Empty for a single visit.
  series_id TEXT,
  request_status TEXT NOT NULL DEFAULT 'requested',
  property_type TEXT NOT NULL,
  size_sqft INTEGER,
  bedrooms INTEGER NOT NULL,
  bathrooms REAL NOT NULL,
  cleaning_type TEXT NOT NULL,
  frequency TEXT NOT NULL,
  address TEXT NOT NULL,
  zip TEXT NOT NULL,
  desired_on TEXT NOT NULL,
  desired_time TEXT,
  offered_on TEXT,
  offered_time TEXT,
  scheduled_on TEXT,
  scheduled_time TEXT,
  notes TEXT,
  -- Agreed visit price in cents. Empty until we quote it. Not taken from the rate card.
  amount_cents INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (request_status IN (
    'requested',
    'in-review',
    'scheduled',
    'denied',
    'modified-for-approval',
    'cancelled',
    'completed',
    'no_access'
  )),
  CHECK (property_type IN ('house', 'townhome', 'apartment', 'other')),
  CHECK (cleaning_type IN ('recurring', 'deep', 'move_in', 'move_out')),
  CHECK (frequency IN ('weekly', 'every_two_weeks', 'monthly', 'one_time')),
  CHECK (size_sqft IS NULL OR size_sqft > 0),
  CHECK (bedrooms >= 0),
  CHECK (bathrooms > 0),
  CHECK (length(address) BETWEEN 1 AND 200),
  CHECK (length(zip) BETWEEN 5 AND 10),
  CHECK (length(desired_on) = 10),
  CHECK (desired_time IS NULL OR (
    length(desired_time) = 5 AND substr(desired_time, 3, 1) = ':'
    AND substr(desired_time, 1, 2) BETWEEN '00' AND '23'
    AND substr(desired_time, 4, 2) BETWEEN '00' AND '59'
  )),
  CHECK (offered_on IS NULL OR length(offered_on) = 10),
  CHECK (offered_time IS NULL OR (
    length(offered_time) = 5 AND substr(offered_time, 3, 1) = ':'
    AND substr(offered_time, 1, 2) BETWEEN '00' AND '23'
    AND substr(offered_time, 4, 2) BETWEEN '00' AND '59'
  )),
  CHECK (scheduled_on IS NULL OR length(scheduled_on) = 10),
  CHECK (scheduled_time IS NULL OR (
    length(scheduled_time) = 5 AND substr(scheduled_time, 3, 1) = ':'
    AND substr(scheduled_time, 1, 2) BETWEEN '00' AND '23'
    AND substr(scheduled_time, 4, 2) BETWEEN '00' AND '59'
  )),
  CHECK (amount_cents IS NULL OR amount_cents >= 0),
  CHECK (request_status != 'modified-for-approval' OR offered_on IS NOT NULL),
  CHECK (request_status NOT IN ('scheduled', 'completed', 'no_access') OR scheduled_on IS NOT NULL)
);

CREATE INDEX bookings_client ON bookings (client_id, desired_on);
CREATE INDEX bookings_employee ON bookings (assigned_emp_id, scheduled_on);
CREATE INDEX bookings_status ON bookings (request_status, desired_on);
CREATE INDEX bookings_series ON bookings (series_id);

-- Add-ons are part of a visit, not a visit by themselves.
-- Quote amount_cents when the add-on is agreed. Leave it empty until then.
CREATE TABLE booking_addons (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings (booking_id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label TEXT,
  amount_cents INTEGER,
  created_at TEXT NOT NULL,
  CHECK (code IN (
    'oven',
    'refrigerator',
    'windows',
    'baseboards',
    'light_fixtures',
    'dishes',
    'cabinets',
    'declutter',
    'pet_hair',
    'short_term_rental_reset',
    'other'
  )),
  CHECK (code != 'other' OR (label IS NOT NULL AND length(label) > 0)),
  CHECK (amount_cents IS NULL OR amount_cents >= 0)
);

CREATE INDEX booking_addons_booking ON booking_addons (booking_id);

-- One row each time a service is rendered. service_id is unique.
-- outcome completed: the clean was finished.
-- outcome no_access: we arrived and could not work. The full service amount is still due.
-- A cancellation is not a row here.
CREATE TABLE service_history (
  service_id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients (client_id) ON DELETE RESTRICT,
  emp_id TEXT REFERENCES employees (emp_id) ON DELETE RESTRICT,
  booking_id TEXT NOT NULL UNIQUE REFERENCES bookings (booking_id) ON DELETE RESTRICT,
  rendered_on TEXT NOT NULL,
  outcome TEXT NOT NULL,
  property_type TEXT NOT NULL,
  size_sqft INTEGER,
  bedrooms INTEGER NOT NULL,
  bathrooms REAL NOT NULL,
  cleaning_type TEXT NOT NULL,
  frequency TEXT NOT NULL,
  address TEXT NOT NULL,
  zip TEXT NOT NULL,
  notes TEXT,
  amount_cents INTEGER,
  created_at TEXT NOT NULL,
  CHECK (length(service_id) > 0),
  CHECK (outcome IN ('completed', 'no_access')),
  CHECK (property_type IN ('house', 'townhome', 'apartment', 'other')),
  CHECK (cleaning_type IN ('recurring', 'deep', 'move_in', 'move_out')),
  CHECK (frequency IN ('weekly', 'every_two_weeks', 'monthly', 'one_time')),
  CHECK (length(rendered_on) = 10),
  CHECK (length(address) BETWEEN 1 AND 200),
  CHECK (length(zip) BETWEEN 5 AND 10),
  CHECK (amount_cents IS NULL OR amount_cents >= 0)
);

CREATE INDEX service_history_client ON service_history (client_id, rendered_on);
CREATE INDEX service_history_employee ON service_history (emp_id, rendered_on);

-- The booking must already be marked with the same outcome, for the same client.
CREATE TRIGGER service_matches_booking
BEFORE INSERT ON service_history
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'service does not match the booking')
  WHERE NEW.client_id != (SELECT client_id FROM bookings WHERE booking_id = NEW.booking_id)
     OR NEW.outcome != (SELECT request_status FROM bookings WHERE booking_id = NEW.booking_id);
END;

-- Money for a client.
-- service: due when the clean is finished.
-- late_fee: $25 after 24 hours unpaid. returned_fee: $25 for a returned or declined payment.
-- cancellation_fee: $40 when notice is under 24 hours and it is not an emergency.
-- A rendered clean sets service_id. A cancellation fee can set booking_id and leave service_id empty.
-- no_access uses kind 'service' for the full agreed amount. An emergency has no cancellation_fee row.
CREATE TABLE payment_history (
  payment_id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients (client_id) ON DELETE RESTRICT,
  service_id TEXT REFERENCES service_history (service_id) ON DELETE RESTRICT,
  booking_id TEXT REFERENCES bookings (booking_id) ON DELETE RESTRICT,
  kind TEXT NOT NULL,
  method TEXT,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'due',
  due_on TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(payment_id) > 0),
  CHECK (service_id IS NOT NULL OR booking_id IS NOT NULL),
  CHECK (kind IN ('service', 'late_fee', 'returned_fee', 'cancellation_fee')),
  CHECK (method IS NULL OR method IN ('zelle', 'venmo', 'cash', 'check')),
  CHECK (amount_cents > 0),
  CHECK (status IN ('due', 'paid', 'returned')),
  CHECK (status != 'paid' OR paid_at IS NOT NULL)
);

CREATE INDEX payment_history_client ON payment_history (client_id, created_at);
CREATE INDEX payment_history_service ON payment_history (service_id);
CREATE INDEX payment_history_booking ON payment_history (booking_id);
CREATE INDEX payment_history_open ON payment_history (client_id, status);

CREATE TRIGGER payment_matches_service
BEFORE INSERT ON payment_history
FOR EACH ROW
WHEN NEW.service_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'payment client does not match the service')
  WHERE NEW.client_id != (SELECT client_id FROM service_history WHERE service_id = NEW.service_id);
END;

CREATE TRIGGER payment_matches_booking
BEFORE INSERT ON payment_history
FOR EACH ROW
WHEN NEW.booking_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'payment client does not match the booking')
  WHERE NEW.client_id != (SELECT client_id FROM bookings WHERE booking_id = NEW.booking_id);
END;

-- What happened with a customer. The client portal lists rows for that
-- client_id. The employee portal lists rows for that emp_id.
CREATE TABLE interaction_history (
  interaction_id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients (client_id) ON DELETE RESTRICT,
  emp_id TEXT REFERENCES employees (emp_id) ON DELETE RESTRICT,
  booking_id TEXT REFERENCES bookings (booking_id) ON DELETE RESTRICT,
  service_id TEXT REFERENCES service_history (service_id) ON DELETE RESTRICT,
  payment_id TEXT REFERENCES payment_history (payment_id) ON DELETE RESTRICT,
  kind TEXT NOT NULL,
  request_status TEXT,
  summary TEXT NOT NULL,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(interaction_id) > 0),
  CHECK (kind IN ('status', 'note')),
  CHECK (
    (actor = 'client' AND emp_id IS NULL)
    OR (actor = 'employee' AND emp_id IS NOT NULL)
  ),
  CHECK (length(summary) BETWEEN 1 AND 500),
  CHECK (request_status IS NULL OR request_status IN (
    'requested',
    'in-review',
    'scheduled',
    'denied',
    'modified-for-approval',
    'cancelled',
    'completed',
    'no_access'
  ))
);

CREATE INDEX interaction_history_client ON interaction_history (client_id, created_at);
CREATE INDEX interaction_history_employee ON interaction_history (emp_id, client_id, created_at);

CREATE TRIGGER interaction_matches_booking
BEFORE INSERT ON interaction_history
FOR EACH ROW
WHEN NEW.booking_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'interaction client does not match the booking')
  WHERE NEW.client_id != (SELECT client_id FROM bookings WHERE booking_id = NEW.booking_id);
END;

-- A loyalty award given to a client. Title is the words we show.
-- No points, no credit, and no automatic grant until one is decided.
CREATE TABLE awards (
  award_id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients (client_id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  note TEXT,
  granted_on TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(award_id) > 0),
  CHECK (length(title) BETWEEN 1 AND 80),
  CHECK (note IS NULL OR length(note) <= 500),
  CHECK (length(granted_on) = 10)
);

CREATE INDEX awards_client ON awards (client_id, granted_on);

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients (client_id) ON DELETE RESTRICT,
  booking_id TEXT REFERENCES bookings (booking_id) ON DELETE SET NULL,
  service_id TEXT REFERENCES service_history (service_id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  neighborhood TEXT,
  stars INTEGER,
  body TEXT NOT NULL,
  -- Empty while the review is on the page. Set when it is taken down.
  hidden_at TEXT,
  created_at TEXT NOT NULL,
  CHECK (length(first_name) BETWEEN 1 AND 40),
  CHECK (neighborhood IS NULL OR length(neighborhood) <= 60),
  CHECK (stars IS NULL OR stars BETWEEN 1 AND 5),
  CHECK (length(body) BETWEEN 8 AND 800)
);

CREATE INDEX reviews_public ON reviews (created_at DESC);
CREATE UNIQUE INDEX reviews_one_per_booking ON reviews (booking_id) WHERE booking_id IS NOT NULL;
CREATE UNIQUE INDEX reviews_one_per_service ON reviews (service_id) WHERE service_id IS NOT NULL;

-- A contact note, or a booking from someone with no account.
-- A signed-in Book a Clean is a bookings row, not a row here.
CREATE TABLE inquiries (
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
);

CREATE INDEX inquiries_created ON inquiries (created_at DESC);
