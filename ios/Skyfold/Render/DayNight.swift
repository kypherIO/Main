import simd

/// Time-of-day lighting keyframes (t: 0 = midnight, 0.5 = noon).
struct Lighting {
    var skyTop = SIMD3<Float>(0, 0, 0), skyHorizon = SIMD3<Float>(0, 0, 0)
    var sunColor = SIMD3<Float>(1, 1, 1), sunIntensity: Float = 1
    var hemiSky = SIMD3<Float>(1, 1, 1), hemiGround = SIMD3<Float>(0.3, 0.3, 0.3), hemiIntensity: Float = 0.5
    var fog = SIMD3<Float>(0.8, 0.9, 1)
    var lightDir = SIMD3<Float>(0.4, 0.8, 0.3)
    var night: Float = 0
}

enum DayNight {
    private struct Key { let t: Float; let top, hor, sun: UInt32; let si: Float; let hs, hg: UInt32; let hi: Float; let fog: UInt32 }
    private static let keys: [Key] = [
        Key(t: 0.00, top: 0x040918, hor: 0x13224a, sun: 0x8ea8ff, si: 0.22, hs: 0x2a3d6a, hg: 0x0c0f18, hi: 0.32, fog: 0x0c1632),
        Key(t: 0.20, top: 0x0b1530, hor: 0x2a3560, sun: 0x9aaeff, si: 0.2, hs: 0x2e4270, hg: 0x10121a, hi: 0.32, fog: 0x18224a),
        Key(t: 0.25, top: 0x34477a, hor: 0xf3a173, sun: 0xffad6b, si: 0.7, hs: 0x8fa2cc, hg: 0x3a3022, hi: 0.38, fog: 0xd6a48e),
        Key(t: 0.32, top: 0x4b88d2, hor: 0xcfe5f5, sun: 0xfff0d6, si: 1.25, hs: 0xbad4ff, hg: 0x5a4a35, hi: 0.5, fog: 0xc2d8e8),
        Key(t: 0.50, top: 0x3e7fd8, hor: 0xd9edf9, sun: 0xffffff, si: 1.4, hs: 0xc4dcff, hg: 0x5e4e38, hi: 0.55, fog: 0xcfe3f0),
        Key(t: 0.68, top: 0x4a84cc, hor: 0xe6e2d6, sun: 0xffe6c2, si: 1.25, hs: 0xbcd2f6, hg: 0x5e4a34, hi: 0.5, fog: 0xd8dcd8),
        Key(t: 0.76, top: 0x2c3c76, hor: 0xff955a, sun: 0xff8448, si: 0.7, hs: 0x8a90c0, hg: 0x3a2a22, hi: 0.38, fog: 0xcf8c74),
        Key(t: 0.82, top: 0x0d1736, hor: 0x3a3060, sun: 0x9aaeff, si: 0.2, hs: 0x2e4270, hg: 0x10121a, hi: 0.32, fog: 0x1b2148),
        Key(t: 1.00, top: 0x040918, hor: 0x13224a, sun: 0x8ea8ff, si: 0.22, hs: 0x2a3d6a, hg: 0x0c0f18, hi: 0.32, fog: 0x0c1632),
    ]

    private static func lin(_ hex: UInt32) -> SIMD3<Float> { let c = rgb(hex); return SIMD3(c.r, c.g, c.b) }
    private static func smooth(_ a: Float, _ b: Float, _ x: Float) -> Float { let t = max(0, min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

    static func lighting(_ tIn: Float) -> Lighting {
        let t = tIn - floor(tIn)
        var a = keys[0], b = keys[keys.count - 1]
        for k in 0..<(keys.count - 1) where t >= keys[k].t && t <= keys[k + 1].t { a = keys[k]; b = keys[k + 1]; break }
        let f = (t - a.t) / max(1e-6, b.t - a.t)
        func mix(_ p: UInt32, _ q: UInt32) -> SIMD3<Float> { simd_mix(lin(p), lin(q), SIMD3(repeating: f)) }
        var L = Lighting()
        L.skyTop = mix(a.top, b.top); L.skyHorizon = mix(a.hor, b.hor)
        L.sunColor = mix(a.sun, b.sun); L.sunIntensity = a.si + (b.si - a.si) * f
        L.hemiSky = mix(a.hs, b.hs); L.hemiGround = mix(a.hg, b.hg); L.hemiIntensity = a.hi + (b.hi - a.hi) * f
        L.fog = mix(a.fog, b.fog)
        L.night = t < 0.5 ? 1 - smooth(0.21, 0.29, t) : smooth(0.74, 0.82, t)
        let ang = (t - 0.25) * .pi * 2
        let elev = sin(ang), az = ang * 0.5 + 0.7
        let sunDir = simd_normalize(SIMD3(cos(az) * cos(asin(max(-1, min(1, elev)))), elev, sin(az) * 0.8))
        var light = elev > 0.05 ? sunDir : simd_normalize(SIMD3<Float>(-0.45, 0.8, -0.35))
        if elev > 0.05 && light.y < 0.28 { light.y = 0.28; light = simd_normalize(light) }
        L.lightDir = light
        return L
    }
}
