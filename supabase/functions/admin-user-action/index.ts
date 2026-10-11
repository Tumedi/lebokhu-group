// ============================================================
// LeKhuBo Connect — Supabase Edge Function: admin-user-action
// ------------------------------------------------------------
// Privileged admin operations on auth accounts that CANNOT be done from the
// browser (they need the service_role key): truly delete a login account,
// or suspend/unsuspend it (Supabase native "ban").
//
// SECURITY: this function holds the service_role key, so it verifies the
// CALLER first — the request's JWT must belong to a user whose
// public.profiles.role = 'admin'. Non-admins get 403. An admin can never
// delete/suspend themselves (guard below).
//
// Deploy (JWT verification ON so the caller's token reaches us):
//   supabase functions deploy admin-user-action
// Secrets (both are provided by Supabase automatically on deploy, but set
// explicitly if your project doesn't inject them):
//   supabase secrets set SB_URL="https://efupodoraphybvzttrjj.supabase.co"
//   supabase secrets set SB_SERVICE_ROLE_KEY="<service_role key>"
//
// Request body: { action: "delete" | "suspend" | "unsuspend", user_id: "<uuid>" }
// Response:     { success: true } | { error: "..." }
// ============================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// A long ban duration = effectively "suspended until an admin unsuspends".
const SUSPEND_DURATION = "876000h"; // ~100 years

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    // Supabase injects SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY at runtime;
    // fall back to SB_* secrets if a project blocks the reserved names.
    const SB_URL =
      Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_KEY =
      Deno.env.get("SB_SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const ANON_KEY =
      Deno.env.get("SB_ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!SB_URL || !SERVICE_KEY) {
      return json(500, { error: "Server not configured (missing URL or service role key)." });
    }

    // ---- 1) Identify the caller from their bearer token ----
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(401, { error: "Missing Authorization token." });

    // A client bound to the caller's token so we can read who they are.
    const asCaller = createClient(SB_URL, ANON_KEY || SERVICE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userErr } = await asCaller.auth.getUser();
    if (userErr || !userData?.user) {
      return json(401, { error: "Invalid or expired session." });
    }
    const callerId = userData.user.id;

    // ---- 2) Verify the caller is an admin (service client, bypasses RLS) ----
    const admin = createClient(SB_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: prof, error: profErr } = await admin
      .from("profiles").select("role").eq("id", callerId).single();
    if (profErr || !prof || prof.role !== "admin") {
      return json(403, { error: "Forbidden: admin access required." });
    }

    // ---- 3) Parse + validate the request ----
    const body = await req.json().catch(() => ({}));
    const action = String((body as any).action || "");
    const user_id = String((body as any).user_id || "");
    if (!user_id) return json(400, { error: "user_id is required." });
    if (!["delete", "suspend", "unsuspend"].includes(action)) {
      return json(400, { error: "action must be delete | suspend | unsuspend." });
    }
    // An admin cannot act on their own account from here.
    if (user_id === callerId) {
      return json(400, { error: "You cannot delete or suspend your own admin account." });
    }

    // ---- 4) Perform the privileged action ----
    if (action === "delete") {
      // Deleting the auth user cascades to public.profiles (FK on delete cascade).
      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) return json(502, { error: "Delete failed: " + error.message });
      return json(200, { success: true, action: "delete", user_id });
    }

    // suspend / unsuspend via native ban_duration.
    const ban_duration = action === "suspend" ? SUSPEND_DURATION : "none";
    const { error } = await admin.auth.admin.updateUserById(user_id, {
      ban_duration,
    } as any);
    if (error) return json(502, { error: action + " failed: " + error.message });

    // Mirror the suspended state onto the profile so the dashboard can show
    // it without a privileged lookup. Best-effort; ignore if column absent.
    await admin.from("profiles")
      .update({ suspended: action === "suspend" })
      .eq("id", user_id)
      .then(() => {}, () => {});

    return json(200, { success: true, action, user_id });
  } catch (err) {
    return json(500, { error: "Unexpected error", message: String(err) });
  }
});
