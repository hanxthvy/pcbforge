# PCBForge

Alat desain PCB 2 lapis yang jalan di browser, punya asisten AI, dan keluarannya
bisa langsung dipesan cetak.

Ditulis dengan [HydraScript](https://github.com/hanxthvy/hydrascript). Proyek ini
sekaligus jadi uji nyata untuk compilernya: setiap kali tulisannya tidak bisa
dikompilasi dengan benar, yang diperbaiki adalah compilernya, bukan kode di sini.

## Keadaan sekarang

Mesin inti selesai dan teruji. Ada satu halaman yang menampilkan board contoh,
hasil pemeriksaan aturannya, dan tombol yang mengunduh kesepuluh berkas siap cetak.
Editor kanvas untuk menggambar sendiri belum ada.

    src/core/units.hys    satuan, format angka, penggabung teks
    src/core/geom.hys     titik, ruas, jarak, perpotongan
    src/core/lib.hys      pustaka footprint (29 paket, 235 pad)
    src/core/board.hys    model dokumen board, net, penempatan pad
    src/core/contoh.hys   board contoh, dipakai bersama oleh halaman dan uji
    src/core/drc.hys      pemeriksa aturan desain
    src/core/conn.hys     pemeriksa konektivitas (jalur menggantung)
    src/core/gerber.hys   penulis Gerber RS-274X + Excellon

Menjalankan uji mesin inti:

    bash tools/test.sh

Menjalankan halamannya:

    hydra dev

Mengunduh berkas cetak: buka halamannya, tekan tombol Unduh Gerber.

## Yang sudah teruji

Ujung ke ujung, board 40x25 mm, 5 komponen, 4 net:

- DRC bersih untuk board yang benar, dan menangkap keenam jenis pelanggaran
  (trace kurus, pin tanpa net, clearance, bor kecil, tembaga ke tepi, footprint
  yang tidak ada di pustaka)
- Konektivitas: tiap ujung jalur menyentuh pad se-net, via, atau jalur se-net lain.
  DRC tidak memeriksa ini, dan jalur menggantung baru ketahuan setelah dicetak
- Ekspor dari halaman menghasilkan 10 berkas, diperiksa dari byte yang benar-benar
  terunduh
- Gerber: mode inci 2.6, satuan MOIN, atribut X2 (TF.FileFunction), flash D03,
  draw D01, ditutup M02
- Excellon: kepala M48, satuan metrik, kode alat T, ditutup M30
- Koordinat seluruhnya berada di dalam batas board
- Pustaka footprint cocok persis dengan berkas KiCad aslinya sampai 0.0001 mm

## Aturan desain

Bawaan mengikuti kemampuan JLCPCB untuk board 2 lapis, dengan angka periksa yang
sengaja sedikit lebih longgar supaya tidak ada board lolos tepat di batas.

| aturan | nilai |
|---|---|
| lebar trace minimum | 0.15 mm |
| clearance minimum | 0.20 mm |
| jarak ke tepi board | 0.30 mm |
| annular ring minimum | 0.13 mm |
| bor minimum | 0.30 mm |
| pelebaran soldermask | 0.05 mm |

## Rencana

1. ~~Mesin inti: geometri, DRC, Gerber, Excellon~~ selesai
2. ~~Halaman pembuktian: papan, panel DRC, ekspor yang bisa diklik~~ selesai
3. Editor kanvas: menggambar jalur, memindah komponen, panel properti
4. Tampilan 3D dengan model komponen bertinggi nyata
5. Asisten AI di atas perintah terbatas

Ruang lingkup lengkap dan yang sengaja **tidak** dikerjakan ada di [BRIEF.md](BRIEF.md).

## Tampilan

Satu kolom di ponsel, dua kolom di layar lebar, tanpa lebar tetap. Ukuran sentuh
minimum 44px dan ada ruang aman bawah untuk bilah gestur ponsel.

Yang penting di ponsel:
- tombol **Unduh berkas cetak** menghasilkan SATU berkas zip berisi tiga belas
  berkas: 10 lapisan Gerber, BOM, CPL, dan keterangan. Sepuluh unduhan beruntun
  diblokir browser dan bisa menghasilkan berkas separuh tanpa peringatan
- papan bisa disentuh untuk diperbesar. Bisa ditutup dengan tombol, sentuhan di
  luar, atau tombol Escape

## Batas yang diketahui

- Sudut jalur diputus jadi segmen lurus, bukan arc Gerber. Untuk sudut 45 derajat
  hasilnya persis sama; sudut yang lebih tumpul belum ditangani sebagai arc.
- Sablon belum memuat penanda komponen (R1, C2). Gerber tidak punya font, jadi teks
  harus digambar sebagai goresan dari tabel bentuk huruf. Penempatan komponen sudah
  dipandu berkas CPL, jadi perakitan tidak terhalang.
- Tinggi komponen adalah nilai umum per paket, bukan hasil ukur. Berkas `.kicad_mod`
  tidak menyimpan tinggi; angka aslinya ada di model 3D STEP.
- Pemeriksaan clearance memperlakukan pad persegi sebagai lingkaran dengan radius
  setengah sisi terpanjang. Untuk pad persegi panjang ini membuat pemeriksaan
  kadang terlalu ketat, tidak pernah terlalu longgar.

## Lisensi

Kode: MIT.

Pustaka footprint bersumber dari pustaka KiCad resmi, CC-BY-SA 4.0. Lihat
[ATTRIBUTION.md](ATTRIBUTION.md).
