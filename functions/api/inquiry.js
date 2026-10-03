import { d1, routeInquiry } from "../_lib/portal.js";

const MAIL_FROM = "scheduler@brooms-n-buckets.com";
const MAIL_TO = "billvictoria103@gmail.com";

function rawMessage(subject, text) {
  const safeSubject = String(subject || "Brooms & Buckets").replace(/[\r\n]+/g, " ");
  return [
    `From: Brooms & Buckets <${MAIL_FROM}>`,
    `To: ${MAIL_TO}`,
    `Subject: ${safeSubject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    text,
  ].join("\r\n");
}

async function notify(mail, subject, text) {
  if (!mail || typeof mail.send !== "function") return false;
  const { EmailMessage } = await import("cloudflare:email");
  await mail.send(new EmailMessage(MAIL_FROM, MAIL_TO, rawMessage(subject, text)));
  return true;
}

export async function onRequest(context) {
  if (!context.env?.DB) {
    return Response.json(
      { error: "The portal database is not connected yet." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  const send = (subject, text) => notify(context.env.MAIL, subject, text);
  return routeInquiry(d1(context.env.DB), context.request, send);
}
