// ============================================================
// LeBoKhu Group — Supabase Edge Function: send-welcome-email
// ------------------------------------------------------------
// Sends a "thanks for registering" confirmation email to a job
// seeker via Resend. The Resend API key is stored as a secret
// (RESEND_API_KEY) and never exposed to the browser.
//
// Deploy:  supabase functions deploy send-welcome-email --no-verify-jwt
// Secret:  supabase secrets set RESEND_API_KEY=re_xxx
//          supabase secrets set WELCOME_FROM="LeBoKhu Group <onboarding@resend.dev>"
//          supabase secrets set WELCOME_BCC="Tbmadihlaba@gmail.com"
//
// NOTE: Registrations come from anonymous (not-logged-in) visitors,
// so this function is intended to be deployed with --no-verify-jwt.
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
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM =
      Deno.env.get("WELCOME_FROM") ?? "LeBoKhu Group <onboarding@resend.dev>";
    const BCC = Deno.env.get("WELCOME_BCC") ?? "Tbmadihlaba@gmail.com";

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY is not configured" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      email,
      first_name,
      preferred_sector,
      applying_for,
      has_cv,
    } = body as Record<string, any>;

    if (!email) {
      return new Response(JSON.stringify({ error: "email is required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const name = first_name || "there";
    const roleLine = applying_for
      ? `<tr><td style="padding:6px 0;color:#5a6b7b">Applied for</td><td style="padding:6px 0;font-weight:bold">${esc(applying_for)}</td></tr>`
      : "";
    const sectorLine = preferred_sector
      ? `<tr><td style="padding:6px 0;color:#5a6b7b">Preferred work</td><td style="padding:6px 0">${esc(preferred_sector)}</td></tr>`
      : "";
    const cvNote = has_cv
      ? "We've received your CV. "
      : "If you have a CV, you can reply to this email with it attached. ";

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0B2038">
        <div style="background:#0B2038;padding:20px 24px;border-radius:12px 12px 0 0">
          <span style="color:#F6C453;font-size:20px;font-weight:bold;font-family:Georgia,serif">LeBoKhu Group</span>
          <div style="color:#9fb2c4;font-size:12px;margin-top:2px">Connecting People, Resources &amp; Opportunity</div>
        </div>
        <div style="border:1px solid #e6ebf0;border-top:none;border-radius:0 0 12px 12px;padding:24px">
          <p>Hi ${esc(name)},</p>
          <p>Thank you for registering with <strong>LeBoKhu Group</strong>! We've received your
          details and added you to our talent pool.</p>
          ${roleLine || sectorLine ? `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">${roleLine}${sectorLine}</table>` : ""}
          <p><strong style="color:#0C6B57">What happens next?</strong> Our team reviews new
          registrations and matches candidates to suitable opportunities. If a role fits your
          profile, we'll be in touch. ${cvNote}</p>
          <p>In the meantime, you can browse current openings on our
          <a href="https://tumedi.github.io/lebokhu-group/jobs.html" style="color:#0C6B57">Jobs page</a>.</p>
          <p>Qualified or not — we're here to help you take the next step. 💪</p>
          <p style="margin-top:20px">Kind regards,<br><strong>LeBoKhu Group</strong><br>
          <a href="mailto:Tbmadihlaba@gmail.com" style="color:#0C6B57">Tbmadihlaba@gmail.com</a> &middot; 081 798 6359</p>
        </div>
        <div style="text-align:center;color:#8496a6;font-size:11px;padding:14px">
          You received this because you registered as a job seeker on lebokhugroup.
        </div>
      </div>`;

    const text =
      `Hi ${name},\n\n` +
      `Thank you for registering with LeBoKhu Group! We've received your details and added you to our talent pool.\n\n` +
      (applying_for ? `Applied for: ${applying_for}\n` : "") +
      (preferred_sector ? `Preferred work: ${preferred_sector}\n` : "") +
      `\nWhat happens next? Our team reviews new registrations and matches candidates to suitable opportunities. ` +
      `If a role fits your profile, we'll be in touch. ` +
      (has_cv ? "We've received your CV.\n\n" : "If you have a CV, reply to this email with it attached.\n\n") +
      `Browse current openings: https://tumedi.github.io/lebokhu-group/jobs.html\n\n` +
      `Qualified or not — we're here to help you take the next step.\n\n` +
      `Kind regards,\nLeBoKhu Group\nTbmadihlaba@gmail.com | 081 798 6359`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        bcc: BCC ? [BCC] : undefined,
        reply_to: "Tbmadihlaba@gmail.com",
        subject: "Thanks for registering — LeBoKhu Group",
        html,
        text,
      }),
    });

    const data = await resendRes.json().catch(() => ({}));
    if (!resendRes.ok) {
      return new Response(
        JSON.stringify({ error: "Resend error", details: data }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true, id: (data as any).id }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Unexpected error", message: String(err) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
