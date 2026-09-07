// ============================================================
// LeKhuBo Connect — Edge Function: send-service-request-email
// ------------------------------------------------------------
// Notifies the admin (and the provider, if we have their email)
// when a homeowner submits a service request. Called by anonymous
// homeowners, so deploy WITHOUT jwt verification:
//   supabase functions deploy send-service-request-email --no-verify-jwt
// Secrets: RESEND_API_KEY, SERVICE_FROM, SERVICE_ADMIN (defaults below)
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
    const FROM = Deno.env.get("SERVICE_FROM") ?? "LeKhuBo Connect <onboarding@resend.dev>";
    const ADMIN = Deno.env.get("SERVICE_ADMIN") ?? "Tbmadihlaba@gmail.com";
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY is not configured" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const b = await req.json().catch(() => ({}));
    const {
      provider_email, provider_name, service,
      homeowner_name, homeowner_phone, homeowner_email, location, details,
    } = b as Record<string, string>;

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0B2038">
        <div style="background:#0B2038;padding:20px 24px;border-radius:12px 12px 0 0">
          <span style="color:#F6C453;font-size:20px;font-weight:bold;font-family:Georgia,serif">LeKhuBo Connect</span>
          <div style="color:#9fb2c4;font-size:12px;margin-top:2px">Home Services</div>
        </div>
        <div style="border:1px solid #e6ebf0;border-top:none;border-radius:0 0 12px 12px;padding:24px">
          <p>A new <strong>service request</strong> has come in${provider_name ? " for <strong>" + esc(provider_name) + "</strong>" : ""}.</p>
          <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:14px">
            <tr><td style="padding:5px 0;color:#5a6b7b">Service</td><td style="padding:5px 0;font-weight:bold">${esc(service)}</td></tr>
            <tr><td style="padding:5px 0;color:#5a6b7b">Homeowner</td><td style="padding:5px 0;font-weight:bold">${esc(homeowner_name)}</td></tr>
            <tr><td style="padding:5px 0;color:#5a6b7b">Phone</td><td style="padding:5px 0">${esc(homeowner_phone)}</td></tr>
            ${homeowner_email ? `<tr><td style="padding:5px 0;color:#5a6b7b">Email</td><td style="padding:5px 0">${esc(homeowner_email)}</td></tr>` : ""}
            ${location ? `<tr><td style="padding:5px 0;color:#5a6b7b">Area</td><td style="padding:5px 0">${esc(location)}</td></tr>` : ""}
          </table>
          ${details ? `<p style="background:#f4f7f9;border-radius:8px;padding:12px 16px">${esc(details)}</p>` : ""}
          <p style="color:#5a6b7b;font-size:13px">Please contact the homeowner as soon as possible.</p>
        </div>
      </div>`;

    const text =
      `New service request${provider_name ? " for " + provider_name : ""}.\n\n` +
      `Service: ${service}\nHomeowner: ${homeowner_name}\nPhone: ${homeowner_phone}\n` +
      (homeowner_email ? `Email: ${homeowner_email}\n` : "") +
      (location ? `Area: ${location}\n` : "") +
      (details ? `\nDetails: ${details}\n` : "") +
      `\nPlease contact the homeowner as soon as possible.`;

    // Recipients: admin always; provider too if we have their email.
    const to = [ADMIN];
    if (provider_email && provider_email.indexOf("@") !== -1) to.push(provider_email);

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: to,
        reply_to: homeowner_email || ADMIN,
        subject: "New service request — LeKhuBo Connect",
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
