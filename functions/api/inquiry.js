import { d1, routeInquiry } from "../_lib/portal.js";

export async function onRequest(context) {
  if (!context.env?.DB) {
    return Response.json(
      { error: "The portal database is not connected yet." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  return routeInquiry(d1(context.env.DB), context.request);
}
