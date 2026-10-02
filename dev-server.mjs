import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = 8787;
const dataDir = path.join(root, "data");
const reviewsPath = path.join(dataDir, "reviews.json");
const inquiriesPath = path.join(dataDir, "inquiries.json");

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

function validateInquiry(body) {
  if (clean(body.website, 80)) return { ok: true, spam: true };
  const name = clean(body.name, 80);
  const email = clean(body.email, 120);
  const phone = clean(body.phone, 30);
  if (name.length < 1) return { error: "Please add your name." };
  if (!email.includes("@") && phone.length < 7) {
    return { error: "Please add an email or a phone number." };
  }
  return {
    ok: true,
    inquiry: {
      kind: clean(body.kind, 20) || "contact",
      name,
      email,
      phone,
      payload: body,
      createdAt: new Date().toISOString(),
    },
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);

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

  if (url.pathname === "/api/inquiry" && req.method === "POST") {
    try {
      const result = validateInquiry(await readBody(req));
      if (result.error) {
        send(res, 400, JSON.stringify({ error: result.error }));
        return;
      }
      if (!result.spam && result.inquiry) {
        const inquiries = readJson(inquiriesPath, []);
        inquiries.unshift(result.inquiry);
        writeJson(inquiriesPath, inquiries);
      }
      send(res, 200, JSON.stringify({ ok: true }));
    } catch (error) {
      send(res, 400, JSON.stringify({ error: error.message }));
    }
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
