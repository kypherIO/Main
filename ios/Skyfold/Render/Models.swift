import Foundation
import SkyfoldCore

/// Procedural 3D asset library. Every model faces +z (its "front" toward the road).
enum Models {
    static let y0: Float = 0.014   // top of the lot pad

    static func pick<T>(_ a: [T], _ i: Int) -> T { a[((i % a.count) + a.count) % a.count] }

    static let resWalls: [UInt32] = [0xf3ead8, 0xe4edf2, 0xf4d6c2, 0xdbe8d2, 0xefe0b4, 0xddd5ea]
    static let roofs: [UInt32] = [0xa8483a, 0x4b5664, 0x6e4636, 0x37604f, 0x86634a]
    static let brick: [UInt32] = [0xa65a43, 0x8f4c3b, 0xb77457]
    static let glassTint: [UInt32] = [0xffffff, 0xd6efff, 0xcfe8dc, 0xf3e4cf]
    static let indWalls: [UInt32] = [0xc9cdd1, 0x9fb3c5, 0xd4c8ae, 0xb6c1ad]
    static let neon: [UInt32] = [0xff3d7f, 0x38d9ff, 0xffd23d, 0x7dff6a, 0xb06bff, 0xff8a3d]
    static let lawn: UInt32 = 0x6d9a4a, concrete: UInt32 = 0xa19f99, asphaltLot: UInt32 = 0x55575b

    // MARK: helpers
    static func lot(_ b: MeshBuilder, _ c: UInt32, _ size: Float = 1) { b.box(0, 0, 0, 0.98 * size, y0, 0.98 * size, c) }
    static func bush(_ b: MeshBuilder, _ x: Float, _ z: Float, _ r: Float, _ c: UInt32 = 0x4f8a3a) { b.sphere(x, y0, z, r, 6, c, squash: 0.85) }
    static func smallTree(_ b: MeshBuilder, _ x: Float, _ z: Float, _ s: Float = 1, _ c: UInt32 = 0x5a9a40) {
        b.cyl(x, y0, z, 0.02 * s, 0.1 * s, 5, 0x6b4a33)
        b.sphere(x, y0 + 0.07 * s, z, 0.1 * s, 7, c, squash: 1.1)
    }
    static func acUnits(_ b: MeshBuilder, _ r: inout SplitMix, _ y: Float, _ w: Float, _ d: Float, _ n: Int = 3) {
        for _ in 0..<n { b.box((r.next() - 0.5) * w, y, (r.next() - 0.5) * d, 0.08, 0.05, 0.06, 0xc7c9cb) }
    }
    static func parapet(_ b: MeshBuilder, _ x: Float, _ y: Float, _ z: Float, _ w: Float, _ d: Float, _ c: UInt32, _ t: Float = 0.025, _ h: Float = 0.04) {
        b.box(x, y, z + d / 2 - t / 2, w, h, t, c)
        b.box(x, y, z - d / 2 + t / 2, w, h, t, c)
        b.box(x + w / 2 - t / 2, y, z, t, h, d - 2 * t, c)
        b.box(x - w / 2 + t / 2, y, z, t, h, d - 2 * t, c)
    }
    static func beacon(_ b: MeshBuilder, _ x: Float, _ y: Float, _ z: Float) {
        b.cyl(x, y, z, 0.006, 0.18, 4, 0x888888)
        b.sphere(x, y + 0.18, z, 0.022, 6, 0xff2a2a, squash: 1, .neon)
    }
    static func side(_ m: Mat, top: UInt32? = nil, topMat: Mat = .plain, vOff: Float = 0) -> BoxOpts {
        BoxOpts(side: m, topMat: topMat, top: top.map(rgb), vOff: vOff)
    }

