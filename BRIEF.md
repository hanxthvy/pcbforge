# BRIEF — PCBForge

Alat desain PCB di browser, ada asisten AI, keluarannya bisa dipesan cetak.

## Putusan yang sudah dikunci

| hal | putusan |
|---|---|
| lapisan | 2 layer (F.Cu, B.Cu). 4 layer tidak dikerjakan sekarang. |
| cara gambar | dari nol di dalam alat ini. Impor KiCad tidak ada. |
| skematik | tidak ada. Net didefinisikan langsung di board. |
| vendor sasaran | JLCPCB, aturan desain mengikuti kemampuan mereka. |
| AI | chat yang membuat board baru maupun menyunting board yang ada. |
| bahasa | HydraScript (.hyx) untuk seluruh antarmuka. |
| dokumen board | JSON berversi. AI menyunting lewat perintah terbatas. |
| 3D | setelah penulis Gerber dan DRC beres. |

## Yang tidak dikerjakan, dan alasannya

- **Autorouter penuh.** Routing otomatis adalah masalah riset terbuka; bahkan Flux
  belum benar-benar bisa. Yang ada: gambar jalur manual dengan pemeriksaan.
- **Impor Gerber/KiCad.** Itu produk lain (viewer). Kita menghasilkan, tidak membaca.
- **Simulasi rangkaian.** Berbeda disiplin, butuh ngspice.
- **4 layer ke atas.** Lubang, plane, dan stack-up menambah kerja berlipat.
- **Kolaborasi realtime.** Dokumen berversi dulu; itu prasyaratnya.

## Dokumen board

Satu sumber kebenaran, JSON berversi, disimpan di IndexedDB dan bisa diekspor.

```
{
  version: 1,
  meta:   { name, created },
  rules:  { clearanceMm, minTraceMm, minDrillMm, minAnnularMm, edgeClearanceMm },
  outline:{ widthMm, heightMm, corner, radiusMm, holes[] },
  parts:  [ { id, ref, value, lib, x, y, rot, side, pads[] } ],
  nets:   [ { id, name, pins[], traces[], vias[] } ]
}
```

Untuk routing lewat lubang (THT) dan via, sisi F dan B dibedakan lewat `side`.

## Perintah yang boleh dipakai AI

AI tidak menulis kode Hydra dan tidak menulis JSON mentah. Ia memanggil perintah, dan
tiap perintah diperiksa sebelum diterapkan.

```
add_part(lib, ref, value, x, y, rot, side)
move_part(ref, x, y)
rotate_part(ref, rot)         remove_part(ref)
set_outline(widthMm, heightMm)
add_net(name)                 add_pin_to_net(net, ref, pad)
route(net, layer, widthMm, pts)
add_via(net, x, y)
run_drc()
list_parts()  list_nets()  describe_area(x, y, r)  measure(a, b)
```

Aturan:

1. **Tidak mengarang footprint.** Harus nama yang ada di pustaka. Kalau tidak ada,
   perintah ditolak, dan AI diminta memilih yang mendekati.
2. **Tidak melanggar DRC.** Perintah `route`/`move_part` diuji dulu di atas salinan
   dokumen. Kalau melanggar, ditolak dan alasannya dikirim balik untuk diperbaiki.
3. **Tidak membaca seluruh dokumen.** Ia dapat ringkasan; kalau perlu detail ia
   bertanya lewat `describe_area`/`list_parts`.

## Aturan desain (default, JLCPCB 2 layer)

| aturan | nilai |
|---|---|
| lebar trace minimum | 0.15 mm (dipakai 0.25 default) |
| clearance minimum | 0.15 mm (diperiksa 0.20) |
| jarak tepi board | 0.30 mm |
| annular ring minimum | 0.13 mm |
| bor minimum | 0.30 mm |
| soldermask expansion | 0.05 mm |

## Urutan pembangunan

1. Mesin inti murni, bisa diuji tanpa browser: satuan, pustaka footprint, geometri,
   pemeriksa aturan, penulis Gerber, penulis Excellon, ekspor BOM/CPL.
2. Uji dengan board contoh, hasil Gerber diperiksa sebagai teks.
3. Antarmuka editor pakai Hydra: kanvas 2D, daftar komponen, panel properti.
4. Tampilan 3D.
5. Asisten AI di atas perintah terbatas.
