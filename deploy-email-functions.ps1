# ============================================================
# LeKhuBo Connect — Deploy ALL email Edge Functions + set sender
# ============================================================
# One-shot helper (Windows PowerShell) that:
#   1. Sets every *_FROM sender secret to the SENDER below.
#   2. Sets every *_BCC / admin secret to the BCC address below.
#   3. Re-deploys all 10 email functions (public ones use --no-verify-jwt).
#
# WHY: editing/merging code on GitHub does NOT update Supabase. Edge
# Functions only change when you DEPLOY them, and the "from" address is a
# SECRET (overrides the code default). This script applies both at once.
#
# PREREQUISITES
#   • Supabase CLI installed and logged in:  supabase login
#   • Project linked:  supabase link --project-ref efupodoraphybvzttrjj
#   • Run this from the repo root (the folder that contains the supabase/ dir)
#     on the UPDATED main branch (re-download/pull first if unsure).
#
#   ⚠️ DOMAIN MUST BE VERIFIED IN RESEND
#     The SENDER below uses lekhubo-connect.co.za. Resend will reject sends
#     with 403 until that domain is VERIFIED (Resend → Domains → add DNS
#     records). If it isn't verified yet, temporarily set:
#         $SENDER = "LeKhuBo Connect <onboarding@resend.dev>"
#     which every Resend key is authorized for, then switch back after
#     verifying your domain.
# ============================================================

$ErrorActionPreference = "Stop"

# ---- EDIT THESE TWO LINES IF NEEDED ----
$SENDER = "LeKhuBo Connect <jobs@lekhubo-connect.co.za>"
$BCC    = "info@lekhubo-connect.co.za"
# ----------------------------------------

Write-Host "Setting sender secrets to: $SENDER" -ForegroundColor Cyan

# All *_FROM secrets (one per function that sends mail)
$fromSecrets = @(
  "APPROVAL_FROM", "STATUS_FROM", "MATCH_FROM", "DECLINED_FROM",
  "PROVIDER_FROM", "WELCOME_FROM", "POST_RECEIVED_FROM",
  "NEW_APPLICANT_FROM", "CHAT_FROM", "SERVICE_FROM"
)
foreach ($s in $fromSecrets) { supabase secrets set "$s=$SENDER" }

# All *_BCC / admin-copy secrets
$bccSecrets = @(
  "APPROVAL_BCC", "STATUS_BCC", "MATCH_BCC", "DECLINED_BCC",
  "PROVIDER_BCC", "WELCOME_BCC", "POST_RECEIVED_BCC",
  "NEW_APPLICANT_BCC", "CHAT_BCC", "SERVICE_ADMIN"
)
foreach ($s in $bccSecrets) { supabase secrets set "$s=$BCC" }

Write-Host "Deploying email functions..." -ForegroundColor Cyan

# Admin-triggered (logged in) — JWT verification ON (default)
supabase functions deploy send-approval-email
supabase functions deploy send-status-email
supabase functions deploy send-match-email
supabase functions deploy send-declined-email
supabase functions deploy send-provider-approved

# Called by anonymous/public visitors — must allow unauthenticated calls
supabase functions deploy send-welcome-email --no-verify-jwt
supabase functions deploy send-post-received-email --no-verify-jwt
supabase functions deploy send-service-request-email --no-verify-jwt
supabase functions deploy send-chat-notification --no-verify-jwt
supabase functions deploy send-new-applicant-email --no-verify-jwt

Write-Host ""
Write-Host "Done. All email functions deployed and sender set to $SENDER." -ForegroundColor Green
Write-Host "If you still see Resend 403 'not authorized for this domain', the" -ForegroundColor Yellow
Write-Host "lekhubo-connect.co.za domain is not verified in Resend yet." -ForegroundColor Yellow
