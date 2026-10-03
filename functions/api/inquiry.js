import { BUSINESS_MAILBOX, sendMail } from "../_lib/mail.js";
import { d1, routeInquiry } from "../_lib/portal.js";

function notify(env, subject, text) {
  return sendMail(env, BUSINESS_MAILBOX, subject, text);
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
