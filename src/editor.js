// [xihanzu-NR]
// Alat penggambar papan di kanvas 2D.
//
// Ditulis sebagai objek biasa, bukan komponen, karena isinya banyak keadaan yang
// berubah cepat: kursor, mode, keadaan geser, pratinjau jalur. Kalau semuanya ditaruh
// di state React, tiap gerakan kursor memicu render ulang seluruh halaman. Di sini
// gambar langsung ke kanvas, dan halaman hanya diberi tahu saat ada yang BERUBAH.
//
// Kontrak dengan halaman (semua lewat `opsi`):
//   board            dokumen board awal
//   ubah(h, diam)    hasil perintah core/cmd.hys hendak diterapkan
//   pindah(ref,x,y)  komponen selesai digeser; halaman memeriksanya lewat cmd
//   hapusRef(ref)    komponen hendak dihapus
//   gambarJalur(net, layer, lebar, pts)
//   pilih(ref)       pilihan berubah
//   status()         { mode, layer, lebar, net } dari halaman
//   pesan(m)         sesuatu perlu ditampilkan

// Impor memakai akhiran .hys, bukan .mjs: berkas ini dibundel, dan yang
// menyelesaikan jalur .hys adalah plugin Hydra. Akhiran .mjs hanya dipakai oleh
// mesin inti saat diuji langsung di Node (lihat tools/core.sh).
import { semua_pad } from './core/board.hys'
import { zona_untuk, zona_sambung } from './core/zone.hys'
import { lib_get } from './core/lib.hys'

// Warna lapisan, dan bisa diubah pengguna. Nilai bawaannya sengaja sama dengan
// kebiasaan alat PCB: tembaga atas merah/oranye, bawah biru, sablon putih, tepi kuning.
const WARNA_LAPISAN = {
    F: '#e8b55c',
    B: '#5b8dee',
    S: '#e2e8f0',
    E: '#e8d96a',
}

const W = {
    bg: '#090b0f',
    board: '#0d3b2a',
    tepi: '#5fd39a',
    atas: '#e8b55c',
    bawah: '#5b8dee',
    pad: '#f0d78c',
    via: '#aab4c8',
    silk: 'rgba(226,232,240,0.5)',
    teks: '#cbd5e1',
    kisi: 'rgba(148,163,184,0.08)',
    jalurBaru: 'rgba(124,156,255,0.9)',
    pilih: '#7c9cff',
}

function bolat(v) {
    return Math.round((v || 0) * 100) / 100
}