    // MARK: residential
    static func res(_ level: Int, _ v: Int) -> MeshBuilder {
        let b = MeshBuilder()
        var R = SplitMix(seed: UInt64(100 * level + v))
        switch level {
        case 1:
            let wall = pick(resWalls, v * 2), roof = pick(roofs, v)
            lot(b, lawn)
            b.box(-0.06, y0, 0.34, 0.12, 0.004, 0.3, 0xd4ccbb)
            switch v {
            case 0:
                b.box(0, y0, -0.06, 0.56, 0.3, 0.44, wall, side(.wres, vOff: 0.03))
                b.gable(0, y0 + 0.3, -0.06, 0.64, 0.22, 0.52, roof, end: wall)
                b.box(0.17, y0 + 0.34, -0.16, 0.07, 0.22, 0.07, 0x7b5546)
                b.box(-0.06, y0, 0.165, 0.11, 0.19, 0.02, 0x5a3a2a)
                b.box(0.32, y0, 0.22, 0.2, 0.004, 0.5, 0x9b9a95)
            case 1:
                b.box(-0.08, y0, -0.08, 0.5, 0.3, 0.4, wall, side(.wres, vOff: 0.03))
                b.gable(-0.08, y0 + 0.3, -0.08, 0.56, 0.2, 0.46, roof, end: wall)
                b.box(0.26, y0, 0.05, 0.26, 0.24, 0.42, wall)
                b.gable(0.26, y0 + 0.24, 0.05, 0.3, 0.14, 0.46, roof, alongZ: true, end: wall)
                b.box(0.26, y0, 0.265, 0.2, 0.17, 0.012, 0xe9e6df)
                b.box(-0.06, y0, 0.125, 0.1, 0.19, 0.02, 0x3d5a7a)
            case 2:
                b.box(-0.04, y0, -0.06, 0.6, FLOOR * 2, 0.42, 0xf1f1ee, side(.wres))
                b.box(0.18, y0 + FLOOR, 0.06, 0.32, FLOOR, 0.36, 0x9b7454)
                b.box(0.18, y0 + FLOOR + 0.03, 0.245, 0.26, 0.15, 0.012, 0xffffff, side(.woff))
                b.box(-0.14, y0, 0.155, 0.28, 0.18, 0.012, 0xffffff, side(.woff))
                parapet(b, -0.04, y0 + FLOOR * 2, -0.06, 0.6, 0.42, 0xd9d9d6)
                b.box(-0.3, y0, 0.3, 0.26, 0.012, 0.22, 0x4fb3d9)
                b.box(-0.3, y0, 0.3, 0.3, 0.008, 0.26, 0xe8e2d4)
            default:
                b.box(0, y0, -0.08, 0.5, 0.28, 0.42, wall, side(.wres, vOff: 0.03))
                b.gable(0, y0 + 0.28, -0.08, 0.5, 0.2, 0.5, roof, alongZ: true, end: wall)
                b.box(0, y0, 0.19, 0.5, 0.02, 0.14, 0xb89a7a)
                b.box(0, y0 + 0.2, 0.19, 0.54, 0.02, 0.16, roof)
                for px: Float in [-0.22, 0, 0.22] { b.box(px, y0, 0.25, 0.02, 0.2, 0.02, 0xf4f4f0) }
                for k in -4...4 { b.box(Float(k) * 0.11, y0, 0.46, 0.015, 0.06, 0.015, 0xf7f7f2) }
                b.box(0, y0 + 0.04, 0.46, 0.95, 0.012, 0.01, 0xf7f7f2)
            }
            for _ in 0..<3 { bush(b, -0.38 + R.next() * 0.15, -0.38 + R.next() * 0.7, 0.05 + R.next() * 0.03) }
            smallTree(b, 0.36, -0.34, 1 + R.next() * 0.4)
        case 2:
            let wall = v == 1 ? pick(brick, v) : pick(resWalls, v + 3)
            let floors = [3, 4, 3, 5][v], h = Float(floors) * FLOOR
            lot(b, v == 2 ? lawn : concrete)
            if v == 2 {
                b.box(-0.18, y0, -0.05, 0.46, h, 0.66, wall, side(.wres, top: 0x8b8f93))
                b.box(0.24, y0, 0.02, 0.4, h - FLOOR, 0.6, pick(resWalls, v + 1), side(.wres, top: 0x8b8f93))
                parapet(b, -0.18, y0 + h, -0.05, 0.46, 0.66, 0xe0ddd5)
                parapet(b, 0.24, y0 + h - FLOOR, 0.02, 0.4, 0.6, 0xe0ddd5)
                acUnits(b, &R, y0 + h, 0.3, 0.4)
            } else {
                b.box(0, y0, -0.04, 0.82, h, 0.68, wall, side(.wres, top: 0x8b8f93))
                parapet(b, 0, y0 + h, -0.04, 0.82, 0.68, v == 1 ? 0xd8cfc2 : 0xe6e2da)
                for f in 1..<floors {
                    for bx: Float in [-0.22, 0.22] {
                        b.box(bx, y0 + Float(f) * FLOOR - 0.01, 0.335, 0.3, 0.018, 0.09, 0xebebeb)
                        b.box(bx, y0 + Float(f) * FLOOR + 0.008, 0.378, 0.3, 0.06, 0.008, 0xa9c4d4, side(.woff))
                    }
                }
                b.box(0, y0 + 0.19, 0.34, 0.26, 0.02, 0.12, 0x3c3f44)
                b.box(0, y0, 0.302, 0.14, 0.18, 0.02, 0xffffff, side(.woff))
                acUnits(b, &R, y0 + h, 0.6, 0.5, 4)
                b.cyl(0.25, y0 + h, -0.2, 0.07, 0.16, 8, 0x8a6f55)
                b.box(-0.22, y0 + h, -0.18, 0.18, 0.12, 0.16, 0xbdbab3)
            }
            bush(b, -0.4, 0.42, 0.05); bush(b, 0.4, 0.42, 0.05)
        default:
            let floors = 13 + v * 3, h = Float(floors) * FLOOR
            let wall = pick([0xf1efe9, 0xe6edf3, 0xefe6dc, 0xdfe7e1] as [UInt32], v)
            lot(b, concrete)
            b.box(0, y0, 0, 0.92, FLOOR * 2, 0.92, 0xffffff, side(.woff, top: 0x7f8a84))
            b.box(0, y0 + FLOOR * 2, 0, 0.94, 0.03, 0.94, 0xe2e2de)
            let base = y0 + FLOOR * 2 + 0.03
            switch v {
            case 0:
                b.box(0, base, -0.04, 0.64, h, 0.5, wall, side(.wres, top: 0x6f7479))
                for fx: Float in [-0.32, 0.32] { b.box(fx, base, 0.21, 0.04, h, 0.04, 0xc6a77d) }
                b.box(0, base + h, -0.04, 0.4, 0.2, 0.3, 0xd0d0cc)
                beacon(b, 0.1, base + h + 0.2, -0.04)
            case 1:
                let th = h * 0.85
                for tx: Float in [-0.2, 0.2] { b.box(tx, base, 0, 0.34, tx < 0 ? h : th, 0.38, wall, side(.wres, top: 0x6f7479)) }
                b.box(0, base + th * 0.6, 0, 0.12, FLOOR * 1.5, 0.22, 0xffffff, side(.woff))
                beacon(b, -0.2, base + h, 0)
            case 2:
                b.lathe(0, base, 0, [(0.32, 0), (0.32, h)], 16, wall, .wres, capTop: true, capColor: 0x6f7479)
                var f = 2
                while f < floors { b.lathe(0, base + Float(f) * FLOOR - 0.012, 0, [(0.345, 0), (0.345, 0.02)], 16, 0xf4f4f4, .plain, capTop: true); f += 2 }
                b.cyl(0, base + h, 0, 0.18, 0.18, 12, 0xd6d6d2)
                beacon(b, 0, base + h + 0.18, 0)
            default:
                let t1 = Int((Float(floors) * 0.5).rounded()), t2 = Int((Float(floors) * 0.3).rounded()), t3 = floors - t1 - t2
                b.box(0, base, 0, 0.7, Float(t1) * FLOOR, 0.6, wall, side(.wres, top: 0x7d8a80))
                b.box(0, base + Float(t1) * FLOOR, -0.03, 0.56, Float(t2) * FLOOR, 0.48, wall, side(.wres, top: 0x7d8a80))
                b.box(0, base + Float(t1 + t2) * FLOOR, -0.05, 0.42, Float(t3) * FLOOR, 0.36, wall, side(.wres, top: 0x6f7479))
                b.translate(0, base + Float(t1) * FLOOR - y0, 0)
                for (bx, bz) in [(-0.31, 0.2), (0.31, 0.2), (-0.31, -0.22), (0.31, -0.22)] as [(Float, Float)] { bush(b, bx, bz, 0.035) }
                b.pop()
                beacon(b, 0, base + h, -0.05)
            }
        }
        return b
    }

