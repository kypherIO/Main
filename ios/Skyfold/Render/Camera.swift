import simd
import CoreGraphics
import SkyfoldCore

/// Orbiting city camera. Pitch follows zoom (low and cinematic up close,
/// top-down when zoomed out) with a user tilt offset.
final class CameraRig {
    var target = SIMD3<Float>(0, 0, 0)
    var dist: Float = 34
    var yaw: Float = .pi * 0.25
    var tilt: Float = 0
    var vel = SIMD2<Float>(0, 0)
    let minDist: Float = 6, maxDist: Float = 110
    var goal: (SIMD3<Float>, Float?)?
    var orbit: Float = 0
    let fov: Float = 30 * .pi / 180
    var aspect: Float = 1

    private(set) var view = matrix_identity_float4x4
    private(set) var proj = matrix_identity_float4x4
    private(set) var position = SIMD3<Float>(0, 10, 10)

    func pitch() -> Float {
        let t = max(0, min(1, (dist - minDist) / (maxDist - minDist)))
        return max(0.32, min(1.3, 0.52 + (1.02 - 0.52) * pow(t, 0.7) + tilt))
    }

    func update(_ dt: Float) {
        if let g = goal {
            let gt = g.0, gd = g.1
            let k = 1 - exp(-dt * 5)
            target += (gt - target) * k
            if let gd { dist += (gd - dist) * k }
            if simd_distance(target, gt) < 0.02 { goal = nil }
        }
        if simd_length_squared(vel) > 1e-5 {
            target.x += vel.x * dt; target.z += vel.y * dt
            vel *= exp(-dt * 5)
        }
        yaw += orbit * dt
        let half = Float(MAP) / 2
        target.x = max(-half, min(half, target.x)); target.z = max(-half, min(half, target.z))
        dist = max(minDist, min(maxDist, dist))
        let p = pitch()
        position = SIMD3(target.x + sin(yaw) * cos(p) * dist, target.y + sin(p) * dist, target.z + cos(yaw) * cos(p) * dist)
        view = .lookAt(eye: position, target: target, up: SIMD3(0, 1, 0))
        proj = .perspective(fovY: fov, aspect: aspect, near: 0.3, far: 1500)
    }

    var viewProj: simd_float4x4 { proj * view }

    func flyTo(_ x: Float, _ z: Float, dist d: Float? = nil) { goal = (SIMD3(x, 0, z), d) }

    /// Intersect the ray through a point in view coordinates (points) with the ground plane.
    func ground(at p: CGPoint, in size: CGSize) -> SIMD3<Float>? {
        let ndc = SIMD2<Float>(Float(p.x / size.width) * 2 - 1, 1 - Float(p.y / size.height) * 2)
        let inv = viewProj.inverse
        let a = inv * SIMD4(ndc.x, ndc.y, 0, 1), b = inv * SIMD4(ndc.x, ndc.y, 1, 1)
        let o = SIMD3(a.x, a.y, a.z) / a.w, e = SIMD3(b.x, b.y, b.z) / b.w
        let d = e - o
        guard abs(d.y) > 1e-6 else { return nil }
        let t = -o.y / d.y
        guard t > 0 else { return nil }
        return o + d * t
    }

    func tile(at p: CGPoint, in size: CGSize) -> (x: Int, z: Int, inside: Bool)? {
        guard let g = ground(at: p, in: size) else { return nil }
        let x = Int(floor(g.x + Float(MAP) / 2)), z = Int(floor(g.z + Float(MAP) / 2))
        return (x, z, x >= 0 && z >= 0 && x < MAP && z < MAP)
    }

    func zoom(by factor: Float, at p: CGPoint, in size: CGSize) {
        let before = ground(at: p, in: size)
        dist = max(minDist, min(maxDist, dist * factor))
        update(0)
        if let before, let after = ground(at: p, in: size) { target.x += before.x - after.x; target.z += before.z - after.z }
    }
}
