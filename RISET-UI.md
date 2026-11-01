# RISET — apa yang ada di alat PCB profesional, dan keadaan PCBForge

Dicatat dari dokumentasi resmi, bukan dari ingatan. Sumbernya di bawah.

## Susunan antarmuka (KiCad 9, PCB Editor)

   1. Toolbar atas          berkas, zoom, sunting
   2. Toolbar kiri          pilihan tampilan
   3. Pesan + bilah status  posisi kursor, kisi, zoom, satuan, info item terpilih
   4. Toolbar kanan         alat gambar dan desain
   5. Panel Appearance      tiga tab: Layers, Objects, Nets
   6. Panel Selection Filter apa saja yang bisa dipilih
   7. Kanvas                kisi, asal kisi, snap magnetik

Altium serupa: panel PCB (telusuri per komponen atau net), panel Properties di kanan.
EasyEDA Pro menaruh status kanvas di kanan bawah.

## Alat menggambar (daftar EasyEDA)

Track, Pad, Via, Text, Arc, Circle, Move, Hole, Image, Canvas Origin, Connect Pad to
Pad, Copper Area, Solid Region, Measure/Dimension, Rect, Group/Ungroup.

Cara menggambar jalur yang dipakai semua alat PCB:

- klik sekali mulai, klik lagi menambatkan titik
- klik kanan mengakhiri, klik kanan dua kali keluar dari mode
- **hotkey ganti lapisan saat menggambar otomatis menyisipkan VIA**
- tombol `+` dan `-` mengubah lebar jalur saat menggambar, `Tab` membuka kolomnya

## Keadaan PCBForge

### Sudah ada

| alat | catatan |
|---|---|
| kanvas 2D | kisi, snap, geser, perbesar, ikut ukuran layar |
| pilih / geser / putar / balik sisi / hapus | dengan pintasan V R Delete Escape |
| taruh komponen dari pustaka | 29 paket, 235 pad, dari pustaka KiCad resmi |
| net | buat, daftar, satu komponen masuk net |
| gambar jalur | lebar dan lapisan bisa diatur, klik ganda atau klik titik sama untuk selesai |
| alat via | klik menaruh via di net aktif (B) |
| zona tembaga | seret persegi, dengan pengosongan clearance lewat polaritas terbalik |
| penanda sablon | ref dan nilai tiap komponen, digambar sebagai goresan huruf |
| teks sablon | tulisan bebas: nama board, versi, peringatan |
| keepout | area terlarang untuk tembaga |
| ratsnest | pohon penghubung minimum, seperti alat profesional |
| panel Appearance | tiga tab: Lapisan (warna + mata + aktif), Objek, Net |
| penyorotan net | satu net nyala, sisanya diredupkan |
| selection filter | batasi apa yang bisa dipilih |
| alat ukur | M, dua klik, jarak dan selisih X/Y |
| kunci | mencegah komponen bergeser tanpa sengaja |
| grup | geser dan putar sekelompok komponen bersama |
| ratak dan bagi rata | kiri/atas/sejajar, bagi datar/tegak |
| aturan desain bisa diubah | lebar, jarak, tepi, bor |
| bilah status | posisi kursor, kisi, alat, snap, undo, redo, zoom |
| undo / redo | riwayat board, Ctrl+Z / Ctrl+Y |
| simpan dan buka | penyimpanan browser, berkas .pcbforge.json, muat otomatis |
| ekspor | Gerber 10 lapisan + Excellon + BOM + CPL + panduan, satu zip |
| periksa | DRC, konektivitas, kesiapan cetak, penanda di kanvas |
| tampilan 3D | jalur, via, komponen berketinggian asli, bisa diputar |

### Belum ada

| yang kurang | seberapa perlu |
|---|---|
| editor footprint sendiri | perlu untuk komponen di luar pustaka, tapi 29 paket menutup sebagian besar board dua lapis |
| tembaga polygonal (bukan persegi) | perlu untuk board bersudut tidak beraturan |
| ganti lapisan saat menggambar otomatis menyisipkan via | kenyamanan; sekarang taruh via dulu lalu gambar lanjut |
| pengukuran dengan snap ke tepi pad | kenyamanan |
| pindah jalur setelah digambar (tarik simpul) | perlu saat merapikan |
| lapisan sablon dan mask bisa disunting langsung | sekarang hanya tampilan |
| asal kisi bisa dipindah | kenyamanan |
| ODB++ dan IPC-2581 | tidak dipakai JLCPCB untuk board dua lapis |

## Sumber

- KiCad 9.0 PCB Editor: https://docs.kicad.org/9.0/en/pcbnew/pcbnew.html
- KiCad Layers: https://github.com/KiCad/kicad-doc/blob/master/src/pcbnew/pcbnew_layers.adoc
- EasyEDA PCB Tools: https://docs.easyeda.com/en/PCB/PCB-Tools/
- EasyEDA Route Tracks: https://docs.easyeda.com/en/PCB/Route/
- EasyEDA Copper Area: https://docs.easyeda.com/en/PCB/Copper-Pour/
- Altium Elements of the Environment: https://www.altium.com/documentation/altium-designer/design-environment-elements
- Altium PCB Panel: https://www.altium.com/documentation/altium-designer/pcb/pcb-panel
- Altium Connectivity / ratsnest: https://www.altium.com/documentation/node/305421/printable/print