    // MARK: commercial
    static func com(_ level: Int, _ v: Int) -> MeshBuilder {
        let b = MeshBuilder()
        var R = SplitMix(seed: UInt64(400 + 100 * level + v))
        switch level {
        case 1:
            let wall = pick([0xe9dfcf, 0xd4dde4, 0xf0d9c4, 0xe5e5e5] as [UInt32], v), aw = pick([0xd9453b, 0x2f7fbf, 0x2c9a6a, 0xe0a020] as [UInt32], v)
            let n = pick(neon, v + 1)
            lot(b, asphaltLot)
            for k in -3...3 { b.box(Float(k) * 0.12, y0, 0.37, 0.012, 0.002, 0.16, 0xe8e8e8) }
            if v == 3 {
                b.box(0, y0, -0.26, 0.5, 0.26, 0.32, wall, side(.woff))
                b.box(0, y0 + 0.36, 0.14, 0.78, 0.05, 0.44, 0xf3f3f3)
                b.box(0, y0 + 0.36, 0.14, 0.8, 0.02, 0.46, n, side(.neon))
                for px: Float in [-0.3, 0.3] { for pz: Float in [-0.02, 0.3] { b.box(px, y0, pz, 0.03, 0.36, 0.03, 0xd6d6d6) } }
                for px: Float in [-0.12, 0.12] { b.box(px, y0, 0.14, 0.06, 0.13, 0.1, 0xc23b32) }
                b.box(0.38, y0, -0.4, 0.03, 0.5, 0.03, 0x777777)
                b.box(0.38, y0 + 0.5, -0.4, 0.16, 0.1, 0.02, n, side(.neon))
            } else {
                let w: Float = 0.84, d: Float = 0.54, hh: Float = v == 1 ? 0.42 : 0.34
                b.box(0, y0, -0.14, w, hh, d, wall, side(.plain, top: 0x7a7d80))
                b.box(0, y0, 0.135, w - 0.08, 0.25, 0.02, 0xffffff, side(.woff))
                parapet(b, 0, y0 + hh, -0.14, w, d, 0xcfcac0, 0.02, 0.05)
                b.translate(0, y0 + 0.28, 0.2).rotateX(0.45)
                b.box(0, 0, 0, w - 0.06, 0.012, 0.15, aw)
                b.pop(); b.pop()
                b.box(0, y0 + hh, -0.02, 0.52, 0.14, 0.025, 0x2a2a2e)
                b.box(0, y0 + hh + 0.025, -0.006, 0.46, 0.09, 0.006, n, side(.neon, topMat: .neon))
                acUnits(b, &R, y0 + hh, 0.5, 0.2, 2)
                if v == 2 {
                    for ux: Float in [-0.28, 0.28] { b.cyl(ux, y0, 0.36, 0.008, 0.16, 4, 0x888888); b.cone(ux, y0 + 0.13, 0.36, 0.12, 0.06, 8, aw) }
                }
            }
        case 2:
            let floors = [6, 7, 8, 9][v], h = Float(floors) * FLOOR, tint = pick(glassTint, v), n = pick(neon, v + 2)
            lot(b, concrete)
            if v == 2 {
                b.box(0, y0, 0, 0.84, FLOOR, 0.8, 0xffffff, side(.woff))
                b.box(0, y0 + FLOOR, 0, 0.84, h - FLOOR, 0.8, pick(brick, v), side(.wres, top: 0x6d6f72))
                parapet(b, 0, y0 + h, 0, 0.84, 0.8, 0xd4c9b8)
                b.box(0, y0 + FLOOR - 0.02, 0.42, 0.84, 0.03, 0.06, 0x2f2f33)
            } else if v == 1 {
                b.box(-0.12, y0, -0.08, 0.58, h, 0.62, tint, side(.woff, top: 0x5f6266))
                b.box(0.22, y0, 0.12, 0.46, h * 0.7, 0.56, tint, side(.woff, top: 0x5f6266))
                parapet(b, 0.22, y0 + h * 0.7, 0.12, 0.46, 0.56, 0xc7cdd3)
                acUnits(b, &R, y0 + h, 0.4, 0.4, 3)
            } else {
                b.box(0, y0, 0, 0.8, h, 0.8, tint, side(.woff, top: 0x5f6266))
                for fx: Float in [-0.4, 0, 0.4] { b.box(fx, y0, 0.4, 0.03, h, 0.03, 0xd6dbe0) }
                for fz: Float in [-0.4, 0, 0.4] { b.box(0.4, y0, fz, 0.03, h, 0.03, 0xd6dbe0) }
                parapet(b, 0, y0 + h, 0, 0.8, 0.8, 0xd6dbe0, 0.03, 0.06)
                b.box(0, y0 + h, -0.1, 0.36, 0.16, 0.3, 0xb9bcbf)
                if v == 3 {
                    b.box(0.43, y0 + FLOOR * 2, 0.32, 0.04, h - FLOOR * 3, 0.1, 0x1d1d22)
                    b.box(0.452, y0 + FLOOR * 2 + 0.03, 0.32, 0.006, h - FLOOR * 3 - 0.06, 0.08, n, side(.neon))
                }
            }
            b.box(0, y0 + h + 0.02, 0.3, 0.4, 0.1, 0.02, n, side(.neon, topMat: .neon))
            b.box(0, y0, 0.42, 0.3, 0.2, 0.04, 0xffffff, side(.woff))
        default:
            let floors = 19 + v * 3, h = Float(floors) * FLOOR, tint = pick(glassTint, v + 1), n = pick(neon, v)
            lot(b, concrete)
            b.box(0, y0, 0, 0.94, FLOOR * 2, 0.94, 0xffffff, side(.woff, top: 0x4f5458))
            let base = y0 + FLOOR * 2
            switch v {
            case 0:
                var y = base
                let tiers = [0.5, 0.3, 0.2].map { Int((Float(floors) * $0).rounded()) }, ws: [Float] = [0.74, 0.6, 0.46]
                for (k, t) in tiers.enumerated() {
                    b.box(0, y, 0, ws[k], Float(t) * FLOOR, ws[k], tint, side(.woff, top: 0x56595d))
                    b.box(0, y + Float(t) * FLOOR, 0, ws[k] + 0.03, 0.03, ws[k] + 0.03, 0xd8dde2)
                    y += Float(t) * FLOOR + 0.03
                }
                b.cyl(0, y, 0, 0.05, 0.25, 6, 0xc7ccd1, .plain, capTop: true, rTop: 0.02)
                b.cyl(0, y + 0.25, 0, 0.012, 0.5, 4, 0xaaaaaa)
                b.sphere(0, y + 0.74, 0, 0.025, 6, 0xff2a2a, squash: 1, .neon)
            case 1:
                b.lathe(0, base, 0, [(0.36, 0), (0.36, h), (0.28, h + 0.1)], 20, tint, .woff, capTop: true, capColor: 0x56595d)
                b.lathe(0, base + h + 0.1, 0, [(0.2, 0), (0.2, 0.06)], 20, n, .neon, capTop: true, capColor: 0x333333)
                beacon(b, 0, base + h + 0.16, 0)
            case 2:
                var y = base
                for k in 0..<6 {
                    let cnt = Int((Float(floors) / 6).rounded()), w = 0.78 - Float(k) * 0.07
                    b.box(0, y, 0, w, Float(cnt) * FLOOR, w, tint, side(.woff, top: 0x56595d))
                    y += Float(cnt) * FLOOR
                }
                b.box(0, y, 0, 0.3, 0.04, 0.3, n, side(.neon, topMat: .neon))
                b.cyl(0, y + 0.04, 0, 0.02, 0.9, 5, 0xd0d0d0, .plain, capTop: true, rTop: 0.004)
                b.sphere(0, y + 0.9, 0, 0.02, 6, 0xff2a2a, squash: 1, .neon)
            default:
                for tx: Float in [-0.22, 0.22] {
                    let hh = tx < 0 ? h : h * 0.9
                    b.box(tx, base, 0, 0.36, hh, 0.5, tint, side(.woff, top: 0x56595d))
                    b.box(tx, base + hh, 0, 0.3, 0.06, 0.44, n, side(.neon, topMat: .neon))
                    beacon(b, tx, base + hh + 0.06, 0)
                }
            }
        }
        return b
    }

