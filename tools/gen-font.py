#!/usr/bin/env python3
# [xihanzu-NR]
"""Buat tabel font goresan (stroke font) untuk penanda sablon.

Kenapa perlu: Gerber tidak punya teks. Penanda komponen (R1, C2, J1) harus digambar
sebagai goresan garis, huruf demi huruf. Sablon tanpa penanda tetap bisa dipakai,
tapi perakitan jadi menebak posisi komponen; itu sebabnya berkas CPL ada. Menambahkan
penanda membuat board bisa dibaca manusia, dan itu yang dilakukan setiap alat PCB.

Bentuk huruf di sini bukan font sungguhan, tapi kerangka garis 5x7. Ukuran hasilnya
diatur pemanggil, bukan di sini: tabel ini hanya menyimpan bentuk, dalam satuan sel
0..4 mendatar dan 0..6 tegak. Tinggi huruf sebenarnya ditentukan oleh tinggi sel yang
dipakai di silk.hys.

Huruf yang dibuat: A-Z, 0-9, tanda hubung, titik, dan spasi. Itu cukup untuk penanda
komponen dan catatan pendek di sablon.
"""

OUT = "/root/projects/pcbforge/src/core/font.hys"

# Tiap huruf: daftar goresan. Tiap goresan: daftar titik [x, y] dalam sel 0..4 x 0..6.
# y=0 di ATAS huruf, jadi pemanggil membalik saat menggambar ke koordinat board.
G = {}

def g(ch, *strokes):
    G[ch] = [list(s) for s in strokes]

g("A", [[0,6],[0,0],[4,0],[4,6]], [[0,3],[4,3]])
g("B", [[0,6],[0,0],[3,0],[4,1],[4,2],[3,3],[0,3]], [[3,3],[4,4],[4,5],[3,6],[0,6]])
g("C", [[4,1],[3,0],[1,0],[0,1],[0,5],[1,6],[3,6],[4,5]])
g("D", [[0,6],[0,0],[2,0],[4,2],[4,4],[2,6],[0,6]])
g("E", [[4,0],[0,0],[0,6],[4,6]], [[0,3],[3,3]])
g("F", [[4,0],[0,0],[0,6]], [[0,3],[3,3]])
g("G", [[4,1],[3,0],[1,0],[0,1],[0,5],[1,6],[3,6],[4,5],[4,3],[2,3]])
g("H", [[0,0],[0,6]], [[4,0],[4,6]], [[0,3],[4,3]])
g("I", [[1,0],[3,0]], [[2,0],[2,6]], [[1,6],[3,6]])
g("J", [[4,0],[4,5],[3,6],[1,6],[0,5]])
g("K", [[0,0],[0,6]], [[4,0],[0,3],[4,6]])
g("L", [[0,0],[0,6],[4,6]])
g("M", [[0,6],[0,0],[2,3],[4,0],[4,6]])
g("N", [[0,6],[0,0],[4,6],[4,0]])
g("O", [[1,0],[3,0],[4,1],[4,5],[3,6],[1,6],[0,5],[0,1],[1,0]])
g("P", [[0,6],[0,0],[3,0],[4,1],[4,2],[3,3],[0,3]])
g("Q", [[1,0],[3,0],[4,1],[4,5],[3,6],[1,6],[0,5],[0,1],[1,0]], [[3,4],[4,6]])
g("R", [[0,6],[0,0],[3,0],[4,1],[4,2],[3,3],[0,3]], [[2,3],[4,6]])
g("S", [[4,1],[3,0],[1,0],[0,1],[0,2],[1,3],[3,3],[4,4],[4,5],[3,6],[1,6],[0,5]])
g("T", [[0,0],[4,0]], [[2,0],[2,6]])
g("U", [[0,0],[0,5],[1,6],[3,6],[4,5],[4,0]])
g("V", [[0,0],[2,6],[4,0]])
g("W", [[0,0],[1,6],[2,3],[3,6],[4,0]])
g("X", [[0,0],[4,6]], [[4,0],[0,6]])
g("Y", [[0,0],[2,3],[4,0]], [[2,3],[2,6]])
g("Z", [[0,0],[4,0],[0,6],[4,6]])

g("0", [[1,0],[3,0],[4,1],[4,5],[3,6],[1,6],[0,5],[0,1],[1,0]], [[0,5],[4,1]])
g("1", [[1,1],[2,0],[2,6]], [[1,6],[3,6]])
g("2", [[0,1],[1,0],[3,0],[4,1],[4,2],[0,6],[4,6]])
g("3", [[0,0],[4,0],[2,3],[3,3],[4,4],[4,5],[3,6],[1,6],[0,5]])
g("4", [[3,6],[3,0],[0,4],[4,4]])
g("5", [[4,0],[0,0],[0,3],[3,3],[4,4],[4,5],[3,6],[1,6],[0,5]])
g("6", [[4,1],[3,0],[1,0],[0,1],[0,5],[1,6],[3,6],[4,5],[4,4],[3,3],[0,3]])
g("7", [[0,0],[4,0],[2,6]])
g("8", [[1,0],[3,0],[4,1],[3,3],[1,3],[0,1],[1,0]],
       [[1,3],[0,5],[1,6],[3,6],[4,5],[3,3]])
g("9", [[4,3],[1,3],[0,2],[0,1],[1,0],[3,0],[4,1],[4,5],[3,6],[1,6],[0,5]])

g("-", [[1,3],[3,3]])
g(".", [[2,5],[2,6]])
g(" ", )


def main():
    baris = []
    baris.append("# [xihanzu-NR]")
    baris.append("# Font goresan untuk penanda sablon. Dihasilkan tools/gen-font.py.")
    baris.append("#")
    baris.append("# Kenapa goresan, bukan font biasa: Gerber tidak punya teks. Penanda")
    baris.append("# komponen (R1, C2) harus digambar sebagai garis. Bentuk huruf di sini")
    baris.append("# kerangka 5x7; ukuran sebenarnya ditentukan pemanggil lewat tinggi sel.")
    baris.append("#")
    baris.append("# Tiap huruf: daftar goresan, tiap goresan daftar titik [x, y].")
    baris.append("#   x 0..4 mendatar, y 0..6 tegak, y=0 di ATAS huruf.")
    baris.append("# Titik y perlu dibalik saat digambar ke koordinat board.")
    baris.append("")
    baris.append("export FONT = {}")
    baris.append("")
    for k in sorted(G.keys()):
        strokes = G[k]
        baris.append('FONT["%s"] = [' % k)
        for s in strokes:
            titik = ", ".join("[%d, %d]" % (p[0], p[1]) for p in s)
            baris.append("  [%s]," % titik)
        baris.append("]")
    baris.append("")
    baris.append("export def lebar_huruf():")
    baris.append("    # Lebar sel mendatar. Jarak antar huruf ditambahkan pemanggil.")
    baris.append("    return 4")
    baris.append("")
    baris.append("export def tinggi_huruf():")
    baris.append("    return 6")
    baris.append("")
    open(OUT, "w", encoding="utf-8").write("\n".join(baris) + "\n")
    total = sum(len(v) for v in G.values())
    print("huruf: %d, total goresan: %d, %d baris" % (len(G), total, len(baris)))


if __name__ == "__main__":
    main()
