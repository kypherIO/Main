// Deterministic random helpers. Bit-exact ports of hash01 / mulberry32 in
// game/src/config.js so a given seed produces the same world as the web build.
import Foundation

/// JS `ToInt32` for a finite double (wraps modulo 2^32).
@inline(__always)
func jsToInt32(_ d: Double) -> Int32 {
    guard d.isFinite else { return 0 }
    let t = d.rounded(.towardZero)
    if abs(t) < 9.0e18 { return Int32(truncatingIfNeeded: Int64(t)) }
    let m = t.truncatingRemainder(dividingBy: 4294967296.0)
    return Int32(truncatingIfNeeded: Int64(m))
}

/// JS `Math.round`: rounds half-way cases toward +infinity.
@inline(__always)
func jsRound(_ x: Double) -> Double {
    (x + 0.5).rounded(.down)
}

/// Deterministic hash → [0, 1). Matches the JS implementation, including the
/// non-`imul` (double precision) middle multiplication.
public func hash01(_ a: Int, _ b: Int = 0) -> Double {
    // a*374761393 + b*668265263 is exact in JS doubles for the small ints used here.
    var h = Int32(truncatingIfNeeded: Int64(a) &* 374761393 &+ Int64(b) &* 668265263)
    let x = h ^ Int32(bitPattern: UInt32(bitPattern: h) >> 13)
    h = jsToInt32(Double(x) * 1274126177.0)
    h = h ^ Int32(bitPattern: UInt32(bitPattern: h) >> 16)
    return Double(UInt32(bitPattern: h)) / 4294967296.0
}

/// mulberry32 PRNG returning doubles in [0, 1).
public func mulberry32(_ seed: UInt32) -> () -> Double {
    var a = seed
    return {
        a = a &+ 0x6D2B79F5
        var t = (a ^ (a >> 15)) &* (1 | a)
        t = (t &+ ((t ^ (t >> 7)) &* (61 | t))) ^ t
        return Double(t ^ (t >> 14)) / 4294967296.0
    }
}

@inline(__always)
func clamp<T: Comparable>(_ v: T, _ a: T, _ b: T) -> T {
    v < a ? a : (v > b ? b : v)
}

@inline(__always)
func lerp(_ a: Double, _ b: Double, _ t: Double) -> Double { a + (b - a) * t }

/// Emulates storing a double into a JS Uint8Array for in-range values
/// (truncation toward zero), clamped to 0...255 so it can never trap.
@inline(__always)
func u8t(_ v: Double) -> UInt8 {
    if v >= 255 { return 255 }
    if v > 0 { return UInt8(v) }
    return 0
}

/// `Number.prototype.toLocaleString('en-US')` for integers: 12345 → "12,345".
public func formatThousands(_ n: Int) -> String {
    let neg = n < 0
    let digits = Array(String(n.magnitude))
    var out = ""
    for (k, ch) in digits.enumerated() {
        if k > 0 && (digits.count - k) % 3 == 0 { out.append(",") }
        out.append(ch)
    }
    return neg ? "-" + out : out
}