    // MARK: industrial
    static func stack(_ b: MeshBuilder, _ x: Float, _ z: Float, _ r: Float, _ h: Float, _ em: inout [SIMD4<Float>]) {
        b.cyl(x, y0, z, r, h, 10, 0xd8d8d8, .plain, capTop: true, rTop: r * 0.8)
        for k in 1..<4 { b.cyl(x, y0 + h * Float(k) / 4 - 0.03, z, r * (1 - Float(k) * 0.05) + 0.004, 0.05, 10, 0xc0392b, .plain, capTop: false) }
        em.append(SIMD4(x, y0 + h + 0.02, z, 0))
    }

    static func ind(_ level: Int, _ v: Int, emitters em: inout [SIMD4<Float>]) -> MeshBuilder {
        let b = MeshBuilder()
        var R = SplitMix(seed: UInt64(700 + 100 * level + v))
        switch level {
        case 1:
            let wall = pick(indWalls, v)
            lot(b, 0x8c8a84)
            let w: Float = 0.86, d: Float = 0.66, hh: Float = 0.34
            b.box(0, y0, -0.08, w, hh, d, wall, side(.wind, top: 0x8f969c))
            for k in 0..<4 {
                let z = -0.08 - d / 2 + (Float(k) + 0.5) * (d / 4)
                b.gable(0, y0 + hh, z, w - 0.02, 0.07, d / 4, k % 2 == 1 ? 0x80878d : 0x737a80)
                b.box(0, y0 + hh, z - d / 8 + 0.006, w - 0.02, 0.07, 0.012, 0xc9d3da)
            }
            for dx: Float in [-0.25, 0.05, 0.3] { b.box(dx, y0, 0.255, 0.16, 0.2, 0.01, 0x55606b) }
            b.box(0, y0 + 0.22, 0.29, 0.86, 0.02, 0.08, 0x666666)
            for k in 0..<4 { b.box(-0.36 + R.next() * 0.7, y0, 0.36 + R.next() * 0.08, 0.07, 0.06, 0.07, pick([0xb8864f, 0x2f6aa8, 0xc0392b] as [UInt32], k)) }
            if v % 2 == 1 { b.cyl(0.36, y0, -0.38, 0.07, 0.22, 10, 0xe0e0e0) }
        case 2:
            let wall = pick(indWalls, v + 1)
            lot(b, 0x86847e)
            b.box(-0.1, y0, -0.05, 0.64, 0.5, 0.7, wall, side(.wind, top: 0x7a8086))
            b.gable(-0.1, y0 + 0.5, -0.05, 0.64, 0.12, 0.7, 0x6d757c, alongZ: true)
            b.box(0.3, y0, 0.16, 0.24, 0.3, 0.34, pick(indWalls, v + 2), side(.wind))
            stack(b, 0.32, -0.28, 0.05, 0.95 + Float(v) * 0.1, &em)
            if v % 2 == 0 { stack(b, 0.18, -0.36, 0.04, 0.75, &em) }
            for tz: Float in [-0.32, -0.12] { b.cyl(-0.34 + Float(v % 2) * 0.68, y0, tz + 0.5, 0.08, 0.2, 12, 0xe6e1d4, .plain, capTop: true) }
            b.box(0.07, y0 + 0.38, -0.05, 0.4, 0.025, 0.025, 0x9a9a9a)
            b.box(0.35, y0 + 0.24, 0.34, 0.12, 0.08, 0.01, pick(neon, v + 3), side(.neon))
        default:
            lot(b, 0x7f7d78)
            for k in 0..<3 {
                let x = -0.28 + Float(k) * 0.28
                b.cyl(x, y0, 0.25, 0.12, 0.24, 14, 0xece9e2, .plain, capTop: true)
                b.cyl(x, y0 + 0.24, 0.25, 0.12, 0.03, 14, 0xd0ccc2, .plain, capTop: true, rTop: 0.08)
            }
            b.box(-0.18, y0, -0.2, 0.42, 0.62, 0.36, pick(indWalls, v), side(.wind, top: 0x70767c))
            b.cyl(0.2, y0, -0.24, 0.07, 1.25, 10, 0xbfc4c8, .plain, capTop: true)
            for k in 1...4 { b.cyl(0.2, y0 + Float(k) * 0.25, -0.24, 0.085, 0.02, 10, 0xe2b33c, .plain, capTop: true) }
            stack(b, 0.36, -0.38, 0.045, 1.5 + Float(v) * 0.1, &em)
            stack(b, -0.36, -0.38, 0.05, 1.2, &em)
            b.cyl(0.38, y0, 0.0, 0.012, 0.95, 4, 0x999999)
            b.sphere(0.38, y0 + 0.95, 0.0, 0.03, 6, 0xff9a2a, squash: 1.3, .neon)
            for k in 0..<3 { b.box(0, y0 + 0.12 + Float(k) * 0.17, -0.02, 0.8, 0.02, 0.02, 0x8d8d8d) }
        }
        return b
    }

