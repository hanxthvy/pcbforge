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
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HY="${HYDRA_BIN:-/root/projects/hydra/bin/hydra}"
cd "$ROOT"
rm -rf build
mkdir -p build

# Gerbang 1: tidak boleh ada `def` tanpa `export` di mesin inti.
#
# Modul dengan `def` biasa tetap dikompilasi tanpa keluhan, tapi siapa pun yang
# `import { f } from "./x.hys"` mendapat `undefined`. Yang terlihat di halaman: tombol
# yang diam tanpa pesan. Tidak ada peringatan di mana pun.
lepas=""
for f in src/core/*.hys; do
  n=$(grep -cE '^def ' "$f" || true)
  if [ "$n" != "0" ]; then lepas="$lepas $f($n)"; fi
done
if [ "$lepas" != "" ]; then
  echo "  GAGAL: fungsi tanpa export di mesin inti:$lepas"
  exit 1
fi

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
# Gerbang 2: setiap nama yang diimpor harus benar-benar diekspor berkas tujuannya.
#
# Ini yang menangkap kesalahan yang paling sering terjadi di sini: menambah pemanggilan
# ke fungsi yang belum ada, atau lupa `export` pada satu nama. Keduanya hanya terlihat
# saat halaman dipakai, dan bentuknya galat yang terjadi DI DALAM penangan kanvas
# sehingga seluruh halaman lepas. Diperiksa dari teks hasil kompilasi, jadi ketahuan
# sebelum apa pun dijalankan.
python3 - <<'PY'
import glob, os, re, sys
bad = []
for p in glob.glob("build/*.mjs"):
    teks = open(p, encoding="utf-8").read()
    for m in re.finditer(r"import\s*\{([^}]*)\}\s*from\s*['\"]\./([A-Za-z0-9_]+)\.mjs['\"]", teks):
        nama = [n.strip() for n in m.group(1).split(",") if n.strip()]
        tujuan = os.path.join("build", m.group(2) + ".mjs")
        if not os.path.exists(tujuan):
            bad.append((p, m.group(2), "berkas tujuan tidak ada"))
            continue
        isi = open(tujuan, encoding="utf-8").read()
        for n in nama:
            if not re.search(r"export\s+(function|const|let|var|class)\s+" + re.escape(n) + r"\b", isi):
                if "export {" not in isi:
                    bad.append((os.path.basename(p), m.group(2), n))
if bad:
    print("  GAGAL: impor tidak ditemukan:")
    for a, b, c in bad:
        print("        " + a + " mengimpor " + c + " dari " + b + ".mjs, tapi tidak ada")
    sys.exit(1)
PY

echo "  core: $n modul, uji: $t -> build/ (bebas helper)"
