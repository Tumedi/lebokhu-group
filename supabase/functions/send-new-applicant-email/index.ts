// ============================================================
// LeKhuBo Connect — Supabase Edge Function: send-new-applicant-email
// ------------------------------------------------------------
// Notifies the EMPLOYER (the homeowner / "Potential Employer" who posted the
// job) — and the admin via BCC — when a job seeker applies to their post.
// The email links the employer to their dashboard so they can review the
// applicant and Shortlist / Reject / Accept.
//
// Called by the browser right after an application row is inserted
// (see js/employer-jobs.js). Job seekers apply while logged in, but to keep
// this robust (and because the applicant is not the employer) deploy it
// WITHOUT jwt verification:
//
// Deploy:  supabase functions deploy send-new-applicant-email --no-verify-jwt
// Secrets: supabase secrets set RESEND_API_KEY=re_xxx
//          supabase secrets set NEW_APPLICANT_FROM="LeKhuBo Connect <onboarding@resend.dev>"
//          supabase secrets set NEW_APPLICANT_BCC="info@lekhubo-connect.co.za"
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
      Deno.env.get("NEW_APPLICANT_FROM") ??
      "LeKhuBo Connect <onboarding@resend.dev>";
    // Admin always receives a copy. Overridable via secret.
    const BCC = Deno.env.get("NEW_APPLICANT_BCC") ?? "info@lekhubo-connect.co.za";

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY is not configured" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      employer_email,
      employer_name,
      job_title,
      company,
      seeker_name,
      seeker_email,
      seeker_phone,
    } = body as Record<string, string>;

    if (!employer_email || !job_title) {
      return new Response(
        JSON.stringify({ error: "employer_email and job_title are required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const name = employer_name || "there";
    const role =
      "“" + (job_title || "your role") + "”" + (company ? " at " + company : "");
    const applicant = seeker_name || "A job seeker";
    const reviewUrl = "https://lekhubo-connect.co.za/my-posts.html";

    const contactBits: string[] = [];
    if (seeker_email) {
      contactBits.push(
        '<a href="mailto:' + esc(seeker_email) + '" style="color:#0C6B57">' +
          esc(seeker_email) + "</a>",
      );
    }
    if (seeker_phone) contactBits.push(esc(seeker_phone));
    const contactLine = contactBits.length
      ? '<p style="margin:4px 0"><strong>Contact:</strong> ' +
        contactBits.join(" &middot; ") + "</p>"
      : "";

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0B2038">
        <div style="background:#0B2038;padding:20px 24px;border-radius:12px 12px 0 0">
          <span style="color:#F6C453;font-size:20px;font-weight:bold;font-family:Georgia,serif">LeKhuBo Connect</span>
          <div style="color:#9fb2c4;font-size:12px;margin-top:2px">Connecting People, Resources &amp; Opportunity</div>
        </div>
        <div style="border:1px solid #e6ebf0;border-top:none;border-radius:0 0 12px 12px;padding:24px">
          <p>Hi ${esc(name)},</p>
          <h2 style="font-family:Georgia,serif;font-size:18px;color:#1f5fa8;margin:6px 0 12px">You have a new applicant! 🎉</h2>
          <p><strong>${esc(applicant)}</strong> has applied for ${role} on LeKhuBo Connect.</p>
          <div style="background:#f6f9fc;border:1px solid #e6ebf0;border-radius:10px;padding:14px 16px;margin:16px 0">
            <p style="margin:4px 0"><strong>Applicant:</strong> ${esc(applicant)}</p>
            ${contactLine}
            <p style="margin:4px 0"><strong>Applied for:</strong> ${esc(job_title)}${company ? " &middot; " + esc(company) : ""}</p>
          </div>
          <p>Log in to your dashboard to review the application and <strong>shortlist</strong>,
          <strong>reject</strong> or <strong>accept</strong> this candidate.</p>
          <p style="text-align:center;margin:22px 0">
            <a href="${reviewUrl}"
               style="background:#E4A020;color:#3a2600;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:999px;display:inline-block">Review Applicants</a>
          </p>
          <p style="margin-top:20px">Kind regards,<br><strong>LeKhuBo Connect</strong><br>
          <a href="mailto:info@lekhubo-connect.co.za" style="color:#0C6B57">info@lekhubo-connect.co.za</a> &middot; 081 798 6359</p>
        </div>
      </div>`;

    const text =
      `Hi ${name},\n\n` +
      `You have a new applicant!\n\n` +
      `${applicant} has applied for ${job_title}${company ? " at " + company : ""}.\n` +
      (seeker_email ? `Email: ${seeker_email}\n` : "") +
      (seeker_phone ? `Phone: ${seeker_phone}\n` : "") +
      `\nReview applicants: ${reviewUrl}\n\n` +
      `Kind regards,\nLeKhuBo Connect\ninfo@lekhubo-connect.co.za | 081 798 6359`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [employer_email],
        bcc: BCC ? [BCC] : undefined,
        reply_to: "info@lekhubo-connect.co.za",
        subject: "New applicant for " + job_title + " — LeKhuBo Connect",
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
