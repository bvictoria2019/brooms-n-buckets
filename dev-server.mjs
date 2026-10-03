import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { sendMail } from "./functions/_lib/mail.js";
import { routeInquiry, routePortal, sqlite } from "./functions/_lib/portal.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = 8787;
const dataDir = path.join(root, "data");
const reviewsPath = path.join(dataDir, "reviews.json");
const portalDb = openPortalDb();

function openPortalDb() {
  fs.mkdirSync(dataDir, { recursive: true });
  const database = new DatabaseSync(path.join(dataDir, "portal.sqlite"));
  database.exec("PRAGMA foreign_keys = ON");
  const ready = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'clients'").get();
  if (!ready) {
    database.exec(fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8"));
  }
  return sqlite(database);
}

async function sendResponse(res, response) {
  const headers = {};
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") headers[key] = value;
  });
  const cookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  if (cookies.length) headers["Set-Cookie"] = cookies;
  const body = Buffer.from(await response.arrayBuffer());
  res.writeHead(response.status, headers);
  res.end(body);
}

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(dataDir, { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  const written = fs.readFileSync(tmp, "utf8");
  if (written !== JSON.stringify(value, null, 2)) {
    throw new Error("verify failed");
  }
  fs.renameSync(tmp, file);
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Please check the form and try again."));
      }
    });
    req.on("error", reject);
  });
}

function clean(value, max) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function validateReview(body) {
  if (clean(body.website, 80)) return { ok: true, spam: true };
  const firstName = clean(body.firstName, 40);
  const neighborhood = clean(body.neighborhood, 60);
  const text = clean(body.body, 800);
  const stars = Number(body.stars);
  if (firstName.length < 1) return { error: "Please add your first name." };
  if (text.length < 8) return { error: "Please write a short note, at least a sentence." };
  if (body.stars && (!Number.isInteger(stars) || stars < 1 || stars > 5)) {
    return { error: "Stars need to be from 1 to 5." };
  }
  return {
    ok: true,
    review: {
      firstName,
      neighborhood,
      stars: body.stars ? stars : null,
      body: text,
      email: clean(body.email, 120),
      createdAt: new Date().toISOString(),
    },
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);

  if (url.pathname.startsWith("/api/portal")) {
    const headers = new Headers();
    if (req.headers.cookie) headers.set("cookie", req.headers.cookie);
    if (req.headers["content-type"]) headers.set("content-type", req.headers["content-type"]);
    const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readRaw(req);
    const request = new Request(url, { method: req.method, headers, body });
    const response = await routePortal(portalDb, request, (to, subject, text) => sendMail({}, to, subject, text));
    await sendResponse(res, response || new Response("Not found", { status: 404 }));
    return;
  }

  if (url.pathname === "/api/reviews" && req.method === "GET") {
    send(res, 200, JSON.stringify({ reviews: readJson(reviewsPath, []) }));
    return;
  }

  if (url.pathname === "/api/reviews" && req.method === "POST") {
    try {
      const result = validateReview(await readBody(req));
      if (result.error) {
        send(res, 400, JSON.stringify({ error: result.error }));
        return;
      }
      if (!result.spam && result.review) {
        const reviews = readJson(reviewsPath, []);
        reviews.unshift(result.review);
        writeJson(reviewsPath, reviews);
      }
      send(res, 200, JSON.stringify({ ok: true }));
    } catch (error) {
      send(res, 400, JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (url.pathname === "/api/inquiry") {
    const headers = new Headers();
    if (req.headers.cookie) headers.set("cookie", req.headers.cookie);
    if (req.headers["content-type"]) headers.set("content-type", req.headers["content-type"]);
    const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readRaw(req);
    const request = new Request(url, { method: req.method, headers, body });
    const response = await routeInquiry(portalDb, request);
    await sendResponse(res, response || new Response("Not found", { status: 404 }));
    return;
  }

  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const filePath = path.resolve(root, `.${rel}`);
  if (!filePath.startsWith(root)) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }
  fs.readFile(filePath, (error, buf) => {
    if (error) {
      send(res, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }
    const type = types[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    send(res, 200, buf, type);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`http://127.0.0.1:${port}/`);
});
