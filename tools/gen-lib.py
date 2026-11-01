#!/usr/bin/env python3
# [xihanzu-NR]
"""Ubah berkas .kicad_mod dari pustaka KiCad jadi satu pustaka Hydra.

Kenapa menyerap, bukan menghitung sendiri: rumus IPC-7351 yang sempat kupakai
melenceng jauh dari ukuran asli (R_1206: 0.825 mm vs 1.4625 mm), dan footprint yang
salah membuat board tidak bisa dipateri. Pustaka KiCad CC-BY-SA 4.0 sudah teruji
fabrikasi, jadi angkanya diambil apa adanya. Atribusinya ada di ATTRIBUTION.md.

Hasil: src/core/lib.hys, tabel data murni. Tidak ada logika di sana.
"""
import json
import os
import re
import sys

SRC = "/root/projects/pcbforge/lib/kicad"
OUT = "/root/projects/pcbforge/src/core/lib.hys"

# Tinggi komponen di atas board, milimeter. .kicad_mod TIDAK menyimpan tinggi
# (tinggi ada di model 3D STEP), jadi ini nilai umum yang wajar untuk tiap paket.
# Dipakai untuk pemeriksaan tabrakan di tampilan 3D dan untuk laporan BOM.
# Nilai perkiraan, bukan hasil ukur.
HEIGHTS = {
    "R_0402": 0.35, "R_0603": 0.45, "R_0805": 0.5, "R_1206": 0.55,
    "C_0402": 0.5, "C_0603": 0.8, "C_0805": 0.95, "C_1206": 1.1,
    "L_1210": 1.2,
    "D_SOD123": 1.1, "D_SMA": 2.2,
    "LED_0603": 0.7, "LED_0805": 0.9,
    "SOT23": 1.1, "SOT223": 1.7, "TO252": 2.3, "TO220": 15.0,
    "SOIC8": 1.5, "SOIC16": 1.5, "TSSOP20": 1.1,
    "QFN24": 0.9, "QFN32": 0.9, "QFN56": 1.0,
    "CRYSTAL3225": 0.8,
    "PINHDR_1x02": 2.5, "PINHDR_1x04": 2.5,
    "USBC_16P": 3.3,
    "SW_SPST": 0.5, "TACT_6MM": 5.0,
    "ESP32WROOM": 3.2,
}


# ---------- pembaca S-expression ----------

def tokenize(text):
    text = re.sub(r"\((?s:.*)", lambda m: " ( " + m.group(0)[1:], text, count=0)
    text = text.replace(")", " ) ")
    toks, buf, in_str = [], "", False
    for ch in text:
        if in_str:
            buf += ch
            if ch == '"':
                toks.append(buf)
                buf, in_str = "", False
            continue
        if ch == '"':
            in_str = True
            buf = '"'
        elif ch.isspace() or ch in "()":
            if buf:
                toks.append(buf)
                buf = ""
            if ch in "()":
                toks.append(ch)
        else:
            buf += ch
    if buf:
        toks.append(buf)
    return toks


def parse(toks):
    pos = [0]

    def walk():
        if toks[pos[0]] != "(":
            v = toks[pos[0]]
            pos[0] += 1
            return v
        pos[0] += 1
        node = []
        while pos[0] < len(toks) and toks[pos[0]] != ")":
            node.append(walk())
        pos[0] += 1
        return node

    out = []
    while pos[0] < len(toks):
        out.append(walk())
    return out


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def find_all(node, tag):
    return [c for c in node if isinstance(c, list) and c and c[0] == tag]


def find_one(node, tag):
    r = find_all(node, tag)
    return r[0] if r else None


def layer_of(node):
    lay = find_one(node, "layer")
    return lay[1] if lay else ""


def unquote(s):
    return s.strip('"')


# ---------- pengubah ----------

