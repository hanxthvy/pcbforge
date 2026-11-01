#!/usr/bin/env bash
# [xihanzu-NR]
# Susun mesin inti dan uji: src/core/*.hys dan test/*.hys -> build/*.mjs
#
# Kenapa jalur impor ditulis ulang di sini, dan kenapa itu bukan tambalan:
# kalau satu berkas .hys dikompilasi sendiri lewat CLI, Hydra meneruskan jalur
# impornya apa adanya, jadi `from "./lib.hys" import X` menjadi
# `import ... from './lib.hys'` dan Node tidak bisa membukanya. Di dalam proyek yang
# lewat bundler `hydra build`, jalur itu memang diselesaikan. Tapi dua hal di proyek
# ini di luar jangkauan bundler: (1) mesin inti harus bisa diuji di Node polos tanpa
# React dan tanpa server, (2) `export * from` belum didukung sintaksnya, jadi tidak
# bisa dipakai menggabungkan modul lewat bundler. Maka compile per berkas, lalu
# jalurnya diselaraskan ke .mjs. Aturan penulisannya sempit dan eksplisit:
#   from './x.hys'  ->  from './x.mjs'
#   from 'math'     ->  from './shim-math.mjs'
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HY="${HYDRA_BIN:-/root/projects/hydra/bin/hydra}"
cd "$ROOT"
rm -rf build
mkdir -p build
cp src/core/shim-math.mjs build/shim-math.mjs

n=0
for f in src/core/*.hys; do
  base="$(basename "${f%.hys}")"
  "$HY" "$f" -o "build/$base.mjs" >/dev/null
  n=$((n + 1))
done

t=0
for f in test/*.hys; do
  base="$(basename "${f%.hys}")"
  "$HY" "$f" -o "build/$base.mjs" >/dev/null
  t=$((t + 1))
done

python3 - <<'PY'
import glob, re, os
for p in glob.glob("build/*.mjs"):
    s = open(p, encoding="utf-8").read()
    # jalur modul sesama mesin inti
    s = re.sub(r"(from\s+['\"])\./([A-Za-z0-9_]+)\.hys(['\"])", r"\1./\2.mjs\3", s)
    # shim math
    s = re.sub(r"(from\s+['\"])math(['\"])", r"\1./shim-math.mjs\2", s)
    open(p, "w", encoding="utf-8").write(s)
PY

# Gerbang: mesin inti harus bebas helper runtime.
#
# `import { x } from 'hydra'` berarti berkas itu menyentuh helper Pythonic
# (contains, dict_keys, join, padStart). Runtime-nya mengimpor React di tingkat atas
# dan tidak bisa dimuat di Node polos, jadi mesin inti akan berhenti bisa diuji tanpa
# browser. Kalau gerbang ini berbunyi, ganti pemakaian helper itu di berkas .hys yang
# bersangkutan; jangan pasang React untuk mesin inti.
if grep -l "from 'hydra'" build/*.mjs >/dev/null 2>&1; then
  echo "  GAGAL: mesin inti menyentuh runtime helper hydra:"
  grep -l "from 'hydra'" build/*.mjs | sed 's/^/        /'
  exit 1
fi
echo "  core: $n modul, uji: $t -> build/ (bebas helper)"
