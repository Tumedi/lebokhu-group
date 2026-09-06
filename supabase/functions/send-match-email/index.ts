// ============================================================
// LeBoKhu Group — Supabase Edge Function: send-match-email
// ------------------------------------------------------------
// Notifies a job seeker about a specific job opportunity that
// matches their profile. Called by the logged-in admin.
//
// Deploy:  supabase functions deploy send-match-email
// Secret:  supabase secrets set RESEND_API_KEY=re_xxx
//          supabase secrets set MATCH_FROM="LeBoKhu Group <onboarding@resend.dev>"
//          supabase secrets set MATCH_BCC="Tbmadihlaba@gmail.com"
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
      Deno.env.get("MATCH_FROM") ?? "LeBoKhu Group <onboarding@resend.dev>";
    const BCC = Deno.env.get("MATCH_BCC") ?? "Tbmadihlaba@gmail.com";

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY is not configured" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      seeker_email,
      seeker_name,
      title,
      company,
      sector,
      level,
      location,
      job_type,
      description,
      apply_url,
    } = body as Record<string, string>;

    if (!seeker_email || !title) {
      return new Response(
        JSON.stringify({ error: "seeker_email and title are required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const name = seeker_name || "there";
    const applyUrl = apply_url ||
      ("https://tumedi.github.io/lebokhu-group/register.html?role=" +
        encodeURIComponent(title));
    const descBlock = description
      ? `<p style="background:#f4f7f9;border-radius:8px;padding:12px 16px">${esc(description)}</p>`
      : "";

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0B2038">
        <div style="background:#0B2038;padding:20px 24px;border-radius:12px 12px 0 0">
          <span style="color:#F6C453;font-size:20px;font-weight:bold;font-family:Georgia,serif">LeBoKhu Group</span>
          <div style="color:#9fb2c4;font-size:12px;margin-top:2px">Connecting People, Resources &amp; Opportunity</div>
        </div>
        <div style="border:1px solid #e6ebf0;border-top:none;border-radius:0 0 12px 12px;padding:24px">
          <p>Hi ${esc(name)},</p>
          <p>Good news — we found a <strong style="color:#0C6B57">job opportunity that matches your profile</strong>!</p>
          <div style="border:1px solid #e6ebf0;border-radius:10px;padding:16px;margin:14px 0">
            <h2 style="margin:0 0 10px;font-family:Georgia,serif;font-size:18px">${esc(title)}</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              ${company ? `<tr><td style="padding:4px 0;color:#5a6b7b">Company</td><td style="padding:4px 0;font-weight:bold">${esc(company)}</td></tr>` : ""}
              ${sector ? `<tr><td style="padding:4px 0;color:#5a6b7b">Sector</td><td style="padding:4px 0">${esc(sector)}</td></tr>` : ""}
              ${level ? `<tr><td style="padding:4px 0;color:#5a6b7b">Level</td><td style="padding:4px 0">${esc(level)}</td></tr>` : ""}
              ${location ? `<tr><td style="padding:4px 0;color:#5a6b7b">Location</td><td style="padding:4px 0">${esc(location)}</td></tr>` : ""}
              ${job_type ? `<tr><td style="padding:4px 0;color:#5a6b7b">Type</td><td style="padding:4px 0">${esc(job_type)}</td></tr>` : ""}
            </table>
            ${descBlock}
          </div>
          <p style="text-align:center;margin:22px 0">
            <a href="${esc(applyUrl)}" style="background:#E4A020;color:#3a2600;text-decoration:none;font-weight:bold;padding:13px 26px;border-radius:999px;display:inline-block">Apply / Confirm Interest</a>
          </p>
          <p>If you're interested, click the button above or simply reply to this email and we'll take it from there.</p>
          <p>Qualified or not — we're here to help you take the next step. 💪</p>
          <p style="margin-top:20px">Kind regards,<br><strong>LeBoKhu Group</strong><br>
          <a href="mailto:Tbmadihlaba@gmail.com" style="color:#0C6B57">Tbmadihlaba@gmail.com</a> &middot; 081 798 6359</p>
        </div>
      </div>`;

    const text =
      `Hi ${name},\n\n` +
      `Good news — we found a job opportunity that matches your profile!\n\n` +
      `${title}\n` +
      (company ? `Company: ${company}\n` : "") +
      (sector ? `Sector: ${sector}\n` : "") +
      (level ? `Level: ${level}\n` : "") +
      (location ? `Location: ${location}\n` : "") +
      (job_type ? `Type: ${job_type}\n` : "") +
      (description ? `\n${description}\n` : "") +
      `\nInterested? Apply / confirm here: ${applyUrl}\n` +
      `Or simply reply to this email.\n\n` +
      `Kind regards,\nLeBoKhu Group\nTbmadihlaba@gmail.com | 081 798 6359`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [seeker_email],
        bcc: BCC ? [BCC] : undefined,
        reply_to: "Tbmadihlaba@gmail.com",
        subject: "A job matching your profile — LeBoKhu Group",
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