def convert(path, name):
    text = open(path, encoding="utf-8").read()
    tree = parse(tokenize(text))
    root = tree[0]
    if root[0] in ("module", "footprint"):
        body = root
    else:
        body = root

    pads, silk, fab, crtyd = [], [], [], []
    pins = 0

    for node in body:
        if not isinstance(node, list) or not node:
            continue
        tag = node[0]

        if tag == "pad":
            pname = unquote(str(node[1]))
            ptype = node[2]                      # smd / thru_hole / np_thru_hole
            pshape = node[3] if len(node) > 3 else "rect"
            at = find_one(node, "at")
            size = find_one(node, "size")
            drill = find_one(node, "drill")
            rot = num(at[3]) if (at and len(at) > 3) else 0.0
            w = num(size[1]) if size else 0.0
            h = num(size[2]) if size and len(size) > 2 else w
            d = num(drill[1]) if drill else 0.0
            # Drat juga bisa muncul sebagai oval: (drill oval 0.8 1.2)
            if drill and len(drill) > 2 and not drill[1][0].isdigit():
                d = (num(drill[2]) + num(drill[3])) / 2
            kind = "tht" if ptype in ("thru_hole", "np_thru_hole") else "smd"
            # Nama yang tidak numerik (mis. "MP", "A1") tetap disimpan apa adanya.
            if pname.isdigit():
                pname_out = int(pname)
                pins = max(pins, pname_out)
            else:
                pname_out = pname
            shape = "circle" if pshape == "circle" else (
                "oval" if pshape == "oval" else (
                    "rrect" if pshape in ("roundrect", "custom") else "rect"))
            pads.append([pname_out, num(at[1]) if at else 0.0,
                         num(at[2]) if at else 0.0, w, h, shape, kind, d,
                         rot, num(at[2]) if at else 0.0])
            # buang duplikat kolom y dari kesalahan ketik: bersihkan di bawah
            pads[-1] = pads[-1][:9]
            pads[-1][1] = num(at[1]) if at else 0.0
            pads[-1][2] = num(at[2]) if at else 0.0

        elif tag in ("fp_line", "fp_arc"):
            layer = layer_of(node)
            st = find_one(node, "start")
            en = find_one(node, "end")
            if not st or not en:
                continue
            seg = [num(st[1]), num(st[2]), num(en[1]), num(en[2])]
            if layer == "F.SilkS":
                silk.append(seg)
            elif layer == "F.Fab":
                fab.append(seg)
            elif layer == "F.CrtYd":
                crtyd.append(seg)

        elif tag in ("fp_circle", "fp_rect"):
            layer = layer_of(node)
            if tag == "fp_circle":
                ce = find_one(node, "center")
                en = find_one(node, "end")
                if ce and en and layer == "F.SilkS":
                    r = ((num(en[1]) - num(ce[1])) ** 2 + (num(en[2]) - num(ce[2])) ** 2) ** 0.5
                    silk.append(["c", num(ce[1]), num(ce[2]), r])
            else:
                st = find_one(node, "start")
                en = find_one(node, "end")
                if st and en and layer == "F.SilkS":
                    silk.append([num(st[1]), num(st[2]), num(en[1]), num(en[2])])

    # Bounding box dari pad + silk, untuk penempatan dan pemeriksaan tabrakan.
    xs, ys = [], []
    for p in pads:
        xs += [p[1] - p[3] / 2, p[1] + p[3] / 2]
        ys += [p[2] - p[4] / 2, p[2] + p[4] / 2]
    if not xs:
        xs, ys = [0, 0], [0, 0]

    return {
        "name": name,
        "pads": pads,
        "silk": silk,
        "fab": fab,
        "courtyard": crtyd,
        "w": round(max(xs) - min(xs), 4),
        "h": round(max(ys) - min(ys), 4),
        "height": HEIGHTS.get(name, 1.0),
        "pins": pins,
    }


