#!/usr/bin/env bash
# ============================================================
# LeKhuBo Connect — Deploy ALL email Edge Functions + set sender
# ============================================================
# One-shot helper (macOS/Linux) that:
#   1. Sets every *_FROM sender secret to SENDER below.
#   2. Sets every *_BCC / admin secret to BCC below.
#   3. Re-deploys all 10 email functions (public ones use --no-verify-jwt).
#
# WHY: editing/merging code on GitHub does NOT update Supabase. Edge
# Functions only change when you DEPLOY them, and the "from" address is a
# SECRET (overrides the code default). This script applies both at once.
#
# PREREQUISITES
#   • Supabase CLI installed and logged in:  supabase login
#   • Project linked:  supabase link --project-ref efupodoraphybvzttrjj
#   • Run from the repo root (contains supabase/) on the UPDATED main branch.
#
#   ⚠️ DOMAIN MUST BE VERIFIED IN RESEND
#     SENDER uses lekhubo-connect.co.za. Resend rejects sends with 403 until
#     that domain is VERIFIED (Resend → Domains → add DNS records). If not
#     verified yet, temporarily set:
#         SENDER="LeKhuBo Connect <onboarding@resend.dev>"
#     which every Resend key is authorized for, then switch back later.
# ============================================================
set -euo pipefail

# ---- EDIT THESE TWO LINES IF NEEDED ----
SENDER="LeKhuBo Connect <jobs@lekhubo-connect.co.za>"
BCC="info@lekhubo-connect.co.za"
# ----------------------------------------

echo "Setting sender secrets to: $SENDER"
for s in APPROVAL_FROM STATUS_FROM MATCH_FROM DECLINED_FROM PROVIDER_FROM \
         WELCOME_FROM POST_RECEIVED_FROM NEW_APPLICANT_FROM CHAT_FROM SERVICE_FROM; do
  supabase secrets set "$s=$SENDER"
done

for s in APPROVAL_BCC STATUS_BCC MATCH_BCC DECLINED_BCC PROVIDER_BCC \
         WELCOME_BCC POST_RECEIVED_BCC NEW_APPLICANT_BCC CHAT_BCC SERVICE_ADMIN; do
  supabase secrets set "$s=$BCC"
done

echo "Deploying email functions..."
# Admin-triggered (logged in) — JWT verification ON (default)
supabase functions deploy send-approval-email
supabase functions deploy send-status-email
supabase functions deploy send-match-email
supabase functions deploy send-declined-email
supabase functions deploy send-provider-approved

# Public/anonymous — allow unauthenticated calls
supabase functions deploy send-welcome-email --no-verify-jwt
supabase functions deploy send-post-received-email --no-verify-jwt
supabase functions deploy send-service-request-email --no-verify-jwt
supabase functions deploy send-chat-notification --no-verify-jwt
supabase functions deploy send-new-applicant-email --no-verify-jwt

echo
echo "Done. All email functions deployed and sender set to $SENDER."
echo "If Resend still returns 403 'not authorized for this domain', the"
echo "lekhubo-connect.co.za domain is not verified in Resend yet."