    // MARK: services
    struct ServiceModel { var builder: MeshBuilder; var emitters: [SIMD4<Float>]; var blades: MeshBuilder?; var bladePos: SIMD3<Float> }

    static func carBody(_ b: MeshBuilder, _ x: Float, _ z: Float, _ body: UInt32, _ accent: UInt32, siren: Bool = false, len: Float = 1) {
        b.translate(x, y0, z)
        b.box(0, 0.015, 0, 0.12, 0.05, 0.22 * len, body)
        b.box(0, 0.065, -0.01, 0.1, 0.04, 0.12, 0xffffff, side(.woff, top: accent))
        if siren { b.box(0, 0.105, -0.01, 0.07, 0.015, 0.02, accent, side(.neon, topMat: .neon)) }
        b.pop()
    }

    static func service(_ id: ServiceID) -> ServiceModel {
        let b = MeshBuilder()
        var em: [SIMD4<Float>] = []
        var blades: MeshBuilder? = nil
        var bladePos = SIMD3<Float>(0, 0, 0)
        switch id {
        case .wind:
            lot(b, lawn)
            b.cyl(0, y0, 0, 0.12, 0.05, 8, 0xcfcfcf)
            b.cyl(0, y0, 0, 0.045, 2.2, 10, 0xf4f4f4, .plain, capTop: true, rTop: 0.025)
            b.box(0, y0 + 2.18, 0.02, 0.07, 0.07, 0.18, 0xf0f0f0)
            b.sphere(0, y0 + 2.27, 0.02, 0.012, 5, 0xff3030, squash: 1, .neon)
            let bb = MeshBuilder()
            bb.sphere(0, -0.03, 0, 0.035, 6, 0xf6f6f6)
            for k in 0..<3 {
                bb.rotateZ(Float(k) * .pi * 2 / 3)
                bb.box(0, 0.03, 0, 0.05, 0.85, 0.012, 0xfafafa)
                bb.box(0, 0.6, 0.007, 0.05, 0.14, 0.002, 0xe74c3c)
                bb.pop()
            }
            blades = bb; bladePos = SIMD3(0, y0 + 2.215, 0.12)
        case .tower:
            lot(b, concrete)
            for (lx, lz) in [(-0.18, -0.18), (0.18, -0.18), (-0.18, 0.18), (0.18, 0.18)] as [(Float, Float)] { b.box(lx, y0, lz, 0.035, 0.85, 0.035, 0x8b9299) }
            b.box(0, y0 + 0.45, 0, 0.4, 0.02, 0.02, 0x8b9299); b.box(0, y0 + 0.45, 0, 0.02, 0.02, 0.4, 0x8b9299)
            b.cyl(0, y0, 0, 0.04, 0.85, 8, 0x7d848b)
            b.lathe(0, y0 + 0.8, 0, [(0.06, 0), (0.26, 0.1), (0.28, 0.3), (0.22, 0.42), (0.0001, 0.5)], 16, 0x7fc6e8)
            b.lathe(0, y0 + 1.0, 0, [(0.283, 0), (0.283, 0.05)], 16, 0xffffff)
        case .park:
            lot(b, 0x5f9a44)
            b.box(0, y0, 0, 0.98, 0.004, 0.14, 0xd9cfb6); b.box(0, y0, 0, 0.14, 0.004, 0.98, 0xd9cfb6)
            b.cyl(0, y0, 0, 0.16, 0.05, 16, 0xcfc8b8)
            b.cyl(0, y0 + 0.02, 0, 0.13, 0.035, 16, 0x5fc2e6, .plain, capTop: true)
            b.cyl(0, y0, 0, 0.025, 0.14, 8, 0xd8d2c4)
            for (tx, tz, s) in [(-0.3, -0.3, 1.4), (0.32, -0.28, 1.1), (-0.28, 0.32, 1.2), (0.3, 0.3, 1.5)] as [(Float, Float, Float)] { smallTree(b, tx, tz, s, pick([0x4f9a3c, 0x6aa846, 0x3f8a46] as [UInt32], Int(tx * 10))) }
            for bx: Float in [-0.2, 0.2] { b.box(bx, y0, 0.12, 0.12, 0.03, 0.04, 0x7b5a3c) }
            for k in 0..<5 { bush(b, -0.42 + Float(k) * 0.21, -0.45, 0.035, 0xc2507a) }
        case .police:
            lot(b, concrete)
            b.box(0, y0, -0.08, 0.8, FLOOR * 2, 0.6, 0xe9edf2, side(.wres, top: 0x3f5b85))
            parapet(b, 0, y0 + FLOOR * 2, -0.08, 0.8, 0.6, 0x3a5a8c, 0.03, 0.05)
            b.box(0, y0 + FLOOR * 2 - 0.08, 0.225, 0.5, 0.06, 0.01, 0x2d6cdf, side(.neon))
            b.box(0, y0, 0.23, 0.18, 0.18, 0.02, 0xffffff, side(.woff))
            carBody(b, -0.26, 0.38, 0xf4f4f4, 0x1b3d7a, siren: true); carBody(b, 0.26, 0.38, 0xf4f4f4, 0x1b3d7a, siren: true)
            b.cyl(0.4, y0, 0.4, 0.008, 0.6, 4, 0xcccccc); b.box(0.44, y0 + 0.52, 0.4, 0.08, 0.05, 0.004, 0x2d6cdf)
        case .fire:
            lot(b, concrete)
            b.box(-0.08, y0, -0.06, 0.66, FLOOR * 1.7, 0.66, brick[0], side(.wres, top: 0x5b4038))
            for gx: Float in [-0.26, 0.06] { b.box(gx, y0, 0.275, 0.24, 0.26, 0.012, 0xe8e6e0); b.box(gx, y0 + 0.26, 0.28, 0.26, 0.02, 0.014, 0xf2f2f2) }
            b.box(0.34, y0, -0.24, 0.2, 0.9, 0.2, brick[1], side(.wres))
            b.box(0.34, y0 + 0.9, -0.24, 0.22, 0.03, 0.22, 0xf2f2f2)
            b.sphere(0.34, y0 + 0.93, -0.24, 0.03, 6, 0xff2a2a, squash: 1, .neon)
            b.box(-0.26, y0, 0.4, 0.14, 0.09, 0.24, 0xd22f27)
        case .clinic:
            lot(b, concrete)
            b.box(0, y0, -0.08, 0.76, FLOOR * 1.6, 0.56, 0xf5f7f8, side(.wres, top: 0xa9b3bb))
            parapet(b, 0, y0 + FLOOR * 1.6, -0.08, 0.76, 0.56, 0x3fae78, 0.025, 0.04)
            b.box(0, y0, 0.21, 0.24, 0.18, 0.02, 0xffffff, side(.woff))
            b.box(0, y0 + 0.2, 0.28, 0.36, 0.02, 0.16, 0x3fae78)
            b.box(0.22, y0 + 0.24, 0.205, 0.1, 0.03, 0.006, 0x43e08a, side(.neon))
            b.box(0.22, y0 + 0.24, 0.205, 0.03, 0.1, 0.006, 0x43e08a, side(.neon))
            smallTree(b, -0.36, 0.36, 1.1); bush(b, 0.38, 0.4, 0.05)
        case .school:
            lot(b, 0x6f9e4f, 2)
            b.box(-0.45, y0, -0.45, 0.9, FLOOR * 2, 0.7, brick[2], side(.wres, top: 0x556070))
            b.box(0.45, y0, -0.62, 0.9, FLOOR * 2, 0.4, brick[2], side(.wres, top: 0x556070))
            b.gable(-0.45, y0 + FLOOR * 2, -0.45, 0.94, 0.14, 0.74, 0x556070)
            b.box(-0.45, y0, -0.08, 0.22, 0.2, 0.04, 0xffffff, side(.woff))
            b.lathe(0.42, y0, 0.42, [(0.48, 0), (0.48, 0.004)], 24, 0xc0563f, .plain, capTop: true)
            b.lathe(0.42, y0 + 0.005, 0.42, [(0.36, 0), (0.36, 0.004)], 24, 0x4f9a3c, .plain, capTop: true)
            b.box(0.42, y0 + 0.01, 0.42, 0.01, 0.002, 0.5, 0xffffff)
            b.cyl(-0.85, y0, 0.2, 0.008, 0.7, 4, 0xcccccc); b.box(-0.8, y0 + 0.6, 0.2, 0.1, 0.07, 0.004, 0xe74c3c)
            smallTree(b, -0.75, 0.75, 1.5); smallTree(b, -0.45, 0.8, 1.3)
        case .university:
            lot(b, 0x6c9b4c, 2)
            b.box(0, y0, -0.45, 1.3, FLOOR * 2.4, 0.6, 0xe9e1cf, side(.wres, top: 0x7f8a90))
            for k in -3...3 { b.cyl(Float(k) * 0.13, y0 + 0.02, -0.13, 0.025, FLOOR * 2.1, 8, 0xf4efe4) }
            b.box(0, y0, -0.13, 0.98, 0.03, 0.1, 0xddd4c2)
            b.box(0, y0 + FLOOR * 2.1, -0.13, 1.0, 0.05, 0.12, 0xefe8da)
            b.gable(0, y0 + FLOOR * 2.4, -0.45, 1.34, 0.16, 0.64, 0x6f7c84)
            b.cyl(0, y0 + FLOOR * 2.4 + 0.1, -0.45, 0.2, 0.12, 16, 0xe9e1cf)
            b.sphere(0, y0 + FLOOR * 2.4 + 0.2, -0.45, 0.2, 14, 0x5d8fa0, squash: 0.85)
            b.box(-0.75, y0, 0.35, 0.4, FLOOR * 2, 0.8, brick[1], side(.wres, top: 0x5a636b))
            b.box(0.78, y0, 0.45, 0.3, 0.95, 0.3, brick[1], side(.wres))
            b.box(0.78, y0 + 0.95, 0.45, 0.34, 0.04, 0.34, 0xefe8da)
            b.cone(0.78, y0 + 0.99, 0.45, 0.2, 0.3, 4, 0x4f6670)
            b.box(0.78, y0 + 0.7, 0.602, 0.12, 0.12, 0.006, 0xfff3c4, side(.neon))
            b.box(0.05, y0, 0.45, 0.5, 0.004, 0.8, 0xd6ccb4)
            for (tx, tz) in [(-0.3, 0.2), (0.4, 0.15), (-0.3, 0.75), (0.4, 0.8)] as [(Float, Float)] { smallTree(b, tx, tz, 1.4) }
        case .hospital:
            lot(b, concrete, 2)
            b.box(-0.25, y0, -0.25, 0.8, FLOOR * 6, 0.8, 0xf4f6f8, side(.wres, top: 0x9aa3ab))
            b.box(0.45, y0, -0.3, 0.7, FLOOR * 3, 1.0, 0xeef1f4, side(.wres, top: 0x9aa3ab))
            b.box(-0.25, y0 + FLOOR * 6, -0.25, 0.3, 0.02, 0.1, 0xff2a2a, side(.neon, topMat: .neon))
            b.box(-0.25, y0 + FLOOR * 6, -0.25, 0.1, 0.02, 0.3, 0xff2a2a, side(.neon, topMat: .neon))
            b.cyl(0.45, y0 + FLOOR * 3, -0.3, 0.24, 0.02, 20, 0x5d646b, .plain, capTop: true)
            b.box(0.45, y0 + FLOOR * 3 + 0.02, -0.3, 0.03, 0.004, 0.16, 0xffffff)
            b.box(-0.25, y0, 0.2, 0.4, 0.18, 0.1, 0xffffff, side(.woff))
            b.box(-0.25, y0 + 0.18, 0.3, 0.5, 0.02, 0.3, 0xd0d6dc)
            carBody(b, 0.1, 0.5, 0xffffff, 0xe74c3c, siren: true, len: 1.3)
            for k in 0..<4 { smallTree(b, -0.8 + Float(k) * 0.4, 0.82, 1.2) }
        case .gas:
            lot(b, 0x8a8882, 2)
            for (x, z) in [(-0.45, -0.45), (0.4, -0.5)] as [(Float, Float)] {
                b.lathe(x, y0, z, [(0.36, 0), (0.27, 0.45), (0.22, 0.85), (0.25, 1.1)], 20, 0xd7d4cc)
                em.append(SIMD4(x, y0 + 1.15, z, 1))
            }
            b.box(-0.2, y0, 0.45, 1.2, 0.45, 0.6, 0xb9c0c6, side(.wind, top: 0x7c848b))
            stack(b, 0.75, 0.6, 0.06, 1.6, &em)
            for k in 0..<4 { b.box(0.25 + Float(k) * 0.12, y0, 0.0, 0.05, 0.28, 0.05, 0xe2b33c) }
        case .solar:
            lot(b, 0x8fa86c, 2)
            for r in 0..<5 { for c in 0..<2 {
                b.translate(-0.45 + Float(c) * 0.9, y0 + 0.12, -0.75 + Float(r) * 0.36).rotateX(-0.55)
                b.box(0, 0, 0, 0.8, 0.012, 0.26, 0x1f3a66, side(.plain, top: 0x26508f))
                b.pop(); b.pop()
                b.box(-0.45 + Float(c) * 0.9, y0, -0.75 + Float(r) * 0.36, 0.03, 0.12, 0.03, 0x999999)
            } }
            b.box(0.85, y0, 0.85, 0.18, 0.14, 0.18, 0xd6d6d6)
        case .landfill:
            lot(b, 0x7d7262, 2)
            for k in -4...4 {
                let f = Float(k) * 0.22
                b.box(f, y0, -0.94, 0.015, 0.12, 0.015, 0x666666); b.box(f, y0, 0.94, 0.015, 0.12, 0.015, 0x666666)
                b.box(-0.94, y0, f, 0.015, 0.12, 0.015, 0x666666); b.box(0.94, y0, f, 0.015, 0.12, 0.015, 0x666666)
            }
            for (mx, mz, r, c) in [(-0.4, -0.35, 0.5, 0x6f6656), (0.35, -0.3, 0.42, 0x7d7363), (-0.2, 0.35, 0.38, 0x6a6152), (0.45, 0.45, 0.3, 0x857a69)] as [(Float, Float, Float, UInt32)] {
                b.sphere(mx, y0 - r * 0.15, mz, r, 10, c, squash: 0.42)
            }
            let junk: [UInt32] = [0xc0392b, 0x2f6aa8, 0xe2b33c, 0xececec, 0x3a7d44]
            for k in 0..<26 {
                let a = Float(k) * 2.4, r = 0.15 + Float(k % 7) * 0.09
                b.box(cos(a) * r - 0.05, y0 + 0.12 + Float(k % 3) * 0.03, sin(a) * r, 0.04, 0.03, 0.05, junk[k % junk.count])
            }
            b.box(0.6, y0, -0.7, 0.16, 0.08, 0.1, 0xe2b33c); b.box(0.68, y0 + 0.02, -0.7, 0.04, 0.06, 0.12, 0x555555)
        case .recycling:
            lot(b, concrete, 2)
            b.box(-0.3, y0, -0.35, 1.2, 0.5, 0.9, 0x5fae6e, side(.wind, top: 0x4f8a5c))
            for k in 0..<4 { b.gable(-0.3, y0 + 0.5, -0.35 - 0.45 + 0.1125 + Float(k) * 0.225, 1.18, 0.07, 0.225, 0x6fbf7d) }
            b.translate(0.55, y0, 0.05).rotateZ(0.5)
            b.box(0, 0, 0, 0.7, 0.04, 0.12, 0x555555)
            b.pop(); b.pop()
            let bins: [UInt32] = [0x2f7fd6, 0x3fae5a, 0xe2b33c, 0xd6453b]
            for k in 0..<8 { b.box(-0.8 + Float(k) * 0.2, y0, 0.6, 0.14, 0.14, 0.2, bins[k % 4]) }
            b.box(-0.3, y0 + 0.36, 0.105, 0.3, 0.12, 0.006, 0x4dff8a, side(.neon))
        case .bus:
            lot(b, 0xa7a49d)
            b.box(0.05, y0 + 0.2, 0.22, 0.46, 0.02, 0.16, 0x2f6fd6)
            b.box(0.05, y0, 0.15, 0.46, 0.2, 0.012, 0xffffff, side(.woff))
            for px: Float in [-0.17, 0.27] { b.box(px, y0, 0.29, 0.02, 0.2, 0.02, 0xcfd6dc) }
            b.box(0.05, y0, 0.2, 0.34, 0.05, 0.06, 0x7b5a3c)
            b.cyl(-0.33, y0, 0.36, 0.01, 0.4, 4, 0xcfd6dc)
            b.box(-0.33, y0 + 0.36, 0.36, 0.12, 0.12, 0.012, 0x38a0ff, side(.neon))
            smallTree(b, 0.32, -0.3, 1.3); smallTree(b, -0.3, -0.32, 1.1)
        case .metro:
            lot(b, 0xb9b5ad)
            b.box(0, y0, -0.05, 0.62, 0.28, 0.5, 0xffffff, side(.woff, top: 0xbfe3ff))
            b.box(0, y0 + 0.28, -0.05, 0.68, 0.025, 0.56, 0xd8dde2)
            b.box(0, y0, 0.26, 0.3, 0.012, 0.16, 0x3b3f45)
            b.cyl(0.36, y0, 0.36, 0.012, 0.5, 5, 0xd8dde2)
            b.box(0.36, y0 + 0.5, 0.36, 0.16, 0.16, 0.03, 0xd4242a, side(.neon, topMat: .neon))
            b.box(0.36, y0 + 0.5, 0.378, 0.1, 0.1, 0.004, 0xffffff, side(.neon))
            for (bx, bz) in [(-0.38, 0.38), (-0.38, -0.38)] as [(Float, Float)] { bush(b, bx, bz, 0.06) }
        case .stadium:
            lot(b, concrete, 3)
            b.scale(1, 1, 0.78)
            b.lathe(0, y0, 0, [(1.38, 0), (1.38, 0.55), (1.25, 0.62)], 40, 0xe8ebee, .woff)
            b.lathe(0, y0, 0, [(1.25, 0.62), (0.95, 0.2)], 40, 0xc84a4a)
            b.lathe(0, y0, 0, [(0.95, 0.03), (0.95, 0.031)], 40, 0x3f9a45, .plain, capTop: true)
            b.pop()
            b.box(0, y0 + 0.035, 0, 1.0, 0.003, 0.01, 0xffffff)
            b.lathe(0, y0 + 0.035, 0, [(0.16, 0), (0.16, 0.003)], 20, 0xe8e8e8)
            for (mx, mz) in [(-1.3, -1.0), (1.3, -1.0), (-1.3, 1.0), (1.3, 1.0)] as [(Float, Float)] {
                b.cyl(mx, y0, mz, 0.02, 1.3, 5, 0xa0a6ab)
                b.box(mx, y0 + 1.3, mz, 0.26, 0.1, 0.04, 0xfff6d8, side(.neon))
            }
        }
        return ServiceModel(builder: b, emitters: em, blades: blades, bladePos: bladePos)
    }