def pad_literal(p):
    def f(v):
        if isinstance(v, int):
            return str(v)
        if isinstance(v, str):
            return '"%s"' % v
        s = ("%.4f" % v).rstrip("0").rstrip(".")
        return s if s else "0"
    inner = ", ".join(f(v) for v in p)
    return "[%s]" % inner


def main():
    fps = []
    for fn in sorted(os.listdir(SRC)):
        if not fn.endswith(".kicad_mod"):
            continue
        name = fn[: -len(".kicad_mod")]
        fps.append(convert(os.path.join(SRC, fn), name))

    lines = []
    lines.append("# [xihanzu-NR]")
    lines.append("# Pustaka footprint. Data murni, tidak ada logika.")
    lines.append("#")
    lines.append("# Angka diambil dari pustaka KiCad resmi (CC-BY-SA 4.0) lewat")
    lines.append("# tools/gen-lib.py. JANGAN dihitung sendiri dengan rumus IPC: rumus")
    lines.append("# yang dicoba melenceng jauh dari ukuran asli dan membuat board tidak")
    lines.append("# bisa dipateri. Lihat ATTRIBUTION.md.")
    lines.append("#")
    lines.append("# Bentuk tiap pad:")
    lines.append("#   [nama, x, y, lebar, tinggi, bentuk, jenis, diameter bor, rotasi]")
    lines.append("#   bentuk: rect | rrect | circle | oval   jenis: smd | tht")
    lines.append("# Bentuk tiap baris silk/fab/courtyard:")
    lines.append("#   [x1, y1, x2, y2]  atau  [\"c\", cx, cy, r] untuk lingkaran")
    lines.append("")
    lines.append("export LIB = {}")
    lines.append("")
    for f in fps:
        lines.append('LIB["%s"] = {' % f["name"])
        lines.append('  nama: "%s",' % f["name"])
        lines.append('  w: %s, h: %s, tinggi: %s, pin: %s,'
                     % (f["w"], f["h"], f["height"], f["pins"]))
        lines.append("  pad: [")
        for p in f["pads"]:
            lines.append("    %s," % pad_literal(p))
        lines.append("  ],")
        def segs(lst, key):
            if not lst:
                lines.append("  %s: []," % key)
                return
            lines.append("  %s: [" % key)
            for s in lst:
                if s and s[0] == "c":
                    lines.append('    ["c", %g, %g, %g],' % (s[1], s[2], s[3]))
                else:
                    lines.append("    [%g, %g, %g, %g],"
                                 % (s[0], s[1], s[2], s[3]))
            lines.append("  ],")
        segs(f["silk"], "silk")
        segs(f["fab"], "fab")
        segs(f["courtyard"], "crt")
        lines.append("}")
        lines.append("")

    names = ", ".join('"%s"' % f["name"] for f in fps)
    lines.append("# Daftar nama ditulis eksplisit, bukan lewat Object.keys().")
    lines.append("# Object.keys() memicu helper `dict_keys` dari runtime hydra, dan runtime itu")
    lines.append("# mengimpor React di tingkat atas. Mesin inti harus bisa dijalankan di Node")
    lines.append("# polos tanpa React terpasang, jadi ia dijaga bebas helper sepenuhnya.")
    lines.append("LIB_NAMA = [%s]" % names)
    lines.append("")
    lines.append("export def lib_names():")
    lines.append("    # Daftar nama, untuk ditawarkan ke pengguna dan ke AI. Sudah terurut.")
    lines.append("    return LIB_NAMA")
    lines.append("")
    lines.append("export def lib_get(nama):")
    lines.append("    if LIB[nama] == undefined:")
    lines.append("        return null")
    lines.append("    return LIB[nama]")
    lines.append("")
    lines.append("export def lib_ada(nama):")
    lines.append("    return LIB[nama] != undefined")
    lines.append("")

    open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    total_pads = sum(len(f["pads"]) for f in fps)
    print("footprint: %d, total pad: %d, %d baris" % (len(fps), total_pads, len(lines)))


if __name__ == "__main__":
    main()
