# Atribusi

## Pustaka footprint KiCad

Berkas di `lib/kicad/`, dan angka di `src/core/lib.hys` yang dihasilkan darinya,
berasal dari **KiCad Footprint Libraries**:

- Sumber: https://gitlab.com/kicad/libraries/kicad-footprints
- Lisensi: **Creative Commons Attribution-ShareAlike 4.0 International (CC-BY-SA 4.0)**
- Hak cipta: para kontributor pustaka KiCad

Berkas diturunkan lewat `tools/gen-lib.py`, yang membaca bentuk S-expression
`.kicad_mod` dan mengubahnya jadi tabel data Hydra. Angka geometrinya tidak diubah.

Konsekuensi lisensi: berkas turunan ini tetap CC-BY-SA 4.0, dan siapa pun yang
menyebarkannya kembali wajib mencantumkan atribusi yang sama.

### Kenapa angka KiCad, bukan rumus IPC-7351

Sempat dicoba menghitung sendiri dengan rumus IPC-7351B. Hasilnya melenceng jauh
dari ukuran yang sudah teruji fabrikasi, dan selisihnya membesar mengikuti ukuran
paket:

| paket | hitung sendiri | pustaka KiCad | selisih pusat pad |
|---|---|---|---|
| R_0402 | 0.275 mm | 0.510 mm | -0.235 mm |
| R_0603 | 0.425 mm | 0.7875 mm | -0.362 mm |
| R_0805 | 0.400 mm | 0.9125 mm | -0.512 mm |
| R_1206 | 0.825 mm | 1.4625 mm | -0.637 mm |

Footprint yang salah membuat board tidak bisa dipateri, jadi angka yang dipakai
adalah angka pustaka yang sudah terbukti. Rumus IPC bisa ditambahkan nanti untuk
membuat footprint yang belum ada di pustaka, dengan pengujian yang serius.
