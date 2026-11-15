import simd
import Metal
import SkyfoldCore

/// Procedural mesh kit (Swift port of the web build's GeoBuilder).
/// Each vertex carries its material id, so a whole model is one draw call.
/// Façade UVs are in world units so windows line up with storeys everywhere.
enum Mat: Float { case plain = 0, wres = 1, woff = 2, wind = 3, neon = 4, terrain = 5, road = 6, plate = 7, water = 8, overlay = 9, ao = 10, pool = 11, preview = 12, seabed = 13, cursor = 14 }

private let winU: Float = 0.2 * 8        // façade pattern spans 8 windows of 0.2 units
private let winV: Float = FLOOR * 8      // and 8 storeys

struct RGB { var r, g, b: Float }

/// sRGB hex → linear RGB
func rgb(_ hex: UInt32) -> RGB {
    func lin(_ c: UInt32) -> Float { let v = Float(c) / 255; return v <= 0.04045 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4) }
    return RGB(r: lin((hex >> 16) & 255), g: lin((hex >> 8) & 255), b: lin(hex & 255))
}

struct BoxOpts {
    var side: Mat = .plain
    var topMat: Mat = .plain
    var top: RGB? = nil
    var vOff: Float = 0
    var noTop = false
}

final class MeshBuilder {
    private(set) var verts: [MeshVertex] = []
    private var m = matrix_identity_float4x4
    private var nm = matrix_identity_float3x3
    private var stack: [simd_float4x4] = []

    // MARK: transforms
    @discardableResult func push(_ t: simd_float4x4) -> MeshBuilder {
        stack.append(m); m = m * t; updateNormalMatrix(); return self
    }
    @discardableResult func pop() -> MeshBuilder { m = stack.removeLast(); updateNormalMatrix(); return self }
    @discardableResult func translate(_ x: Float, _ y: Float, _ z: Float) -> MeshBuilder { push(.translation(x, y, z)) }
    @discardableResult func rotateX(_ a: Float) -> MeshBuilder { push(.rotationX(a)) }
    @discardableResult func rotateY(_ a: Float) -> MeshBuilder { push(.rotationY(a)) }
    @discardableResult func rotateZ(_ a: Float) -> MeshBuilder { push(.rotationZ(a)) }
    @discardableResult func scale(_ x: Float, _ y: Float, _ z: Float) -> MeshBuilder { push(.scale(x, y, z)) }

    private func updateNormalMatrix() {
        let u = simd_float3x3(SIMD3(m.columns.0.x, m.columns.0.y, m.columns.0.z),
                              SIMD3(m.columns.1.x, m.columns.1.y, m.columns.1.z),
                              SIMD3(m.columns.2.x, m.columns.2.y, m.columns.2.z))
        nm = u.inverse.transpose
    }

    // MARK: primitives
    func vert(_ p: SIMD3<Float>, _ n: SIMD3<Float>, _ uv: SIMD2<Float>, _ c: RGB, _ mat: Mat) {
        let wp = m * SIMD4(p, 1)
        let wn = simd_normalize(nm * n)
        verts.append(MeshVertex(px: wp.x, py: wp.y, pz: wp.z, nx: wn.x, ny: wn.y, nz: wn.z, u: uv.x, v: uv.y, r: c.r, g: c.g, b: c.b, mat: mat.rawValue))
    }

    func quad(_ mat: Mat, _ a: SIMD3<Float>, _ b: SIMD3<Float>, _ c: SIMD3<Float>, _ d: SIMD3<Float>, _ n: SIMD3<Float>, _ col: RGB,
              _ uvs: [SIMD2<Float>] = [SIMD2(0, 0), SIMD2(1, 0), SIMD2(1, 1), SIMD2(0, 1)]) {
        vert(a, n, uvs[0], col, mat); vert(b, n, uvs[1], col, mat); vert(c, n, uvs[2], col, mat)
        vert(a, n, uvs[0], col, mat); vert(c, n, uvs[2], col, mat); vert(d, n, uvs[3], col, mat)
    }

