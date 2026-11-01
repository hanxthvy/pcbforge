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
# Gerbang 3: bentuk berkas Gerber diperiksa langsung.
#
# Setiap baris harus salah satu bentuk yang dikenal RS-274X. Gerbang ini menangkap
# baris yang "kelihatan benar" tapi tidak sah — misalnya `%TF.Attr*%` tanpa nilai,
# yang sempat kutulis dan tidak pernah ketahuan karena tidak ada yang membacanya.
python3 - <<'PY'
import re, sys
import glob, os
sys.path.insert(0, "build")
bad = []
for f in glob.glob("build/out/*"):
    nama = os.path.basename(f)
    teks = open(f, encoding="utf-8").read()
    if nama.endswith(".drl"):
        if not teks.startswith("M48"):
            bad.append((nama, "tidak dimulai M48"))
        if "M30" not in teks:
            bad.append((nama, "tidak ditutup M30"))
        continue
    if "%FSLAX26Y26*%" not in teks:
        bad.append((nama, "tidak ada mode format"))
    if "%MOIN*%" not in teks and "%MM*%" not in teks:
        bad.append((nama, "tidak ada satuan"))
    if "M02*" not in teks:
        bad.append((nama, "tidak ditutup M02"))
    for baris in teks.split("\n"):
        b = baris.strip()
        if b == "":
            continue
        sah = (b.startswith("%") and b.endswith("%")) or b in ("G36*", "G37*") or b.startswith("G04") \
            or re.fullmatch(r"[GDM]?\d*X-?\d+Y-?\d+D0[123]\*", b) is not None \
            or re.fullmatch(r"D\d+\*", b) is not None \
            or b == "M02*"
        if not sah:
            bad.append((nama, "baris tidak dikenal: " + b[:40]))
if bad:
    print("  GAGAL: bentuk berkas Gerber:")
    for a, c in bad[:8]:
        print("        " + a + ": " + c)
    sys.exit(1)
PY


exit $gagal
