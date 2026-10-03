import { d1, routePortal } from "../../_lib/portal.js";

export async function onRequest(context) {
  if (!context.env?.DB) {
    return Response.json(
      { error: "The portal database is not connected yet." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  const response = await routePortal(d1(context.env.DB), context.request);
  return response || new Response("Not found", { status: 404 });
}
