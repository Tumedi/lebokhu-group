// ============================================================
// LeBoKhu Group — Edge Function: send-chat-notification
// ------------------------------------------------------------
// Emails the OTHER party when a new chat message arrives on a
// service request. Called by homeowners (anon) and providers,
// so deploy WITHOUT jwt verification:
//   supabase functions deploy send-chat-notification --no-verify-jwt
// Secrets: RESEND_API_KEY, CHAT_FROM, CHAT_BCC (defaults below)
//
// The caller passes the recipient email + names + a short preview.
// (No secrets/PII are exposed — the client already holds these values.)
// ============================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("CHAT_FROM") ?? "LeBoKhu Group <onboarding@resend.dev>";
    const BCC = Deno.env.get("CHAT_BCC") ?? "Tbmadihlaba@gmail.com";
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY is not configured" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const b = await req.json().catch(() => ({}));
    const {
      recipient_email, recipient_name, sender_label,
      service, preview, chat_url,
    } = b as Record<string, string>;

    // If no recipient email, nothing to send (not an error).
    if (!recipient_email || recipient_email.indexOf("@") === -1) {
      return new Response(JSON.stringify({ success: false, skipped: "no recipient email" }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const name = recipient_name || "there";
    const who = sender_label || "Someone";
    const svc = service ? (" about " + service) : "";
    const linkBtn = chat_url
      ? '<p style="text-align:center;margin:22px 0"><a href="' + esc(chat_url) +
        '" style="background:#E4A020;color:#3a2600;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:999px;display:inline-block">Open Chat</a></p>'
      : "";

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0B2038">
        <div style="background:#0B2038;padding:20px 24px;border-radius:12px 12px 0 0">
          <span style="color:#F6C453;font-size:20px;font-weight:bold;font-family:Georgia,serif">LeBoKhu Group</span>
          <div style="color:#9fb2c4;font-size:12px;margin-top:2px">Home Services</div>
        </div>
        <div style="border:1px solid #e6ebf0;border-top:none;border-radius:0 0 12px 12px;padding:24px">
          <p>Hi ${esc(name)},</p>
          <p><strong>${esc(who)}</strong> sent you a new message${esc(svc)} on LeBoKhu Group.</p>
          ${preview ? '<p style="background:#f4f7f9;border-radius:8px;padding:12px 16px;font-style:italic">“' + esc(preview) + '”</p>' : ""}
          ${linkBtn}
          <p style="color:#5a6b7b;font-size:13px">Reply from your chat to keep the conversation going.</p>
          <p style="margin-top:20px">Kind regards,<br><strong>LeBoKhu Group</strong><br>
          <a href="mailto:Tbmadihlaba@gmail.com" style="color:#0C6B57">Tbmadihlaba@gmail.com</a> &middot; 081 798 6359</p>
        </div>
      </div>`;

    const text =
      `Hi ${name},\n\n` +
      `${who} sent you a new message${svc} on LeBoKhu Group.\n\n` +
      (preview ? `"${preview}"\n\n` : "") +
      (chat_url ? `Open the chat: ${chat_url}\n\n` : "") +
      `Kind regards,\nLeBoKhu Group\nTbmadihlaba@gmail.com | 081 798 6359`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [recipient_email],
        bcc: BCC ? [BCC] : undefined,
        reply_to: "Tbmadihlaba@gmail.com",
        subject: "New message" + (service ? " about " + service : "") + " — LeBoKhu Group",
        html, text,
      }),
    });

    const data = await resendRes.json().catch(() => ({}));
    if (!resendRes.ok) {
      return new Response(JSON.stringify({ error: "Resend error", details: data }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ success: true, id: (data as any).id }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Unexpected error", message: String(err) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
