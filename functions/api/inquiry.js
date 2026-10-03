import { sendMail } from "../_lib/mail.js";
import { d1, routeInquiry } from "../_lib/portal.js";

const MAIL_TO = "billvictoria103@gmail.com";

function notify(env, subject, text) {
  return sendMail(env, MAIL_TO, subject, text);
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
