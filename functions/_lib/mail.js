const MAIL_FROM = "scheduler@brooms-n-buckets.com";
const ACCOUNT_ID = "c5aa13120079513e0fc73c28fd26a44d";

export async function sendMail(env, to, subject, text) {
  const token = env?.MAIL_TOKEN;
  const recipient = String(to || "").trim();
  if (!token) return { mailed: false, note: "missing-token" };
  if (!recipient) return { mailed: false, note: "missing-address" };
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
        to: recipient,
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