    func tri(_ mat: Mat, _ a: SIMD3<Float>, _ b: SIMD3<Float>, _ c: SIMD3<Float>, _ n: SIMD3<Float>, _ col: RGB) {
        vert(a, n, SIMD2(0, 0), col, mat); vert(b, n, SIMD2(1, 0), col, mat); vert(c, n, SIMD2(0.5, 1), col, mat)
    }

    /// Axis-aligned box. (x, z) = centre, y = bottom.
    @discardableResult
    func box(_ x: Float, _ y: Float, _ z: Float, _ w: Float, _ h: Float, _ d: Float, _ color: UInt32, _ o: BoxOpts = BoxOpts()) -> MeshBuilder {
        let c = rgb(color), top = o.top ?? c
        let x0 = x - w / 2, x1 = x + w / 2, y0 = y, y1 = y + h, z0 = z - d / 2, z1 = z + d / 2
        let v0 = (y0 + o.vOff) / winV, v1 = (y1 + o.vOff) / winV
        let uw = w / winU, ud = d / winU
        let uvW = [SIMD2(0, v0), SIMD2(uw, v0), SIMD2(uw, v1), SIMD2(0, v1)]
        let uvD = [SIMD2(0, v0), SIMD2(ud, v0), SIMD2(ud, v1), SIMD2(0, v1)]
        quad(o.side, SIMD3(x0, y0, z1), SIMD3(x1, y0, z1), SIMD3(x1, y1, z1), SIMD3(x0, y1, z1), SIMD3(0, 0, 1), c, uvW)
        quad(o.side, SIMD3(x1, y0, z0), SIMD3(x0, y0, z0), SIMD3(x0, y1, z0), SIMD3(x1, y1, z0), SIMD3(0, 0, -1), c, uvW)
        quad(o.side, SIMD3(x1, y0, z1), SIMD3(x1, y0, z0), SIMD3(x1, y1, z0), SIMD3(x1, y1, z1), SIMD3(1, 0, 0), c, uvD)
        quad(o.side, SIMD3(x0, y0, z0), SIMD3(x0, y0, z1), SIMD3(x0, y1, z1), SIMD3(x0, y1, z0), SIMD3(-1, 0, 0), c, uvD)
        if !o.noTop { quad(o.topMat, SIMD3(x0, y1, z1), SIMD3(x1, y1, z1), SIMD3(x1, y1, z0), SIMD3(x0, y1, z0), SIMD3(0, 1, 0), top) }
        return self
    }

    /// Gable roof; ridge along x (or z when alongZ).
    @discardableResult
    func gable(_ x: Float, _ y: Float, _ z: Float, _ w: Float, _ h: Float, _ d: Float, _ color: UInt32, alongZ: Bool = false, end: UInt32? = nil) -> MeshBuilder {
        if alongZ {
            translate(x, 0, z).rotateY(.pi / 2)
            gable(0, y, 0, d, h, w, color, alongZ: false, end: end)
            pop(); pop(); return self
        }
        let c = rgb(color), ec = rgb(end ?? color)
        let x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, y1 = y + h
        let sl = (h * h + d * d / 4).squareRoot()
        let nf = SIMD3<Float>(0, (d / 2) / sl, h / sl), nb = SIMD3<Float>(0, (d / 2) / sl, -h / sl)
        quad(.plain, SIMD3(x0, y, z1), SIMD3(x1, y, z1), SIMD3(x1, y1, z), SIMD3(x0, y1, z), nf, c)
        quad(.plain, SIMD3(x1, y, z0), SIMD3(x0, y, z0), SIMD3(x0, y1, z), SIMD3(x1, y1, z), nb, c)
        tri(.plain, SIMD3(x1, y, z1), SIMD3(x1, y, z0), SIMD3(x1, y1, z), SIMD3(1, 0, 0), ec)
        tri(.plain, SIMD3(x0, y, z0), SIMD3(x0, y, z1), SIMD3(x0, y1, z), SIMD3(-1, 0, 0), ec)
        return self
    }

