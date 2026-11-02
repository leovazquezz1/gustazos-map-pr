#!/usr/bin/env bash

set -uo pipefail

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
  echo "Telegram notification secrets are not configured" >&2
  exit 1
fi

details="No command output was captured. Open the workflow run for the complete error."
if [[ -n "${FAILURE_LOG:-}" && -f "${FAILURE_LOG}" ]]; then
  details=$(tail -n 30 "${FAILURE_LOG}" | tail -c 2500)
fi

run_url="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
message=$(printf '🚨 Restaurant deals map automation failed\n\nWorkflow: %s\nJob: %s\nBranch: %s\nRun: %s\n\nError output:\n%s' \
  "${GITHUB_WORKFLOW}" \
  "${GITHUB_JOB}" \
  "${GITHUB_REF_NAME}" \
  "${run_url}" \
  "${details}")

curl --fail --silent --show-error \
  --request POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
  --data-urlencode "text=${message}" \
  >/dev/null

echo "Telegram failure notification sent"
