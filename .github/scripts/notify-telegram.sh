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
if [[ "${NOTIFICATION_KIND:-failure}" == "warning" ]]; then
  heading='⚠️ Restaurant deals map update completed with warnings'
  output_label='Warnings (the update continued):'
else
  heading='🚨 Restaurant deals map automation failed'
  output_label='Error output:'
fi
message=$(printf '%s\n\nWorkflow: %s\nJob: %s\nBranch: %s\nRun: %s\n\n%s\n%s' \
  "${heading}" \
  "${GITHUB_WORKFLOW}" \
  "${GITHUB_JOB}" \
  "${GITHUB_REF_NAME}" \
  "${run_url}" \
  "${output_label}" \
  "${details}")

curl --fail --silent --show-error \
  --request POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
  --data-urlencode "text=${message}" \
  >/dev/null

echo "Telegram ${NOTIFICATION_KIND:-failure} notification sent"
