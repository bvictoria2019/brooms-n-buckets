import { sendMail } from "../_lib/mail.js";
import { sendDueReminders } from "../_lib/reminders.js";
import { d1 } from "../_lib/portal.js";

function authorized(request, secret) {
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < header.length; i += 1) mismatch |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return Response.json({ error: "Not found." }, { status: 404, headers: { "cache-control": "no-store" } });
  }
  if (!authorized(context.request, context.env?.CRON_SECRET)) {
    return Response.json({ error: "Not authorized." }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  if (!context.env?.DB) {
    return Response.json(
      { error: "The portal database is not connected yet." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  const sendTo = (to, subject, text) => sendMail(context.env, to, subject, text);
  const result = await sendDueReminders(d1(context.env.DB), sendTo);
  return Response.json(result, { headers: { "cache-control": "no-store" } });
}