    /// Surface of revolution. profile: [(radius, y)] bottom → top.
    @discardableResult
    func lathe(_ x: Float, _ y: Float, _ z: Float, _ profile: [(Float, Float)], _ seg: Int, _ color: UInt32, _ mat: Mat = .plain,
               capTop: Bool = false, capColor: UInt32? = nil, capMat: Mat = .plain, flat: Bool = false) -> MeshBuilder {
        let c = rgb(color)
        var circ: [(Float, Float)] = []
        for i in 0...seg { let a = Float(i) / Float(seg) * .pi * 2; circ.append((cos(a), sin(a))) }
        for k in 0..<(profile.count - 1) {
            let (r0, y0) = profile[k], (r1, y1) = profile[k + 1]
            let dy = y1 - y0, dr = r1 - r0, len = max((dy * dy + dr * dr).squareRoot(), 1e-5)
            let ny = -dr / len, nr = dy / len
            let v0 = (y + y0) / winV, v1 = (y + y1) / winV
            for i in 0..<seg {
                let (c0, s0) = circ[i], (c1, s1) = circ[i + 1]
                let rm = max(r0, r1)
                let u0 = Float(i) / Float(seg) * .pi * 2 * rm / winU, u1 = Float(i + 1) / Float(seg) * .pi * 2 * rm / winU
                let n0 = flat ? SIMD3((c0 + c1) / 2 * nr, ny, (s0 + s1) / 2 * nr) : SIMD3(c0 * nr, ny, s0 * nr)
                let n1 = flat ? n0 : SIMD3(c1 * nr, ny, s1 * nr)
                let a = SIMD3(x + c0 * r0, y + y0, z + s0 * r0), b = SIMD3(x + c1 * r0, y + y0, z + s1 * r0)
                let cc = SIMD3(x + c1 * r1, y + y1, z + s1 * r1), d = SIMD3(x + c0 * r1, y + y1, z + s0 * r1)
                vert(a, n0, SIMD2(u0, v0), c, mat); vert(d, n0, SIMD2(u0, v1), c, mat); vert(cc, n1, SIMD2(u1, v1), c, mat)
                vert(a, n0, SIMD2(u0, v0), c, mat); vert(cc, n1, SIMD2(u1, v1), c, mat); vert(b, n1, SIMD2(u1, v0), c, mat)
            }
        }
        if capTop, let last = profile.last, last.0 > 0 {
            let yc = y + last.1, cc = rgb(capColor ?? color)
            for i in 0..<seg {
                let (c0, s0) = circ[i], (c1, s1) = circ[i + 1]
                vert(SIMD3(x, yc, z), SIMD3(0, 1, 0), SIMD2(0.5, 0.5), cc, capMat)
                vert(SIMD3(x + c1 * last.0, yc, z + s1 * last.0), SIMD3(0, 1, 0), SIMD2(0, 0), cc, capMat)
                vert(SIMD3(x + c0 * last.0, yc, z + s0 * last.0), SIMD3(0, 1, 0), SIMD2(1, 0), cc, capMat)
            }
        }
        return self
    }

    @discardableResult
    func cyl(_ x: Float, _ y: Float, _ z: Float, _ r: Float, _ h: Float, _ seg: Int, _ color: UInt32, _ mat: Mat = .plain, capTop: Bool = true, rTop: Float? = nil) -> MeshBuilder {
        lathe(x, y, z, [(r, 0), (rTop ?? r, h)], seg, color, mat, capTop: capTop, flat: seg <= 6)
    }

    @discardableResult
    func cone(_ x: Float, _ y: Float, _ z: Float, _ r: Float, _ h: Float, _ seg: Int, _ color: UInt32) -> MeshBuilder {
        lathe(x, y, z, [(r, 0), (0.0001, h)], seg, color, .plain, flat: true)
    }

    @discardableResult
    func sphere(_ x: Float, _ y: Float, _ z: Float, _ r: Float, _ seg: Int, _ color: UInt32, squash: Float = 1, _ mat: Mat = .plain) -> MeshBuilder {
        var prof: [(Float, Float)] = []
        let rings = max(3, seg / 2)
        for i in 0...rings {
            let a = -Float.pi / 2 + Float(i) / Float(rings) * .pi
            prof.append((max(0.0001, cos(a) * r), (sin(a) * r + r) * squash))
        }
        return lathe(x, y, z, prof, seg, color, mat, flat: seg <= 7)
    }

