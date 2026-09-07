// ============================================================
// LeKhuBo Connect — Supabase Edge Function: send-status-email
// ------------------------------------------------------------
// Notifies a job seeker when their application status changes.
// Called by the logged-in admin from the dashboard.
//
// Deploy:  supabase functions deploy send-status-email
// Secret:  supabase secrets set RESEND_API_KEY=re_xxx
//          supabase secrets set STATUS_FROM="LeKhuBo Connect <onboarding@resend.dev>"
//          supabase secrets set STATUS_BCC="Tbmadihlaba@gmail.com"
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

// Friendly, human message per status.
function statusCopy(status: string, title: string, company: string) {
  var role = title ? ("“" + title + "”" + (company ? " at " + company : "")) : "your application";
  switch (status) {
    case "reviewed":
      return {
        headline: "Your application is being reviewed",
        body: "Good news — your application for " + role +
          " is now being reviewed by our team. We'll keep you posted on the next steps.",
        tone: "#8a6100",
      };
    case "shortlisted":
      return {
        headline: "You've been shortlisted! 🎉",
        body: "Great news — you've been <strong>shortlisted</strong> for " + role +
          ". Our team may contact you shortly with next steps, so keep an eye on your phone and inbox.",
        tone: "#1f5fa8",
      };
    case "hired":
      return {
        headline: "Congratulations — you got the job! 🎉",
        body: "Wonderful news — you've been selected for " + role +
          "! Our team will be in touch with all the details. Congratulations from all of us at LeKhuBo Connect.",
        tone: "#0C6B57",
      };
    case "rejected":
      return {
        headline: "Update on your application",
        body: "Thank you for your interest in " + role +
          ". After careful consideration, this role has moved forward with other candidates. " +
          "Please don't be discouraged — we'll keep your details on file and match you to future opportunities.",
        tone: "#c0392b",
      };
    default: // submitted / anything else
      return {
        headline: "We've received your application",
        body: "Thank you for applying for " + role +
          ". Your application has been received and is in our queue. We'll update you as it progresses.",
        tone: "#5a6b7b",
      };
  }
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
      Deno.env.get("STATUS_FROM") ?? "LeKhuBo Connect <onboarding@resend.dev>";
    const BCC = Deno.env.get("STATUS_BCC") ?? "Tbmadihlaba@gmail.com";

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY is not configured" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { seeker_email, seeker_name, job_title, company, status } =
      body as Record<string, string>;

    if (!seeker_email || !status) {
      return new Response(
        JSON.stringify({ error: "seeker_email and status are required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const name = seeker_name || "there";
    const copy = statusCopy(status, job_title || "", company || "");

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0B2038">
        <div style="background:#0B2038;padding:20px 24px;border-radius:12px 12px 0 0">
          <span style="color:#F6C453;font-size:20px;font-weight:bold;font-family:Georgia,serif">LeKhuBo Connect</span>
          <div style="color:#9fb2c4;font-size:12px;margin-top:2px">Connecting People, Resources &amp; Opportunity</div>
        </div>
        <div style="border:1px solid #e6ebf0;border-top:none;border-radius:0 0 12px 12px;padding:24px">
          <p>Hi ${esc(name)},</p>
          <h2 style="font-family:Georgia,serif;font-size:18px;color:${copy.tone};margin:6px 0 12px">${copy.headline}</h2>
          <p>${copy.body}</p>
          <p style="text-align:center;margin:22px 0">
            <a href="https://tumedi.github.io/lebokhu-group/my-applications.html"
               style="background:#E4A020;color:#3a2600;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:999px;display:inline-block">View My Applications</a>
          </p>
          <p style="margin-top:20px">Kind regards,<br><strong>LeKhuBo Connect</strong><br>
          <a href="mailto:Tbmadihlaba@gmail.com" style="color:#0C6B57">Tbmadihlaba@gmail.com</a> &middot; 081 798 6359</p>
        </div>
      </div>`;

    const text =
      `Hi ${name},\n\n` +
      `${copy.headline}\n\n` +
      copy.body.replace(/<[^>]+>/g, "") + "\n\n" +
      `View your applications: https://tumedi.github.io/lebokhu-group/my-applications.html\n\n` +
      `Kind regards,\nLeKhuBo Connect\nTbmadihlaba@gmail.com | 081 798 6359`;

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
        subject: copy.headline + " — LeKhuBo Connect",
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
