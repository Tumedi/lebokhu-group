// ============================================================
// LeKhuBo Connect — Edge Function: send-provider-approved
// ------------------------------------------------------------
// Notifies a service provider when their listing is approved and
// live in the directory. Called by the logged-in admin.
//
// Deploy:  supabase functions deploy send-provider-approved
// Secrets: RESEND_API_KEY, PROVIDER_FROM, PROVIDER_BCC (defaults below)
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
    const FROM = Deno.env.get("PROVIDER_FROM") ?? "LeKhuBo Connect <onboarding@resend.dev>";
    const BCC = Deno.env.get("PROVIDER_BCC") ?? "Tbmadihlaba@gmail.com";
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY is not configured" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const b = await req.json().catch(() => ({}));
    const { provider_email, provider_name, service, location } = b as Record<string, string>;
    if (!provider_email) {
      return new Response(JSON.stringify({ error: "provider_email is required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const name = provider_name || "there";

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0B2038">
        <div style="background:#0B2038;padding:20px 24px;border-radius:12px 12px 0 0">
          <span style="color:#F6C453;font-size:20px;font-weight:bold;font-family:Georgia,serif">LeKhuBo Connect</span>
          <div style="color:#9fb2c4;font-size:12px;margin-top:2px">Home Services</div>
        </div>
        <div style="border:1px solid #e6ebf0;border-top:none;border-radius:0 0 12px 12px;padding:24px">
          <p>Hi ${esc(name)},</p>
          <p><strong style="color:#0C6B57">Great news!</strong> Your service listing has been
          <strong>approved</strong> and is now live in the LeKhuBo Connect directory.</p>
          <table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px">
            ${service ? `<tr><td style="padding:5px 0;color:#5a6b7b">Service</td><td style="padding:5px 0;font-weight:bold">${esc(service)}</td></tr>` : ""}
            ${location ? `<tr><td style="padding:5px 0;color:#5a6b7b">Area</td><td style="padding:5px 0">${esc(location)}</td></tr>` : ""}
          </table>
          <p>Homeowners in your area can now find you and request your services. Keep your phone
          handy — enquiries may come through soon!</p>
          <p style="text-align:center;margin:22px 0">
            <a href="https://tumedi.github.io/lebokhu-group/services-directory.html"
               style="background:#E4A020;color:#3a2600;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:999px;display:inline-block">View the Directory</a>
          </p>
          <p style="color:#5a6b7b;font-size:13px">Tip: add a clear profile photo and keep your
          details up to date to attract more customers.</p>
          <p style="margin-top:20px">Kind regards,<br><strong>LeKhuBo Connect</strong><br>
          <a href="mailto:Tbmadihlaba@gmail.com" style="color:#0C6B57">Tbmadihlaba@gmail.com</a> &middot; 081 798 6359</p>
        </div>
      </div>`;

    const text =
      `Hi ${name},\n\n` +
      `Great news! Your service listing has been approved and is now live in the LeKhuBo Connect directory.\n\n` +
      (service ? `Service: ${service}\n` : "") +
      (location ? `Area: ${location}\n` : "") +
      `\nHomeowners in your area can now find you and request your services.\n` +
      `View the directory: https://tumedi.github.io/lebokhu-group/services-directory.html\n\n` +
      `Kind regards,\nLeKhuBo Connect\nTbmadihlaba@gmail.com | 081 798 6359`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [provider_email],
        bcc: BCC ? [BCC] : undefined,
        reply_to: "Tbmadihlaba@gmail.com",
        subject: "Your service listing is approved — LeKhuBo Connect",
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