export function papan_alat(kanvas, opsi) {
    // Normalisasi callback lebih dulu, dengan pengaman.
    //
    // Alasannya bukan kehati-hatian berlebihan: objek `opsi` datang dari halaman yang
    // ditulis Hydra, dan sebagian lambda di dalam dict TIDAK sampai ke sini. Yang
    // terjadi: `opsi.pindah` undefined, lalu `G.pindah(...)` di dalam pendengar
    // tetikus melempar "TypeError: (void 0) is not a function" — dan karena itu terjadi
    // di dalam kanvas, halaman tetap tampak hidup sementara menyeret, memutar, dan
    // menggambar jalur semuanya diam-diam gagal. Dengan normalisasi ini setiap nama
    // pasti ada, dan yang tidak sampai berubah jadi pesan yang terlihat, bukan mati
    // tanpa jejak.
    const G = {}
    for (const k of ['ubah', 'pindah', 'hapusRef', 'gambarJalur', 'gambarZona', 'tambahVia', 'pilih', 'pesan', 'koor']) {
        const f = opsi[k]
        G[k] = typeof f === 'function' ? f : ((...args) => {
            if (k !== 'pesan') {
                console.warn('[papan] callback ' + k + ' tidak sampai dari halaman', args)
            }
        })
    }
    const st = opsi.status
    G.status = typeof st === 'function' ? st : (() => ({ mode: 'pilih', layer: 'F', lebar: 0.4, net: '' }))

    const a = {
        G: G,
        b: opsi.board,
        skala: 12,
        geserX: 0,
        geserY: 0,
        mode: 'pilih',
        terpilih: null,
        hover: null,
        jalur: null,
        kursor: null,
        tampilAtas: true,
        tampilBawah: true,
        tampilVia: true,
        tampilKisi: true,
        kisi: 0.5,
        snap: true,
        tanda: [],
        rats: [],
        zonaBaru: null,
        tampil3d: false,
        yaw: -0.6,
        pitch: 0.95,
        skala3d: 10,
        pusat3d: { x: 0, y: 0 },
        sorot: '',
        ukur: null,
        modeUkur: null,
        saring: '',   // selection filter: hanya objek jenis ini yang bisa dipilih
        rasio: 1,
        lebarCss: 800,
        tinggiCss: opsi.tinggiCss || 540,
    }

    // ---------- koordinat ----------

    a.keLayar = (x, y) => ({ x: x * a.skala + a.geserX, y: y * a.skala + a.geserY })
    a.keBoard = (x, y) => ({ x: (x - a.geserX) / a.skala, y: (y - a.geserY) / a.skala })

    a.titik = (ev) => {
        const r = kanvas.getBoundingClientRect()
        return a.keBoard(ev.clientX - r.left, ev.clientY - r.top)
    }

    a.snapTitik = (p) => {
        if (a.snap === false) return p
        const g = a.kisi
        return { x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g }
    }

    a.cariPart = (ref) => {
        for (const p of a.b.parts) {
            if (p.ref === ref) return p
        }
        return null
    }

    // ---------- ukuran ----------

    a.ukur = () => {
        const wadah = kanvas.parentElement
        if (wadah === null) return
        const lebarCss = wadah.clientWidth
        if (lebarCss <= 0) return
        a.lebarCss = lebarCss
        a.rasio = Math.min(3, window.devicePixelRatio || 1)
        kanvas.width = Math.round(lebarCss * a.rasio)
        kanvas.height = Math.round(a.tinggiCss * a.rasio)
        kanvas.style.height = a.tinggiCss + 'px'
        // Pemaskan pada pengukuran pertama yang sah.
        //
        // Sebelumnya halaman memanggil paskan() sekali setelah memasang alat ini, dan
        // itu rapuh: kalau berkas ini dipasang dua kali (yang terjadi pada jalur React
        // yang dipakai sekarang), objek TERAKHIR tidak pernah dipaskan dan skalanya
        // tetap 12 dengan geseran 0 — board digambar di sudut kiri atas, dan setiap
        // klik pengguna mendarat di tempat yang salah. Menaruh syaratnya di uukur()
        // membuat hasilnya sama dari jalur pemasangan mana pun.
        if (a.sudahPaskan !== true && b_siap(a.b)) {
            a.sudahPaskan = true
            a.paskan()
            return
        }
        a.gambar()
    }

    function b_siap(b) {
        return b !== null && b !== undefined && b.outline !== undefined && b.outline.lebar > 0
    }

    a.paskan = () => {
        const b = a.b
        if (b === null || b === undefined || b.outline === undefined) return
        const s = Math.min((a.lebarCss - 36) / b.outline.lebar,
                           (a.tinggiCss - 36) / b.outline.tinggi)
        a.skala = Math.max(2, s)
        a.geserX = (a.lebarCss - b.outline.lebar * a.skala) / 2
        a.geserY = (a.tinggiCss - b.outline.tinggi * a.skala) / 2
        a.gambar()
    }

    a.perbesar = (f) => {
        a.skala = Math.max(1.5, Math.min(160, a.skala * f))
        a.gambar()
    }

    // ---------- tampilan 3D ----------
    //
    // Bukan pemandangan fotorealistis, dan tidak berusaha jadi. Yang dilakukan:
    // memproyeksikan papan dan komponen ke sudut miring, dengan TINGGI ASLI tiap
    // paket dari pustaka. Itu menjawab pertanyaan yang tidak bisa dijawab tampilan
    // datar: apa yang menonjol, apa yang bertabrakan, seberapa tinggi board ini.
    //
    // Sengaja tanpa pustaka 3D. Proyeksi sendiri cukup untuk kebutuhan itu, jalan
    // tanpa unduhan tambahan, dan tidak menambah bobot halaman.

    a.putar3d = () => {
        // Putaran pandangan saat diseret di mode 3D.
        return { yaw: a.yaw, pitch: a.pitch }
    }

    a.proyeksi = (x, y, z) => {
        const cy = Math.cos(a.yaw)
        const sy = Math.sin(a.yaw)
        const cp = Math.cos(a.pitch)
        const sp = Math.sin(a.pitch)
        // titik tengah board jadi pusat putaran
        const cx = x - a.b.outline.lebar / 2
        const cyy = y - a.b.outline.tinggi / 2
        const rx = cx * cy - cyy * sy
        const ry = cx * sy + cyy * cy
        const layarX = rx * a.skala3d
        const layarY = ry * cp * a.skala3d - z * sp * a.skala3d
        return { x: layarX + a.pusat3d.x, y: layarY + a.pusat3d.y }
    }

    a.gambar3d = () => {
        const b = a.b
        if (b === null || b.outline === undefined) return
        const ctx = kanvas.getContext('2d')
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.fillStyle = '#0a0c11'
        ctx.fillRect(0, 0, kanvas.width, kanvas.height)
        ctx.setTransform(a.rasio, 0, 0, a.rasio, 0, 0)

        const lebar = b.outline.lebar
        const tinggi = b.outline.tinggi
        const tebal = 1.6
        const P = a.proyeksi

        // sisi papan dulu, supaya permukaan atas menimpanya
        const bawah = [
            P(0, 0, 0), P(lebar, 0, 0), P(lebar, tinggi, 0), P(0, tinggi, 0),
        ]
        ctx.fillStyle = '#0a2a1e'
        ctx.beginPath()
        ctx.moveTo(bawah[0].x, bawah[0].y)
        for (let i = 1; i < bawah.length; i += 1) ctx.lineTo(bawah[i].x, bawah[i].y)
        ctx.closePath()
        ctx.fill()

        // sisi muka papan
        const atasDepan = [P(0, tinggi, -tebal), P(lebar, tinggi, -tebal)]
        const bawahDepan = [P(0, tinggi, 0), P(lebar, tinggi, 0)]
        ctx.fillStyle = '#0d3b2a'
        ctx.beginPath()
        ctx.moveTo(atasDepan[0].x, atasDepan[0].y)
        ctx.lineTo(atasDepan[1].x, atasDepan[1].y)
        ctx.lineTo(bawahDepan[1].x, bawahDepan[1].y)
        ctx.lineTo(bawahDepan[0].x, bawahDepan[0].y)
        ctx.closePath()
        ctx.fill()

        // permukaan atas
        const atas = [
            P(0, 0, -tebal), P(lebar, 0, -tebal), P(lebar, tinggi, -tebal), P(0, tinggi, -tebal),
        ]
        ctx.fillStyle = '#14543a'
        ctx.strokeStyle = '#5fd39a'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(atas[0].x, atas[0].y)
        for (let i = 1; i < atas.length; i += 1) ctx.lineTo(atas[i].x, atas[i].y)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        // jalur: digambar di permukaan, mengikuti proyeksi
        for (const lap of ['B', 'F']) {
            if (lap === 'B' && a.tampilBawah === false) continue
            if (lap === 'F' && a.tampilAtas === false) continue
            const zLapis = lap === 'F' ? -tebal - 0.04 : -0.02
            for (const n of b.nets) {
                for (const t of n.trace) {
                    if (t.layer !== lap) continue
                    ctx.strokeStyle = lap === 'F' ? '#e8b55c' : '#5b8dee'
                    ctx.lineWidth = Math.max(1, t.lebar * a.skala3d * 0.55)
                    ctx.lineCap = 'round'
                    ctx.beginPath()
                    let i = 0
                    while (i < t.pts.length) {
                        const q = P(t.pts[i].x, t.pts[i].y, zLapis)
                        if (i === 0) ctx.moveTo(q.x, q.y)
                        else ctx.lineTo(q.x, q.y)
                        i += 1
                    }
                    ctx.stroke()
                }
            }
        }

        // via: cincin kecil di antara kedua sisi, jadi terlihat menembus papan
        for (const n of b.nets) {
            for (const v of n.via) {
                const atasVia = P(v.x, v.y, -tebal - 0.05)
                const bawahVia = P(v.x, v.y, 0.02)
                ctx.strokeStyle = '#c3cbdb'
                ctx.lineWidth = Math.max(2, v.diameter * a.skala3d * 0.5)
                ctx.beginPath()
                ctx.moveTo(atasVia.x, atasVia.y)
                ctx.lineTo(bawahVia.x, bawahVia.y)
                ctx.stroke()
                ctx.fillStyle = '#0f1115'
                ctx.beginPath()
                ctx.arc(atasVia.x, atasVia.y, Math.max(1.2, v.bor / 2 * a.skala3d * 0.5), 0, Math.PI * 2)
                ctx.fill()
            }
        }

        // komponen: kotak dengan tinggi ASLI dari pustaka
        for (const p of b.parts) {
            const lb = lib_get(p.lib)
            if (lb === null) continue
            const h = lb.tinggi || 1
            const hw = lb.w / 2
            const hh = lb.h / 2
            const sudut = [
                [p.x - hw, p.y - hh], [p.x + hw, p.y - hh],
                [p.x + hw, p.y + hh], [p.x - hw, p.y + hh],
            ]
            const kaki = []
            const kepala = []
            for (const c of sudut) {
                kaki.push(P(c[0], c[1], -tebal))
                kepala.push(P(c[0], c[1], -tebal - h))
            }
            // badan komponen
            ctx.fillStyle = '#26303f'
            ctx.strokeStyle = '#8fa0bb'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(kepala[0].x, kepala[0].y)
            for (let i = 1; i < kepala.length; i += 1) ctx.lineTo(kepala[i].x, kepala[i].y)
            ctx.closePath()
            ctx.fill()
            ctx.stroke()
            // satu sisi supaya terlihat berketinggian
            ctx.fillStyle = '#1b2431'
            ctx.beginPath()
            ctx.moveTo(kepala[3].x, kepala[3].y)
            ctx.lineTo(kepala[2].x, kepala[2].y)
            ctx.lineTo(kaki[2].x, kaki[2].y)
            ctx.lineTo(kaki[3].x, kaki[3].y)
            ctx.closePath()
            ctx.fill()
            ctx.stroke()
            // pad di permukaan
            for (const pd of semua_pad(p, lb)) {
                const c = P(pd.x, pd.y, -tebal - 0.02)
                ctx.fillStyle = '#f0d78c'
                ctx.beginPath()
                ctx.arc(c.x, c.y, Math.max(1.5, Math.max(pd.w, pd.h) / 2 * a.skala3d * 0.5), 0, Math.PI * 2)
                ctx.fill()
            }
            // penanda
            const lt = P(p.x, p.y, -tebal - h - 0.4)
            ctx.fillStyle = '#cfe0ff'
            ctx.font = '10px ui-sans-serif, system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(p.ref, lt.x, lt.y)
            ctx.textAlign = 'left'
        }

        // keterangan sudut pandang
        ctx.fillStyle = 'rgba(226,232,240,0.6)'
        ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
        ctx.fillText('Tampak 3D · seret untuk memutar', 12, 20)
    }

    // ---------- menggambar ----------

    a.gambar = () => {
        const b = a.b
        // Diperiksa SEBELUM apa pun yang lain. Versi sebelumnya memeriksa `b` setelah
        // membaca `b.outline` di baris kedua paskan(), dan pemasangan pertama alat ini
        // terjadi saat board belum terpasang, jadi halamannya mati dengan
        // "Cannot read properties of undefined (reading 'lebar')".
        if (b === null || b === undefined || b.outline === undefined) return
        if (a.tampil3d) {
            a.gambar3d()
            return
        }
        const ctx = kanvas.getContext('2d')
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.fillStyle = W.bg
        ctx.fillRect(0, 0, kanvas.width, kanvas.height)
        ctx.setTransform(a.rasio, 0, 0, a.rasio, 0, 0)

        const kiri = a.keLayar(0, 0)
        const kanan = a.keLayar(b.outline.lebar, b.outline.tinggi)
        const wBoard = kanan.x - kiri.x
        const hBoard = kanan.y - kiri.y

        // kisi
        if (a.tampilKisi) {
        ctx.strokeStyle = W.kisi
        ctx.lineWidth = 1
        ctx.beginPath()
        let x = 0
        while (x <= b.outline.lebar + 0.001) {
            const p = a.keLayar(x, 0)
            ctx.moveTo(p.x, kiri.y)
            ctx.lineTo(p.x, kanan.y)
            x += a.kisi
        }
        let y = 0
        while (y <= b.outline.tinggi + 0.001) {
            const p = a.keLayar(0, y)
            ctx.moveTo(kiri.x, p.y)
            ctx.lineTo(kanan.x, p.y)
            y += a.kisi
        }
        ctx.stroke()
        }

        // badan board
        ctx.fillStyle = W.board
        ctx.strokeStyle = W.tepi
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.rect(kiri.x, kiri.y, wBoard, hBoard)
        ctx.fill()
        ctx.stroke()

        // Zona tembaga: digambar lebih dulu, di bawah semua tembaga lain.
        //
        // Bidangnya tembus pandang supaya apa yang ada di atasnya tetap terbaca. Ini
        // yang membuat board dua lapis dengan bidang ground bisa dibaca di layar,
        // bukan hanya di berkas Gerber.
        const lapZona = []
        if (a.tampilAtas) lapZona.push('F')
        if (a.tampilBawah) lapZona.push('B')
        for (const lap of lapZona) {
        for (const z of zona_untuk(b, lap)) {
            const p1 = a.keLayar(z.x1, z.y1)
            const p2 = a.keLayar(z.x2, z.y2)
            ctx.fillStyle = z.layer === 'F' ? 'rgba(232,181,92,0.20)' : 'rgba(91,141,238,0.20)'
            ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y)
            ctx.strokeStyle = z.layer === 'F' ? 'rgba(232,181,92,0.55)' : 'rgba(91,141,238,0.55)'
            ctx.lineWidth = 1
            ctx.setLineDash([3, 3])
            ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y)
            ctx.setLineDash([])
            // pad yang tersambung ke zona ini ditandai: itu yang membuat ground nyata
            for (const sp of zona_sambung(b, z)) {
                const c = a.keLayar(sp.x, sp.y)
                ctx.strokeStyle = '#6ee7a8'
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.arc(c.x, c.y, Math.max(4, Math.max(sp.w, sp.h) / 2 * a.skala + 2), 0, Math.PI * 2)
                ctx.stroke()
            }
        }
        }

        // Garis bantu ratsnest: sambungan yang BELUM dibuat.
        //
        // Digambar tipis dan putus-putus, dan selalu DI BAWAH jalur sungguhan. Ini
        // yang membuat alat PCB bisa dipakai merutekan: orang tahu apa yang masih harus
        // disambung tanpa membuka daftar net.
        for (const r of a.rats) {
            const p1 = a.keLayar(r.x1, r.y1)
            const p2 = a.keLayar(r.x2, r.y2)
            const tersorot = a.sorot === '' || a.sorot === r.net
            if (!tersorot) continue
            ctx.strokeStyle = a.sorot === r.net ? '#ffd479' : 'rgba(226,232,240,0.42)'
            ctx.lineWidth = 1
            ctx.setLineDash([4, 4])
            ctx.beginPath()
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.stroke()
            ctx.setLineDash([])
        }

        // jalur, lapisan bawah dulu
        for (const lap of ['B', 'F']) {
            if (lap === 'B' && a.tampilBawah === false) continue
            if (lap === 'F' && a.tampilAtas === false) continue
            for (const n of b.nets) {
                for (const t of n.trace) {
                    if (t.layer !== lap) continue
                    const nyala = a.sorot === '' || a.sorot === n.nama
                    ctx.strokeStyle = lap === 'F' ? WARNA_LAPISAN.F : WARNA_LAPISAN.B
                    if (!nyala) {
                        ctx.strokeStyle = 'rgba(148,163,184,0.18)'
                    }
                    ctx.lineWidth = Math.max(1, t.lebar * a.skala)
                    ctx.lineCap = 'round'
                    ctx.lineJoin = 'round'
                    ctx.beginPath()
                    let i = 0
                    while (i < t.pts.length) {
                        const p = a.keLayar(t.pts[i].x, t.pts[i].y)
                        if (i === 0) ctx.moveTo(p.x, p.y)
                        else ctx.lineTo(p.x, p.y)
                        i += 1
                    }
                    ctx.stroke()
                }
            }
        }

        // jalur yang sedang digambar
        if (a.jalur !== null) {
            ctx.strokeStyle = W.jalurBaru
            ctx.lineWidth = Math.max(1, a.jalur.lebar * a.skala)
            ctx.lineCap = 'round'
            ctx.beginPath()
            let i = 0
            while (i < a.jalur.pts.length) {
                const p = a.keLayar(a.jalur.pts[i].x, a.jalur.pts[i].y)
                if (i === 0) ctx.moveTo(p.x, p.y)
                else ctx.lineTo(p.x, p.y)
                i += 1
            }
            ctx.stroke()
        }

        // komponen
        for (const p of b.parts) {
            const lb = lib_get(p.lib)
            const pilih = a.terpilih === p.ref
            const atas = a.hover === p.ref
            if (lb !== null) {
                const k = a.keLayar(p.x - lb.w / 2, p.y - lb.h / 2)
                const t = a.keLayar(p.x + lb.w / 2, p.y + lb.h / 2)
                if (pilih || atas) {
                    ctx.fillStyle = pilih ? 'rgba(124,156,255,0.16)' : 'rgba(148,163,184,0.10)'
                    ctx.fillRect(k.x, k.y, t.x - k.x, t.y - k.y)
                }
                ctx.strokeStyle = pilih ? W.pilih : W.silk
                ctx.lineWidth = pilih ? 2 : 1
                ctx.strokeRect(k.x, k.y, t.x - k.x, t.y - k.y)

                for (const pd of semua_pad(p, lb)) {
                    const c = a.keLayar(pd.x, pd.y)
                    ctx.fillStyle = W.pad
                    ctx.beginPath()
                    ctx.arc(c.x, c.y, Math.max(1.6, Math.max(pd.w, pd.h) / 2 * a.skala), 0, Math.PI * 2)
                    ctx.fill()
                    if (pd.jenis === 'tht') {
                        ctx.fillStyle = W.bg
                        ctx.beginPath()
                        ctx.arc(c.x, c.y, Math.max(0.8, pd.bor / 2 * a.skala), 0, Math.PI * 2)
                        ctx.fill()
                    }
                }
                ctx.fillStyle = pilih ? '#cfe0ff' : W.teks
                ctx.font = Math.max(10, Math.min(16, 2.2 * a.skala)) + 'px ui-sans-serif, system-ui, sans-serif'
                ctx.fillText(p.ref, k.x, k.y - 4)
                if (pilih) {
                    ctx.fillStyle = 'rgba(207,224,255,0.7)'
                    ctx.font = '10px ui-sans-serif, system-ui, sans-serif'
                    ctx.fillText((p.rot || 0) + '° ' + (p.side === 'B' ? 'bawah' : 'atas'), k.x, t.y + 12)
                }
            }
        }

        // via
        if (a.tampilVia) {
        for (const n of b.nets) {
            for (const v of n.via) {
                const c = a.keLayar(v.x, v.y)
                ctx.fillStyle = W.via
                ctx.beginPath()
                ctx.arc(c.x, c.y, Math.max(1.6, v.diameter / 2 * a.skala), 0, Math.PI * 2)
                ctx.fill()
                ctx.fillStyle = W.bg
                ctx.beginPath()
                ctx.arc(c.x, c.y, Math.max(0.8, v.bor / 2 * a.skala), 0, Math.PI * 2)
                ctx.fill()
            }
        }
        }

        // penanda masalah dari pemeriksaan aturan.
        //
        // Ditandai di kanvas, bukan hanya didaftar di panel: masalah PCB hampir selalu
        // soal TEMPAT (dua tembaga terlalu dekat di titik tertentu), jadi angka di daftar
        // tidak berguna tanpa melihatnya di papan.
        for (const t of a.tanda) {
            if (t.x === undefined || t.y === undefined) continue
            if (t.x === 0 && t.y === 0) continue
            const c = a.keLayar(t.x, t.y)
            ctx.strokeStyle = t.tingkat === 'gagal' ? '#f08a72' : '#e8c06a'
            ctx.lineWidth = 1.6
            ctx.beginPath()
            ctx.arc(c.x, c.y, 9, 0, Math.PI * 2)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(c.x - 13, c.y)
            ctx.lineTo(c.x - 5, c.y)
            ctx.moveTo(c.x + 5, c.y)
            ctx.lineTo(c.x + 13, c.y)
            ctx.moveTo(c.x, c.y - 13)
            ctx.lineTo(c.x, c.y - 5)
            ctx.moveTo(c.x, c.y + 5)
            ctx.lineTo(c.x, c.y + 13)
            ctx.stroke()
        }

        // simpul jalur yang sedang digambar
        if (a.jalur !== null) {
            for (const q of a.jalur.pts) {
                const c = a.keLayar(q.x, q.y)
                ctx.fillStyle = W.jalurBaru
                ctx.beginPath()
                ctx.arc(c.x, c.y, 3, 0, Math.PI * 2)
                ctx.fill()
            }
        }

        // alat ukur: garis antara dua titik dan jaraknya
        if (a.ukur !== null) {
            const p1 = a.keLayar(a.ukur.x1, a.ukur.y1)
            const p2 = a.keLayar(a.ukur.x2, a.ukur.y2)
            ctx.strokeStyle = '#7c9cff'
            ctx.lineWidth = 1.5
            ctx.setLineDash([5, 3])
            ctx.beginPath()
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.stroke()
            ctx.setLineDash([])
            const dx = a.ukur.x2 - a.ukur.x1
            const dy = a.ukur.y2 - a.ukur.y1
            const d = Math.sqrt(dx * dx + dy * dy)
            const tengah = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
            const label = (Math.round(d * 100) / 100) + ' mm'
            ctx.font = '12px ui-sans-serif, system-ui, sans-serif'
            const w = ctx.measureText(label).width
            ctx.fillStyle = 'rgba(12,14,19,0.9)'
            ctx.fillRect(tengah.x - w / 2 - 5, tengah.y - 20, w + 10, 18)
            ctx.fillStyle = '#cfe0ff'
            ctx.fillText(label, tengah.x - w / 2, tengah.y - 7)
        }

        // persegi zona yang sedang diseret
        if (a.zonaBaru !== null) {
            const p1 = a.keLayar(a.zonaBaru.x1, a.zonaBaru.y1)
            const p2 = a.keLayar(a.zonaBaru.x2, a.zonaBaru.y2)
            ctx.fillStyle = 'rgba(110,231,168,0.22)'
            ctx.fillRect(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y),
                         Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y))
            ctx.strokeStyle = '#6ee7a8'
            ctx.lineWidth = 1.5
            ctx.setLineDash([4, 3])
            ctx.strokeRect(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y),
                           Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y))
            ctx.setLineDash([])
        }

        // penunjuk kursor
        if (a.kursor !== null && a.mode === 'jalur') {
            const c = a.keLayar(a.kursor.x, a.kursor.y)
            ctx.strokeStyle = 'rgba(124,156,255,0.5)'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.arc(c.x, c.y, 4, 0, Math.PI * 2)
            ctx.stroke()
        }
    }

    // ---------- pemilihan ----------

    a.bolehPilih = (jenis) => {
        // Selection filter: membatasi apa yang bisa DIPILIH di kanvas.
        //
        // Hanya berlaku untuk mode pilih. Kalau berlaku juga di mode lain, menggambar
        // jalur atau zona jadi mustahil begitu saringnya bukan "semua" — dan itu
        // membuat alatnya rusak, bukan berguna.
        if (a.saring === '') return true
        if (a.mode !== 'pilih') return true
        if (jenis === 'komponen') return a.saring !== 'jalur'
        if (jenis === 'jalur') return a.saring === 'jalur'
        return true
    }

    a.komponenDi = (p) => {
        if (a.bolehPilih('komponen') === false) return null
        // Dari yang paling atas ke bawah, supaya yang tampak di atas itu terpilih.
        let i = a.b.parts.length - 1
        while (i >= 0) {
            const q = a.b.parts[i]
            const lb = lib_get(q.lib)
            if (lb !== null) {
                if (Math.abs(p.x - q.x) <= lb.w / 2 + 0.3 &&
                    Math.abs(p.y - q.y) <= lb.h / 2 + 0.3) {
                    return q.ref
                }
            }
            i -= 1
        }
        return null
    }

    // ---------- masukan ----------

    let geserKanvas = null
    let sedangPindah = null

    kanvas.addEventListener('mousedown', (ev) => {
        if (ev.button === 1 || ev.shiftKey) {
            geserKanvas = { x: ev.clientX - a.geserX, y: ev.clientY - a.geserY }
            kanvas.style.cursor = 'grabbing'
            return
        }
        if (a.tampil3d) {
            // Di tampilan 3D, seret berarti memutar pandangan.
            geserKanvas = { x: ev.clientX, y: ev.clientY, putar3d: true }
            return
        }
        const p = a.titik(ev)
        const st = G.status()

        if (a.mode === 'via') {
            // Satu klik menaruh via di net aktif. Via adalah cara pindah lapisan di
            // tengah jalur, dan di board dua lapis itu alat yang paling sering dipakai
            // setelah gambar jalur.
            const q = a.snapTitik(p)
            G.tambahVia(q.x, q.y)
            return
        }
        if (a.mode === 'zona') {
            // Seret persegi untuk membuat bidang tembaga. Sudut pertama di sini,
            // sudut kedua saat tetikus dilepas.
            const q = a.snapTitik(p)
            a.zonaBaru = { x1: q.x, y1: q.y, x2: q.x, y2: q.y, net: st.net, layer: st.layer }
            a.gambar()
            return
        }
        if (a.mode === 'hapus') {
            const ref = a.komponenDi(p)
            if (ref !== null) G.hapusRef(ref)
            return
        }
        if (a.mode === 'ukur') {
            const q = a.snapTitik(p)
            if (a.ukur === null) {
                // Titik pertama: mulai mengukur.
                a.ukur = { x1: q.x, y1: q.y, x2: q.x, y2: q.y }
                G.pesan('Titik pertama ' + bolat(q.x) + ', ' + bolat(q.y) + ' mm. Klik titik kedua.')
            } else {
                // Titik kedua: laporkan jaraknya, lalu selesai.
                const dx = q.x - a.ukur.x1
                const dy = q.y - a.ukur.y1
                const d = bolat(Math.sqrt(dx * dx + dy * dy))
                G.pesan('Jarak ' + d + ' mm (dx ' + bolat(dx) + ', dy ' + bolat(dy) + ')')
                a.ukur = null
            }
            a.gambar()
            return
        }
        if (a.mode === 'jalur') {
            const q = a.snapTitik(p)
            // Kalau titik yang diklik sama dengan titik terakhir, itu tanda selesai.
            // Ini kebiasaan di alat PCB, dan lebih mudah diandalkan daripada klik
            // ganda: di layar sentuh, satu ketukan sering tidak terkirim sebagai ganda.
            if (a.jalur !== null) {
                const t = a.jalur.pts[a.jalur.pts.length - 1]
                if (Math.abs(t.x - q.x) < 0.001 && Math.abs(t.y - q.y) < 0.001) {
                    a.selesaiJalur()
                    return
                }
            }
            const pts = a.jalur !== null ? a.jalur.pts.slice() : []
            pts.push(q)
            a.jalur = { pts: pts, lebar: st.lebar, layer: st.layer, net: st.net }
            a.gambar()
            return
        }
        const ref = a.komponenDi(p)
        a.terpilih = ref
        G.pilih(ref)
        if (ref !== null) {
            const q = a.cariPart(ref)
            if (q !== null) {
                sedangPindah = { ref: ref, dx: q.x - p.x, dy: q.y - p.y }
            }
        }
        a.gambar()
    })

    kanvas.addEventListener('mousemove', (ev) => {
        const p = a.titik(ev)
        const s = a.snapTitik(p)
        a.kursor = s
        // Baris status butuh posisi kursor; dikirim lewat callback supaya halaman tidak
        // menyimpan nilai ini di state setiap gerakan (itu memicu render ulang penuh).
        G.koor(s)
        if (geserKanvas !== null) {
            if (geserKanvas.putar3d) {
                a.yaw += (ev.clientX - geserKanvas.x) * 0.01
                a.pitch = Math.max(0.15, Math.min(1.5, a.pitch + (ev.clientY - geserKanvas.y) * 0.008))
                geserKanvas.x = ev.clientX
                geserKanvas.y = ev.clientY
                a.gambar()
                return
            }
            a.geserX = ev.clientX - geserKanvas.x
            a.geserY = ev.clientY - geserKanvas.y
            a.gambar()
            return
        }
        if (sedangPindah !== null) {
            // Geseran digambar langsung supaya mulus; halaman baru diberi tahu saat
            // tetikus dilepas, jadi satu pembaruan state per geseran.
            const q = a.cariPart(sedangPindah.ref)
            if (q !== null) {
                q.x = s.x + sedangPindah.dx
                q.y = s.y + sedangPindah.dy
            }
            a.gambar()
            return
        }
        if (a.mode === 'zona' && a.zonaBaru !== null) {
            a.zonaBaru.x2 = s.x
            a.zonaBaru.y2 = s.y
            a.gambar()
            return
        }
        if (a.mode === 'ukur' && a.ukur !== null) {
            a.ukur.x2 = s.x
            a.ukur.y2 = s.y
            a.gambar()
            return
        }
        if (a.mode === 'jalur' && a.jalur !== null) {
            const pts = a.jalur.pts.slice()
            pts[pts.length - 1] = s
            pts.push(s)
            a.jalur.pts = pts.slice(0, pts.length - 1)
            a.jalur.pts.push(s)
            a.gambar()
            return
        }
        const ref = a.komponenDi(p)
        if (ref !== a.hover) a.hover = ref
        a.gambar()
    })

    kanvas.addEventListener('mouseup', () => {
        if (geserKanvas !== null) {
            geserKanvas = null
            kanvas.style.cursor = a.mode === 'jalur' ? 'crosshair' : 'default'
            return
        }
        if (a.zonaBaru !== null) {
            const z = a.zonaBaru
            a.zonaBaru = null
            a.gambar()
            G.gambarZona(z.net, z.layer, z.x1, z.y1, z.x2, z.y2)
            return
        }
        if (sedangPindah !== null) {
            const q = a.cariPart(sedangPindah.ref)
            const ref = sedangPindah.ref
            sedangPindah = null
            if (q !== null) G.pindah(ref, q.x, q.y)
        }
    })

    kanvas.addEventListener('mouseleave', () => {
        if (geserKanvas !== null) geserKanvas = null
        if (sedangPindah !== null) {
            const q = a.cariPart(sedangPindah.ref)
            const ref = sedangPindah.ref
            sedangPindah = null
            if (q !== null) G.pindah(ref, q.x, q.y)
        }
        a.hover = null
        a.kursor = null
        a.gambar()
    })

    kanvas.addEventListener('dblclick', () => a.selesaiJalur())
    // Tombol Escape membatalkan jalur yang sedang digambar; Enter menyelesaikannya.
    a.batalkanJalur = () => {
        a.jalur = null
        a.gambar()
    }
    kanvas.addEventListener('contextmenu', (ev) => {
        ev.preventDefault()
        a.selesaiJalur()
    })

    kanvas.addEventListener('wheel', (ev) => {
        ev.preventDefault()
        const r = kanvas.getBoundingClientRect()
        const mx = ev.clientX - r.left
        const my = ev.clientY - r.top
        const sebelum = a.keBoard(mx, my)
        a.skala = Math.max(1.5, Math.min(160, a.skala * (ev.deltaY < 0 ? 1.12 : 1 / 1.12)))
        const sesudah = a.keBoard(mx, my)
        a.geserX += (sesudah.x - sebelum.x) * a.skala
        a.geserY += (sesudah.y - sebelum.y) * a.skala
        a.gambar()
    }, { passive: false })

    // sentuh: satu jari menggambar atau memilih, dua jari menggeser dan memperbesar
    let jari = []
    kanvas.addEventListener('touchstart', (ev) => {
        jari = []
        for (const t of ev.touches) jari.push({ x: t.clientX, y: t.clientY })
        if (ev.touches.length === 1) {
            const f = new MouseEvent('mousedown', {
                bubbles: true, button: 0,
                clientX: ev.touches[0].clientX, clientY: ev.touches[0].clientY,
            })
            kanvas.dispatchEvent(f)
        }
    }, { passive: true })

    kanvas.addEventListener('touchmove', (ev) => {
        if (ev.touches.length === 2 && jari.length === 2) {
            ev.preventDefault()
            const a0 = jari[0]
            const b0 = jari[1]
            const a1 = { x: ev.touches[0].clientX, y: ev.touches[0].clientY }
            const b1 = { x: ev.touches[1].clientX, y: ev.touches[1].clientY }
            const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y)
            const d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y)
            const r = kanvas.getBoundingClientRect()
            const cx = (a1.x + b1.x) / 2 - r.left
            const cy = (a1.y + b1.y) / 2 - r.top
            const sebelum = a.keBoard(cx, cy)
            if (d0 > 0) a.skala = Math.max(1.5, Math.min(160, a.skala * (d1 / d0)))
            a.geserX += a1.x - a0.x
            a.geserY += a1.y - a0.y
            const sesudah = a.keBoard(cx, cy)
            a.geserX += (sesudah.x - sebelum.x) * a.skala
            a.geserY += (sesudah.y - sebelum.y) * a.skala
            jari[0] = a1
            jari[1] = b1
            a.gambar()
        } else if (ev.touches.length === 1 && jari.length === 1) {
            const f = new MouseEvent('mousemove', {
                bubbles: true,
                clientX: ev.touches[0].clientX, clientY: ev.touches[0].clientY,
            })
            kanvas.dispatchEvent(f)
            jari[0] = { x: ev.touches[0].clientX, y: ev.touches[0].clientY }
        }
    }, { passive: false })

    kanvas.addEventListener('touchend', (ev) => {
        if (ev.touches.length === 0) {
            kanvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
            jari = []
        }
    }, { passive: true })

    // ---------- perintah dari halaman ----------

    a.selesaiJalur = () => {
        if (a.jalur === null) return
        const j = a.jalur
        a.jalur = null
        const pts = []
        for (const q of j.pts) {
            if (pts.length === 0) {
                pts.push(q)
            } else {
                const s = pts[pts.length - 1]
                if (Math.abs(q.x - s.x) > 0.001 || Math.abs(q.y - s.y) > 0.001) pts.push(q)
            }
        }
        a.gambar()
        if (pts.length < 2) {
            G.pesan('Jalur butuh minimal dua titik.')
            return
        }
        G.gambarJalur(j.net, j.layer, j.lebar, pts)
    }

    a.setMode = (m) => {
        if (a.mode === 'jalur' && m !== 'jalur') a.selesaiJalur()
        if (a.mode === 'zona' && m !== 'zona') a.zonaBaru = null
        a.mode = m
        kanvas.style.cursor = (m === 'jalur' || m === 'zona' || m === 'via') ? 'crosshair'
            : (m === 'hapus' ? 'not-allowed' : 'default')
    }

    a.setBoard = (b) => {
        a.b = b
        a.jalur = null
        if (a.terpilih !== null && a.cariPart(a.terpilih) === null) a.terpilih = null
        a.gambar()
    }

    a.keTitikTengah = () => a.paskan()

    a.set3d = (nyala) => {
        a.tampil3d = nyala
        if (nyala) {
            // Paskan skala supaya seluruh board masuk layar pada sudut awal.
            const b = a.b
            const m = Math.max(b.outline.lebar, b.outline.tinggi)
            a.skala3d = Math.min((a.lebarCss - 40) / m, (a.tinggiCss - 40) / m) * 0.85
            a.pusat3d = { x: a.lebarCss / 2, y: a.tinggiCss / 2 }
        }
        a.gambar()
    }

    a.setKisi = (g, snap) => {
        a.kisi = g
        a.snap = snap
        a.gambar()
    }

    a.setTampil = (atas, bawah, via, kisi) => {
        a.tampilAtas = atas
        a.tampilBawah = bawah
        a.tampilVia = via
        a.tampilKisi = kisi
        a.gambar()
    }

    a.setTanda = (t) => {
        a.tanda = t || []
        a.gambar()
    }

    a.setRats = (r) => {
        a.rats = r || []
        a.gambar()
    }

    a.setSaring = (jenis) => {
        a.saring = jenis || ''
        a.gambar()
    }

    a.setSorot = (nama) => {
        a.sorot = nama || ''
        a.gambar()
    }

    a.setUkur = (u) => {
        a.ukur = u
        a.gambar()
    }

    a.setWarnaLapisan = (lap, warna) => {
        WARNA_LAPISAN[lap] = warna
        a.gambar()
    }

    return a
}
