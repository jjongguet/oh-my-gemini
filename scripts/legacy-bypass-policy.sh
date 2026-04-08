#!/usr/bin/env bash
set -euo pipefail

legacy_flags=(
  "OMP_LEGACY_RUNNING_SUCCESS"
  "OMP_LEGACY_VERIFY_GATE_PASS"
)

enabled_flags=()
for flag in "${legacy_flags[@]}"; do
  value="${!flag:-}"
  if [[ "$value" == "1" ]]; then
    enabled_flags+=("${flag}=1")
  fi
done

if (( ${#enabled_flags[@]} > 0 )); then
  echo "[legacy-bypass-policy] FAIL: legacy compatibility bypass flags must remain disabled in blocking gates." >&2
  printf '[legacy-bypass-policy] Enabled: %s\n' "${enabled_flags[@]}" >&2
  echo "[legacy-bypass-policy] Unset these flags and rerun quality/release gates." >&2
  exit 1
fi

echo "[legacy-bypass-policy] PASS: legacy compatibility bypass flags are disabled."