    // MARK: props
    static func car() -> MeshBuilder {
        let b = MeshBuilder()
        b.box(0, 0.02, 0, 0.13, 0.055, 0.28, 0xffffff)
        b.box(0, 0.075, -0.02, 0.11, 0.045, 0.14, 0xffffff, side(.woff, top: 0xe6e6e6))
        for wx: Float in [-0.065, 0.065] { for wz: Float in [-0.09, 0.09] { b.box(wx, 0, wz, 0.02, 0.04, 0.05, 0x1a1a1a) } }
        for hx: Float in [-0.04, 0.04] {
            b.box(hx, 0.04, 0.141, 0.028, 0.016, 0.004, 0xfff4d0, side(.neon))
            b.box(hx, 0.04, -0.141, 0.028, 0.014, 0.004, 0xff2a1a, side(.neon))
        }
        return b
    }

    static func bus() -> MeshBuilder {
        let b = MeshBuilder()
        b.box(0, 0.02, 0, 0.15, 0.13, 0.5, 0xffffff)
        b.box(0, 0.08, 0, 0.152, 0.05, 0.46, 0xffffff, side(.woff, top: 0xffffff))
        for wx: Float in [-0.07, 0.07] { for wz: Float in [-0.17, 0.17] { b.box(wx, 0, wz, 0.02, 0.045, 0.06, 0x1a1a1a) } }
        for hx: Float in [-0.05, 0.05] {
            b.box(hx, 0.04, 0.251, 0.03, 0.02, 0.004, 0xfff4d0, side(.neon))
            b.box(hx, 0.04, -0.251, 0.03, 0.02, 0.004, 0xff2a1a, side(.neon))
        }
        b.box(0, 0.125, 0.251, 0.1, 0.02, 0.004, 0xffb22a, side(.neon))
        return b
    }