    /// Flat quad on the ground plane (y), uv 0..1 with u → +x, v → +z.
    func groundQuad(size: Float, y: Float, mat: Mat, color: UInt32 = 0xffffff) {
        let h = size / 2, c = rgb(color)
        quad(mat, SIMD3(-h, y, h), SIMD3(h, y, h), SIMD3(h, y, -h), SIMD3(-h, y, -h), SIMD3(0, 1, 0), c,
             [SIMD2(0, 1), SIMD2(1, 1), SIMD2(1, 0), SIMD2(0, 0)])
    }

    func makeMesh(_ device: MTLDevice, label: String) -> Mesh? {
        guard !verts.isEmpty, let buf = device.makeBuffer(bytes: verts, length: verts.count * MemoryLayout<MeshVertex>.stride, options: .storageModeShared) else { return nil }
        buf.label = label
        return Mesh(buffer: buf, count: verts.count)
    }
}

struct Mesh {
    let buffer: MTLBuffer
    let count: Int
}

// MARK: - simd helpers
extension simd_float4x4 {
    static func translation(_ x: Float, _ y: Float, _ z: Float) -> simd_float4x4 {
        var m = matrix_identity_float4x4; m.columns.3 = SIMD4(x, y, z, 1); return m
    }
    static func scale(_ x: Float, _ y: Float, _ z: Float) -> simd_float4x4 {
        simd_float4x4(diagonal: SIMD4(x, y, z, 1))
    }
    static func rotationX(_ a: Float) -> simd_float4x4 {
        let c = cos(a), s = sin(a)
        return simd_float4x4(SIMD4(1, 0, 0, 0), SIMD4(0, c, s, 0), SIMD4(0, -s, c, 0), SIMD4(0, 0, 0, 1))
    }
    static func rotationY(_ a: Float) -> simd_float4x4 {
        let c = cos(a), s = sin(a)
        return simd_float4x4(SIMD4(c, 0, -s, 0), SIMD4(0, 1, 0, 0), SIMD4(s, 0, c, 0), SIMD4(0, 0, 0, 1))
    }
    static func rotationZ(_ a: Float) -> simd_float4x4 {
        let c = cos(a), s = sin(a)
        return simd_float4x4(SIMD4(c, s, 0, 0), SIMD4(-s, c, 0, 0), SIMD4(0, 0, 1, 0), SIMD4(0, 0, 0, 1))
    }
    /// Right-handed perspective, Metal clip space (z in 0...1).
    static func perspective(fovY: Float, aspect: Float, near: Float, far: Float) -> simd_float4x4 {
        let y = 1 / tan(fovY / 2), x = y / aspect, z = far / (near - far)
        return simd_float4x4(SIMD4(x, 0, 0, 0), SIMD4(0, y, 0, 0), SIMD4(0, 0, z, -1), SIMD4(0, 0, z * near, 0))
    }
    /// Right-handed orthographic, Metal clip space.
    static func orthographic(left l: Float, right r: Float, bottom b: Float, top t: Float, near n: Float, far f: Float) -> simd_float4x4 {
        simd_float4x4(SIMD4(2 / (r - l), 0, 0, 0), SIMD4(0, 2 / (t - b), 0, 0), SIMD4(0, 0, 1 / (n - f), 0),
                      SIMD4((l + r) / (l - r), (t + b) / (b - t), n / (n - f), 1))
    }
    static func lookAt(eye: SIMD3<Float>, target: SIMD3<Float>, up: SIMD3<Float>) -> simd_float4x4 {
        let z = simd_normalize(eye - target), x = simd_normalize(simd_cross(up, z)), y = simd_cross(z, x)
        return simd_float4x4(SIMD4(x.x, y.x, z.x, 0), SIMD4(x.y, y.y, z.y, 0), SIMD4(x.z, y.z, z.z, 0),
                             SIMD4(-simd_dot(x, eye), -simd_dot(y, eye), -simd_dot(z, eye), 1))
    }
}
