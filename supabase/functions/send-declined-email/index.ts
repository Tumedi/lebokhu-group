// ============================================================
// LeBoKhu Group — Supabase Edge Function: send-declined-email
// ------------------------------------------------------------
// Sends a polite "job post not approved" email to an employer
// via Resend. Called by the logged-in admin from the dashboard.
//
// Deploy:  supabase functions deploy send-declined-email
// Secret:  supabase secrets set RESEND_API_KEY=re_xxx
//          supabase secrets set DECLINED_FROM="LeBoKhu Group <onboarding@resend.dev>"
//          supabase secrets set DECLINED_BCC="Tbmadihlaba@gmail.com"
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
      Deno.env.get("DECLINED_FROM") ?? "LeBoKhu Group <onboarding@resend.dev>";
    const BCC = Deno.env.get("DECLINED_BCC") ?? "Tbmadihlaba@gmail.com";

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY is not configured" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { contact_email, contact_name, company, title, reason } =
      body as Record<string, string>;

    if (!contact_email) {
      return new Response(
        JSON.stringify({ error: "contact_email is required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const name = contact_name || company || "there";
    const reasonBlock = reason
      ? `<p style="background:#f4f7f9;border-left:4px solid #E4A020;padding:12px 16px;border-radius:0 8px 8px 0"><strong>Note from our team:</strong><br>${esc(reason)}</p>`
      : "";
    const reasonText = reason ? `\nNote from our team: ${reason}\n` : "";

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0B2038">
        <div style="background:#0B2038;padding:20px 24px;border-radius:12px 12px 0 0">
          <span style="color:#F6C453;font-size:20px;font-weight:bold;font-family:Georgia,serif">LeBoKhu Group</span>
          <div style="color:#9fb2c4;font-size:12px;margin-top:2px">Connecting People, Resources &amp; Opportunity</div>
        </div>
        <div style="border:1px solid #e6ebf0;border-top:none;border-radius:0 0 12px 12px;padding:24px">
          <p>Hi ${esc(name)},</p>
          <p>Thank you for submitting your job post <strong>${esc(title)}</strong>${company ? " for " + esc(company) : ""} with LeBoKhu Group.</p>
          <p>After review, we're unable to publish this post in its current form.</p>
          ${reasonBlock}
          <p>We'd love to help you find the right people. Please feel free to
          <a href="https://tumedi.github.io/lebokhu-group/post-job.html" style="color:#0C6B57">submit an updated post</a>
          or simply reply to this email and our team will assist you.</p>
          <p style="margin-top:20px">Kind regards,<br><strong>LeBoKhu Group</strong><br>
          <a href="mailto:Tbmadihlaba@gmail.com" style="color:#0C6B57">Tbmadihlaba@gmail.com</a> &middot; 081 798 6359</p>
        </div>
      </div>`;

    const text =
      `Hi ${name},\n\n` +
      `Thank you for submitting your job post "${title}"${company ? " for " + company : ""} with LeBoKhu Group.\n\n` +
      `After review, we're unable to publish this post in its current form.\n` +
      reasonText +
      `\nWe'd love to help you find the right people. Please feel free to submit an updated post ` +
      `(https://tumedi.github.io/lebokhu-group/post-job.html) or reply to this email and our team will assist you.\n\n` +
      `Kind regards,\nLeBoKhu Group\nTbmadihlaba@gmail.com | 081 798 6359`;

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
        subject: "Update on your job post — LeBoKhu Group",
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