    static func tree(_ type: Int) -> MeshBuilder {
        let b = MeshBuilder()
        if type == 1 {
            b.cyl(0, 0, 0, 0.03, 0.12, 5, 0x5c4030)
            b.cone(0, 0.08, 0, 0.17, 0.28, 7, 0x2f6b3c)
            b.cone(0, 0.22, 0, 0.13, 0.24, 7, 0x357544)
            b.cone(0, 0.35, 0, 0.085, 0.2, 7, 0x3d7f4b)
        } else {
            b.cyl(0, 0, 0, 0.028, 0.16, 5, 0x6b4a33)
            b.sphere(0, 0.1, 0, 0.16, 7, 0x4d8f38, squash: 1.05)
            b.sphere(0.07, 0.2, 0.03, 0.1, 6, 0x5a9c40)
            b.sphere(-0.06, 0.18, -0.05, 0.09, 6, 0x468a35)
        }
        return b
    }

    static func lamp() -> MeshBuilder {
        let b = MeshBuilder()
        b.box(0, 0, 0, 0.018, 0.42, 0.018, 0x4a4e54)
        b.box(0, 0.41, 0.05, 0.014, 0.014, 0.11, 0x4a4e54)
        b.box(0, 0.395, 0.1, 0.04, 0.016, 0.06, 0xffe7b0, side(.neon))
        return b
    }

