// ============================================================
// LeKhuBo Connect — Supabase Edge Function: send-post-received-email
// ------------------------------------------------------------
// Sends a "we've received your job post" confirmation to an
// employer via Resend, right after they submit a post.
//
// Deploy:  supabase functions deploy send-post-received-email --no-verify-jwt
// Secret:  supabase secrets set RESEND_API_KEY=re_xxx
//          supabase secrets set POST_RECEIVED_FROM="LeKhuBo Connect <onboarding@resend.dev>"
//          supabase secrets set POST_RECEIVED_BCC="Tbmadihlaba@gmail.com"
//
// NOTE: Employers submit without logging in, so deploy with --no-verify-jwt.
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
      Deno.env.get("POST_RECEIVED_FROM") ??
      "LeKhuBo Connect <onboarding@resend.dev>";
    const BCC = Deno.env.get("POST_RECEIVED_BCC") ?? "Tbmadihlaba@gmail.com";

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY is not configured" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      contact_email,
      contact_name,
      company,
      title,
      sector,
      location,
      job_type,
    } = body as Record<string, string>;

    if (!contact_email) {
      return new Response(
        JSON.stringify({ error: "contact_email is required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const name = contact_name || company || "there";

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0B2038">
        <div style="background:#0B2038;padding:20px 24px;border-radius:12px 12px 0 0">
          <span style="color:#F6C453;font-size:20px;font-weight:bold;font-family:Georgia,serif">LeKhuBo Connect</span>
          <div style="color:#9fb2c4;font-size:12px;margin-top:2px">Connecting People, Resources &amp; Opportunity</div>
        </div>
        <div style="border:1px solid #e6ebf0;border-top:none;border-radius:0 0 12px 12px;padding:24px">
          <p>Hi ${esc(name)},</p>
          <p>Thank you for submitting a job post with <strong>LeKhuBo Connect</strong>. We've
          <strong style="color:#0C6B57">received your post</strong> and it is now pending review.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
            <tr><td style="padding:6px 0;color:#5a6b7b">Job title</td><td style="padding:6px 0;font-weight:bold">${esc(title)}</td></tr>
            <tr><td style="padding:6px 0;color:#5a6b7b">Company</td><td style="padding:6px 0;font-weight:bold">${esc(company)}</td></tr>
            <tr><td style="padding:6px 0;color:#5a6b7b">Sector</td><td style="padding:6px 0">${esc(sector)}</td></tr>
            <tr><td style="padding:6px 0;color:#5a6b7b">Location</td><td style="padding:6px 0">${esc(location)}</td></tr>
            <tr><td style="padding:6px 0;color:#5a6b7b">Type</td><td style="padding:6px 0">${esc(job_type)}</td></tr>
          </table>
          <p><strong style="color:#0C6B57">What happens next?</strong> Our team will review your
          post shortly. Once approved, it goes live on our Jobs page and you'll receive a
          confirmation email. We'll also help connect you with suitable candidates.</p>
          <p>If you have any questions, just reply to this email.</p>
          <p style="margin-top:20px">Kind regards,<br><strong>LeKhuBo Connect</strong><br>
          <a href="mailto:Tbmadihlaba@gmail.com" style="color:#0C6B57">Tbmadihlaba@gmail.com</a> &middot; 081 798 6359</p>
        </div>
        <div style="text-align:center;color:#8496a6;font-size:11px;padding:14px">
          You received this because a job post was submitted using this email on lebokhugroup.
        </div>
      </div>`;

    const text =
      `Hi ${name},\n\n` +
      `Thank you for submitting a job post with LeKhuBo Connect. We've received your post and it is now pending review.\n\n` +
      `Job title: ${title}\nCompany: ${company}\nSector: ${sector}\nLocation: ${location}\nType: ${job_type}\n\n` +
      `What happens next? Our team will review your post shortly. Once approved, it goes live on our ` +
      `Jobs page and you'll receive a confirmation email.\n\n` +
      `If you have any questions, just reply to this email.\n\n` +
      `Kind regards,\nLeKhuBo Connect\nTbmadihlaba@gmail.com | 081 798 6359`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [contact_email],
        bcc: BCC ? [BCC] : undefined,
        reply_to: "Tbmadihlaba@gmail.com",
        subject: "We've received your job post — LeKhuBo Connect",
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
