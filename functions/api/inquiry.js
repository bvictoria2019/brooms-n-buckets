import { d1, routeInquiry } from "../_lib/portal.js";

const MAIL_FROM = "scheduler@brooms-n-buckets.com";
const MAIL_TO = "billvictoria103@gmail.com";
const ACCOUNT_ID = "c5aa13120079513e0fc73c28fd26a44d";

async function notify(env, subject, text) {
  const token = env?.MAIL_TOKEN;
  if (!token) return { mailed: false, note: "missing-token" };
  const safeSubject = String(subject || "Brooms & Buckets").replace(/[\r\n]+/g, " ");
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/email/sending/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: MAIL_TO,
        from: MAIL_FROM,
        subject: safeSubject,
        text,
      }),
    },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    const code = body?.errors?.[0]?.message || body?.errors?.[0]?.code || response.status;
    return { mailed: false, note: String(code).slice(0, 160) };
  }
  return { mailed: true, note: "" };
}

export async function onRequest(context) {
  if (!context.env?.DB) {
    return Response.json(
      { error: "The portal database is not connected yet." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  const send = (subject, text) => notify(context.env, subject, text);
  return routeInquiry(d1(context.env.DB), context.request, send);
}
