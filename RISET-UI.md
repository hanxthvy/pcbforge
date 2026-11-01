# RISET — apa yang sebenarnya ada di alat PCB profesional

Dicatat dari dokumentasi resmi, bukan dari ingatan. Sumbernya di bawah.

## Susunan antarmuka (KiCad 9, PCB Editor)

   1. Toolbar atas          berkas, zoom, sunting
   2. Toolbar kiri          pilihan tampilan
   3. Pesan + bilah status  posisi kursor, kisi, zoom, satuan, info item terpilih
   4. Toolbar kanan         alat gambar dan desain
   5. Panel Appearance      tiga tab: Layers, Objects, Nets
   6. Panel Selection Filter apa saja yang bisa dipilih
   7. Kanvas                kisi, asal kisi, snap magnetik

Altium serupa: panel PCB (telusuri berdasarkan komponen atau net), panel Properties di
kanan untuk item terpilih. EasyEDA Pro menaruh status kanvas di kanan bawah.

## Alat menggambar (EasyEDA, daftar lengkap)

Track, Pad, Via, Text, Arc, Circle, Move, Hole, Image, Canvas Origin, Connect Pad to
Pad, Copper Area, Solid Region, Measure/Dimension, Rect, Group/Ungroup.

Cara menggambar jalur yang dipakai semua alat PCB:

- klik sekali mulai menggambar, klik lagi menambatkan titik
- klik kanan mengakhiri jalur, klik kanan dua kali keluar dari mode jalur
- **hotkey ganti lapisan saat menggambar otomatis menyisipkan VIA** dan jalurnya
  lanjut di lapisan lain
- tombol `+` dan `-` mengubah lebar jalur saat menggambar, `Tab` membuka kolomnya

## Yang ada di KiCad dan belum ada di PCBForge

- **Ratsnest / airwire** — garis yang menunjukkan sambungan yang BELUM dibuat. Ini
  inti alat PCB: tanpa ini orang tidak tahu apa yang masih harus dirutekan.
- **Panel Appearance** — tab Layers (tampil/sembunyi + warna + lapisan aktif), tab
  Objects (per jenis objek: pad, jejak, via, teks, zona), tab Nets (daftar net).
- **Penyorotan net** — satu net dinyalakan, sisanya diredupkan.
- **Selection filter** — batasi apa yang bisa dipilih (hanya jejak, hanya pad, dst).
- **Zona tembaga (copper pour)** — bidang ground/power. Ini praktik standar, dan
  hampir setiap board dua lapis memakainya untuk GND.
- **Rule area (keepout)** — area yang tidak boleh ditempati tembaga.
- **Alat ukur** — jarak antara dua titik.
- **Alat teks** — menaruh tulisan di sablon, di luar penanda komponen.
- **Via** dengan sisi, ukuran, dan jenis (tembus; blind/buried tidak didukung
  EasyEDA untuk 2 lapis).
- **Asal kisi** dan snap magnetik ke pad.
- **Kunci objek** dan **grup**.
- **Ratak dan bagi rata** objek.
- **Panel Selection Filter**.

## Yang sudah ada di PCBForge

Kanvas dengan kisi dan snap, geser dan perbesar, pilih/geser/putar/balik sisi/hapus,
taruh komponen, net, gambar jalur dengan lebar dan lapisan, periksa aturan desain,
periksa konektivitas, penanda sablon, ekspor Gerber + Excellon + BOM + CPL, satu
berkas zip untuk pabrik.

## Urutan pengerjaan berikutnya, menurut kepentingan

1. Ratsnest (airwire) — tanpa ini alat PCB tidak bisa dipakai merutekan
2. Panel Appearance: tab Layers dan tab Nets, plus penyorotan net
3. Ganti lapisan saat menggambar menyisipkan via
4. Alat ukur
5. Zona tembaga (copper pour) untuk ground
6. Alat teks di sablon
7. Selection filter
8. Kunci dan grup, ratak dan bagi rata

## Sumber

- KiCad 9.0 PCB Editor: https://docs.kicad.org/9.0/en/pcbnew/pcbnew.html
- KiCad Layers: https://github.com/KiCad/kicad-doc/blob/master/src/pcbnew/pcbnew_layers.adoc
- EasyEDA PCB Tools: https://docs.easyeda.com/en/PCB/PCB-Tools/
- EasyEDA Route Tracks: https://docs.easyeda.com/en/PCB/Route/
- EasyEDA Copper Area: https://docs.easyeda.com/en/PCB/Copper-Pour/
- Altium Elements of the Environment: https://www.altium.com/documentation/altium-designer/design-environment-elements
- Altium PCB Panel: https://www.altium.com/documentation/altium-designer/pcb/pcb-panel
- Altium Connectivity / ratsnest: https://www.altium.com/documentation/node/305421/printable/print