    static func rubble() -> MeshBuilder {
        let b = MeshBuilder()
        b.box(0, 0, 0, 0.96, y0 + 0.004, 0.96, 0x4a4744)
        let cols: [UInt32] = [0x2e2b29, 0x3a3634, 0x55504b, 0x1f1d1c, 0x6b5f55]
        for k in 0..<18 {
            let a = Float(k) * 2.399, r = 0.05 + Float(k % 6) * 0.07
            b.translate(cos(a) * r, y0, sin(a) * r).rotateY(a).rotateZ(Float(k % 3 - 1) * 0.3)
            b.box(0, 0, 0, 0.06 + Float(k % 4) * 0.04, 0.03 + Float(k % 3) * 0.03, 0.05 + Float(k % 5) * 0.03, cols[k % cols.count])
            b.pop(); b.pop(); b.pop()
        }
        b.translate(0.12, y0 + 0.08, -0.1).rotateZ(0.7); b.box(0, 0, 0, 0.03, 0.34, 0.03, 0x2a2422); b.pop(); b.pop()
        return b
    }
}

/// Small deterministic RNG for model details.
struct SplitMix {
    var state: UInt64
    init(seed: UInt64) { state = seed &+ 0x9E3779B97F4A7C15 }
    mutating func next() -> Float {
        state &+= 0x9E3779B97F4A7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
        z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
        z ^= z >> 31
        return Float(z >> 40) / Float(1 << 24)
    }
}
