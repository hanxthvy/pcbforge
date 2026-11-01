#!/usr/bin/env bash
# [xihanzu-NR]
# Susun lalu jalankan semua uji mesin inti.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
bash tools/core.sh
gagal=0
for f in build/t_*.mjs; do
  nama="$(basename "$f" .mjs)"
  if out=$(node "$f" 2>&1); then
    echo "  ok   $nama"
    echo "$out" | sed 's/^/        /'
  else
    echo "  GAGAL $nama"
    echo "$out" | head -12 | sed 's/^/        /'
    gagal=1
  fi
done
exit $gagal
