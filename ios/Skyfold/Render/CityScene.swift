import Metal
import simd
import SkyfoldCore

private let HALF = Float(MAP) / 2
private let DIRV: [(Int, Int)] = [(0, -1), (1, 0), (0, 1), (-1, 0)]   // N E S W
private let ROT: [Float] = [.pi, .pi / 2, 0, -.pi / 2]

@inline(__always) func tileWorld(_ x: Int, _ z: Int) -> (Float, Float) { (Float(x) - HALF + 0.5, Float(z) - HALF + 0.5) }

func hashF(_ a: Int, _ b: Int = 0) -> Float {
    var h = Int32(truncatingIfNeeded: a &* 374761393 &+ b &* 668265263)
    h = (h ^ (h >> 13)) &* 1274126177
    h = h ^ (h >> 16)
    return Float(UInt32(bitPattern: h)) / 4294967296
}

struct Batch {
    let mesh: Mesh
    var instances: [InstanceData]
    var shadow = true
}

struct Vehicle { var x, z, inD, outD: Int; var t, v: Float; var color: SIMD3<Float>; var bus: Bool }

struct Particle {
    var p: SIMD3<Float>; var v: SIMD3<Float>
    var life: Float, max: Float, s0: Float, s1: Float
    var c: SIMD3<Float>; var a: Float
}

/// Turns World state into instanced draw batches + animated vehicles/particles.
final class CityScene {
    let device: MTLDevice
    private(set) var world: World

    // meshes
    private var zoneMeshes: [Int: (Mesh, [SIMD4<Float>])] = [:]
    private var serviceMeshes: [ServiceID: (Mesh, [SIMD4<Float>], Mesh?, SIMD3<Float>)] = [:]
    private var tree1: Mesh!, tree2: Mesh!, car: Mesh!, bus: Mesh!, lamp: Mesh!, rubbleMesh: Mesh!
    private var roadQuad: Mesh!, plateQuad: Mesh!, aoQuad: Mesh!, poolQuad: Mesh!, previewQuad: Mesh!, cursorQuad: Mesh!
    private(set) var terrain: Mesh!
    private(set) var seabed: Mesh!, water: Mesh!, overlayPlane: Mesh!

    // batches
    private(set) var opaque: [Batch] = []
    private(set) var transparent: [Batch] = []
    private var buildingBatches: [Int: Batch] = [:]
    private var serviceBatches: [ServiceID: Batch] = [:]
    private var bladeBatches: [ServiceID: Batch] = [:]
    private var roadBatch: Batch!, lampBatch: Batch!, treeBatch1: Batch!, treeBatch2: Batch!, rubbleBatch: Batch!
    private var plateBatch: Batch!, aoBatch: Batch!, poolBatch: Batch!
    private(set) var vehicleBatch: Batch!, busBatch: Batch!
    var previewBatch: Batch!, cursorBatch: Batch!
    var ghost: Batch?

    // dynamic state
    var dirtyStatic = true
    var dirtyBuildings = true
    var anim: [Int: Double] = [:]           // tile → construction start time (negative key = service root)
    var time: Double = 0
    private(set) var fires: [SIMD3<Float>] = []
    private var emitters: [SIMD4<Float>] = []   // xyz, w = steam
    private var turbines: [(Int, SIMD3<Float>, Float)] = []
    private var vehicles: [Vehicle] = []
    private(set) var particles: [Particle] = []
    private var emitAcc: Float = 0
    var carTarget = 0, busTarget = 0

    init(device: MTLDevice, world: World) {
        self.device = device
        self.world = world
        buildMeshes()
        buildTerrain()
    }

    func setWorld(_ w: World) {
        world = w
        anim.removeAll(); vehicles.removeAll(); particles.removeAll()
        buildTerrain()
        dirtyStatic = true; dirtyBuildings = true
    }

    // MARK: meshes
    private func mesh(_ b: MeshBuilder, _ label: String) -> Mesh { b.makeMesh(device, label: label)! }

    private func buildMeshes() {
        tree1 = mesh(Models.tree(1), "tree1"); tree2 = mesh(Models.tree(2), "tree2")
        car = mesh(Models.car(), "car"); bus = mesh(Models.bus(), "bus")
        lamp = mesh(Models.lamp(), "lamp"); rubbleMesh = mesh(Models.rubble(), "rubble")
        func quad(_ size: Float, _ y: Float, _ m: Mat) -> Mesh { let b = MeshBuilder(); b.groundQuad(size: size, y: y, mat: m); return mesh(b, "quad\(m)") }
        roadQuad = quad(1, 0.016, .road); plateQuad = quad(0.96, 0.022, .plate); aoQuad = quad(1, 0.02, .ao)
        poolQuad = quad(1.3, 0.03, .pool); previewQuad = quad(0.94, 0.07, .preview); cursorQuad = quad(1, 0.08, .cursor)
        seabed = quad(1400, -0.84, .seabed)
        water = quad(1200, -0.1, .water)
        overlayPlane = quad(Float(MAP), 0.06, .overlay)
        roadBatch = Batch(mesh: roadQuad, instances: [], shadow: false)
        lampBatch = Batch(mesh: lamp, instances: [])
        treeBatch1 = Batch(mesh: tree1, instances: []); treeBatch2 = Batch(mesh: tree2, instances: [])
        rubbleBatch = Batch(mesh: rubbleMesh, instances: [])
        plateBatch = Batch(mesh: plateQuad, instances: [], shadow: false)
        aoBatch = Batch(mesh: aoQuad, instances: [], shadow: false)
        poolBatch = Batch(mesh: poolQuad, instances: [], shadow: false)
        vehicleBatch = Batch(mesh: car, instances: []); busBatch = Batch(mesh: bus, instances: [])
        previewBatch = Batch(mesh: previewQuad, instances: [], shadow: false)
        cursorBatch = Batch(mesh: cursorQuad, instances: [], shadow: false)
    }

    private func zoneMesh(_ kind: Kind, _ level: Int, _ variant: Int) -> (Mesh, [SIMD4<Float>]) {
        let key = Int(kind.rawValue) * 100 + level * 10 + variant
        if let m = zoneMeshes[key] { return m }
        var em: [SIMD4<Float>] = []
        let b: MeshBuilder
        switch kind {
        case .res: b = Models.res(level, variant)
        case .com: b = Models.com(level, variant)
        default: b = Models.ind(level, variant, emitters: &em)
        }
        let r = (mesh(b, "zone\(key)"), em)
        zoneMeshes[key] = r
        return r
    }

    func serviceMesh(_ id: ServiceID) -> (Mesh, [SIMD4<Float>], Mesh?, SIMD3<Float>) {
        if let m = serviceMeshes[id] { return m }
        let sm = Models.service(id)
        let r = (mesh(sm.builder, id.rawValue), sm.emitters, sm.blades.map { mesh($0, "blades") }, sm.bladePos)
        serviceMeshes[id] = r
        return r
    }

    // MARK: terrain
    private func buildTerrain() {
        let w = world, R = MAP * 2, V = R + 1
        var landDist = [UInt8](repeating: 9, count: N)
        var q: [Int] = []
        for i in 0..<N where w.terrain[i] == 0 { landDist[i] = 0; q.append(i) }
        var h = 0
        while h < q.count {
            let i = q[h]; h += 1
            let x = i % MAP, z = i / MAP, d = landDist[i]
            if d >= 6 { continue }
            for (ox, oz) in DIRV {
                let nx = x + ox, nz = z + oz
                guard nx >= 0, nz >= 0, nx < MAP, nz < MAP else { continue }
                let j = nz * MAP + nx
                if landDist[j] > d + 1 { landDist[j] = d + 1; q.append(j) }
            }
        }
        func tileAt(_ x: Int, _ z: Int) -> Int { (x < 0 || z < 0 || x >= MAP || z >= MAP) ? -1 : z * MAP + x }
        let grassA = rgb(0x5f9c42), grassB = rgb(0x79ae4e), grassC = rgb(0x4c8738)
        let sand = rgb(0xe3cf9a), wetSand = rgb(0xb8a273), deep = rgb(0x1f4f5f), shallow = rgb(0x5aa59a)
        func mix(_ a: RGB, _ b: RGB, _ t: Float) -> RGB { RGB(r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t) }
        var pos = [SIMD3<Float>](repeating: .zero, count: V * V)
        var col = [RGB](repeating: RGB(r: 0, g: 0, b: 0), count: V * V)
        for gz in 0..<V {
            for gx in 0..<V {
                let tx = gx % 2 == 1 ? [(gx - 1) / 2] : [gx / 2 - 1, gx / 2]
                let tz = gz % 2 == 1 ? [(gz - 1) / 2] : [gz / 2 - 1, gz / 2]
                var land = false, shore = false, forest = false, minLD: UInt8 = 9
                for a in tx { for b in tz {
                    let i = tileAt(a, b)
                    if i >= 0 && w.terrain[i] == 0 { land = true; if w.waterDist[i] <= 1 { shore = true }; if w.tree[i] != 0 { forest = true } }
                    minLD = min(minLD, i >= 0 ? landDist[i] : 9)
                } }
                let n = hashF(gx, gz), n2 = hashF(gx >> 2, gz >> 2)
                var y: Float = 0
                var c: RGB
                if land {
                    if shore { c = mix(sand, grassA, 0.15 * n) }
                    else {
                        c = mix(grassA, n2 > 0.5 ? grassB : grassC, abs(n2 - 0.5) * 1.6)
                        c = mix(c, grassB, n * 0.2)
                        if forest { c = mix(c, grassC, 0.45) }
                    }
                } else {
                    y = -0.32 - Float(min(minLD, 5)) * 0.1
                    c = mix(minLD <= 1 ? wetSand : shallow, deep, max(0, min(1, (Float(minLD) - 1) / 4)))
                }
                let o = gz * V + gx
                pos[o] = SIMD3(Float(gx) * 0.5 - HALF, y, Float(gz) * 0.5 - HALF)
                col[o] = c
            }
        }
        // accumulate smooth normals
        var nrm = [SIMD3<Float>](repeating: .zero, count: V * V)
        var tris: [(Int, Int, Int)] = []
        tris.reserveCapacity(R * R * 2)
        for gz in 0..<R { for gx in 0..<R {
            let a = gz * V + gx, b = a + 1, c = a + V, d = c + 1
            tris.append((a, c, b)); tris.append((b, c, d))
        } }
        for (a, b, c) in tris {
            let fn = simd_cross(pos[b] - pos[a], pos[c] - pos[a])
            nrm[a] += fn; nrm[b] += fn; nrm[c] += fn
        }
        var verts: [MeshVertex] = []
        verts.reserveCapacity(tris.count * 3)
        for (a, b, c) in tris {
            for i in [a, b, c] {
                let p = pos[i], n = simd_normalize(nrm[i]), cc = col[i]
                verts.append(MeshVertex(px: p.x, py: p.y, pz: p.z, nx: n.x, ny: n.y, nz: n.z, u: 0, v: 0, r: cc.r, g: cc.g, b: cc.b, mat: Mat.terrain.rawValue))
            }
        }
        let buf = device.makeBuffer(bytes: verts, length: verts.count * MemoryLayout<MeshVertex>.stride, options: .storageModeShared)!
        buf.label = "terrain"
        terrain = Mesh(buffer: buf, count: verts.count)
    }

    // MARK: instance helpers
    @inline(__always) private func inst(_ m: simd_float4x4, _ tint: SIMD3<Float> = SIMD3(1, 1, 1), seed: Float = 0, extra: SIMD4<Float> = .zero) -> InstanceData {
        InstanceData(model: m, tint: SIMD4(tint, seed), extra: extra)
    }
    @inline(__always) private func trs(_ x: Float, _ y: Float, _ z: Float, rotY: Float = 0, sx: Float = 1, sy: Float = 1, sz: Float = 1) -> simd_float4x4 {
        .translation(x, y, z) * .rotationY(rotY) * .scale(sx, sy, sz)
    }

    func roadMask(_ x: Int, _ z: Int) -> Int {
        var m = 0
        for (d, (ox, oz)) in DIRV.enumerated() {
            let nx = x + ox, nz = z + oz
            if world.inb(nx, nz) && world.kind[world.idx(nx, nz)] == Kind.road.rawValue { m |= 1 << d }
        }
        return m
    }

    // MARK: rebuild
    private func rebuildStatic() {
        let w = world
        var roads: [InstanceData] = [], lamps: [InstanceData] = [], pools: [InstanceData] = [], t1: [InstanceData] = [], t2: [InstanceData] = []
        for i in 0..<N {
            let x = i % MAP, z = i / MAP
            let (wx, wz) = tileWorld(x, z)
            let k = w.kind[i]
            if k == Kind.road.rawValue {
                let mask = roadMask(x, z)
                roads.append(inst(.translation(wx, 0, wz), extra: SIMD4(Float(mask), Float(w.level[i]), Float(w.traffic[i]), 0)))
                if (x + z) % 2 == 0 && (mask == 5 || mask == 10) {
                    if mask == 5 { lamps.append(inst(trs(wx + 0.41, 0.016, wz, rotY: -.pi / 2))); pools.append(inst(.translation(wx + 0.15, 0, wz))) }
                    else { lamps.append(inst(trs(wx, 0.016, wz - 0.41))); pools.append(inst(.translation(wx, 0, wz - 0.15))) }
                }
                continue
            }
            let tr = w.tree[i]
            let isEmptyZone = (k == Kind.res.rawValue || k == Kind.com.rawValue || k == Kind.ind.rawValue) && w.level[i] == 0
            if tr != 0 && w.terrain[i] == 0 && (k == Kind.empty.rawValue || isEmptyZone) && !TileFlags(rawValue: w.flags[i]).contains(.rubble) {
                let n = 1 + Int(hashF(i, 11) * 3)
                for k2 in 0..<n {
                    let ox = (hashF(i, 20 + k2) - 0.5) * 0.7, oz = (hashF(i, 40 + k2) - 0.5) * 0.7, s = 0.75 + hashF(i, 60 + k2) * 0.6
                    let type = k2 == 0 ? Int(tr) : (hashF(i, 80 + k2) < 0.5 ? 1 : 2)
                    let m = trs(wx + ox, 0, wz + oz, rotY: hashF(i, 90 + k2) * 6.28, sx: s, sy: s * (0.9 + hashF(i, 99 + k2) * 0.3), sz: s)
                    let g = 0.85 + hashF(i, 70 + k2) * 0.25
                    let d = inst(m, SIMD3(g * 0.95, g, g * 0.9))
                    if type == 1 { t1.append(d) } else { t2.append(d) }
                }
            }
        }
        roadBatch.instances = roads; lampBatch.instances = lamps; poolBatch.instances = pools
        treeBatch1.instances = t1; treeBatch2.instances = t2
        syncServices()
        dirtyStatic = false
        dirtyBuildings = true
    }

    private func syncServices() {
        let w = world
        var svc: [ServiceID: [InstanceData]] = [:], blades: [ServiceID: [InstanceData]] = [:]
        turbines.removeAll()
        for i in 0..<N where w.kind[i] == Kind.service.rawValue && Int(w.root[i]) == i {
            guard let id = serviceID(w.svc[i]) else { continue }
            let def = SERVICES[id]!
            let (_, _, bladeMesh, bladePos) = serviceMesh(id)
            let x = i % MAP, z = i / MAP
            let (wx, wz) = tileWorld(x, z)
            let off = Float(def.size - 1) / 2
            var sy: Float = 1
            if let t0 = anim[-1 - i] {
                let t = Float((time - t0) / 0.8)
                if t >= 1 { anim[-1 - i] = nil } else { sy = easeOutBack(max(0.02, t)) }
            }
            let rot = ROT[Int(w.rot[i]) & 3]
            svc[id, default: []].append(inst(trs(wx + off, 0, wz + off, rotY: rot, sy: sy)))
            if bladeMesh != nil {
                turbines.append((i, SIMD3(wx + off, 0, wz + off), rot))
                blades[id, default: []].append(inst(.identity))
                _ = bladePos
            }
        }
        serviceBatches = svc.reduce(into: [:]) { acc, kv in acc[kv.key] = Batch(mesh: serviceMesh(kv.key).0, instances: kv.value) }
        bladeBatches = blades.reduce(into: [:]) { acc, kv in if let m = serviceMesh(kv.key).2 { acc[kv.key] = Batch(mesh: m, instances: kv.value) } }
    }

    private func rebuildBuildings() {
        let w = world
        var batches: [Int: [InstanceData]] = [:]
        var ao: [InstanceData] = [], rubble: [InstanceData] = [], plates: [InstanceData] = []
        emitters.removeAll(keepingCapacity: true)
        fires.removeAll(keepingCapacity: true)
        var animating = false
        let zoneCol: [UInt8: SIMD3<Float>] = [Kind.res.rawValue: SIMD3(0.37, 0.82, 0.41), Kind.com.rawValue: SIMD3(0.29, 0.66, 1.0), Kind.ind.rawValue: SIMD3(1.0, 0.77, 0.28)]
        for i in 0..<N {
            let k = w.kind[i], L = Int(w.level[i]), fl = TileFlags(rawValue: w.flags[i])
            let x = i % MAP, z = i / MAP
            let (wx, wz) = tileWorld(x, z)
            if fl.contains(.rubble) { rubble.append(inst(trs(wx, 0, wz, rotY: hashF(i) * 6))); continue }
            if fl.contains(.burning) {
                let size: Float = k == Kind.service.rawValue ? Float(SERVICES[serviceID(w.svc[i]) ?? .park]!.size) : 1
                fires.append(SIMD3(wx, wz, size))
            }
            guard k == Kind.res.rawValue || k == Kind.com.rawValue || k == Kind.ind.rawValue else { continue }
            if L == 0 { plates.append(inst(.translation(wx, 0, wz), zoneCol[k]!)); continue }
            let variant = Int(w.variant[i] & 3)
            let (_, em) = zoneMesh(Kind(rawValue: k)!, L, variant)
            var sy: Float = 1
            if let t0 = anim[i] {
                let t = Float((time - t0) / 0.8)
                if t >= 1 { anim[i] = nil } else { sy = easeOutBack(max(0.02, t)); animating = true }
            }
            let rot = ROT[Int(w.rot[i]) & 3]
            let h = hashF(i, 3)
            var tint: SIMD3<Float>
            if fl.contains(.burning) { tint = SIMD3(0.32, 0.17, 0.1) }
            else if fl.contains(.abandoned) { tint = SIMD3(0.3, 0.29, 0.29) }
            else { tint = SIMD3(0.92 + h * 0.08, 0.9 + hashF(i, 5) * 0.1, 0.88 + hashF(i, 6) * 0.12) }
            let key = Int(k) * 100 + L * 10 + variant
            batches[key, default: []].append(inst(trs(wx, 0, wz, rotY: rot, sy: sy), tint, seed: hashF(i, 9)))
            let a: Float = L == 1 ? 1.12 : 1.22
            ao.append(inst(trs(wx, 0, wz, sx: a, sz: a)))
            if !fl.contains(.abandoned) {
                let c = cos(rot), s = sin(rot)
                for e in em {
                    let lx = e.x, lz = e.z
                    emitters.append(SIMD4(wx + lx * c + lz * s, e.y * sy, wz - lx * s + lz * c, e.w))
                }
            }
        }
        // service AO + emitters
        for i in 0..<N where w.kind[i] == Kind.service.rawValue && Int(w.root[i]) == i {
            guard let id = serviceID(w.svc[i]) else { continue }
            let def = SERVICES[id]!
            let (wx, wz) = tileWorld(i % MAP, i / MAP)
            let off = Float(def.size - 1) / 2, sz = Float(def.size) * 1.1
            ao.append(inst(trs(wx + off, 0, wz + off, sx: sz, sz: sz)))
            let rot = ROT[Int(w.rot[i]) & 3], c = cos(rot), s = sin(rot)
            for e in serviceMesh(id).1 { emitters.append(SIMD4(wx + off + e.x * c + e.z * s, e.y, wz + off - e.x * s + e.z * c, e.w)) }
        }
        buildingBatches = batches.reduce(into: [:]) { acc, kv in acc[kv.key] = Batch(mesh: zoneMeshes[kv.key]!.0, instances: kv.value) }
        aoBatch.instances = ao; rubbleBatch.instances = rubble; plateBatch.instances = plates
        dirtyBuildings = animating || anim.keys.contains { $0 < 0 }
        if anim.keys.contains(where: { $0 < 0 }) { syncServices() }
    }

    func serviceID(_ v: UInt8) -> ServiceID? {
        let i = Int(v) - 1
        return i >= 0 && i < ServiceID.allCases.count ? ServiceID.allCases[i] : nil
    }

    // MARK: events
    func onTilesChanged() { dirtyStatic = true; dirtyBuildings = true }
    func onGrow(_ i: Int, up: Bool) {
        let (wx, wz) = tileWorld(i % MAP, i / MAP)
        if up { anim[i] = time }
        spawnDust(wx, wz, 1)
        dirtyBuildings = true; dirtyStatic = true
    }
    func onServicePlaced(root: Int, size: Int) {
        anim[-1 - root] = time
        let (wx, wz) = tileWorld(root % MAP, root / MAP)
        let off = Float(size - 1) / 2
        spawnDust(wx + off, wz + off, Float(size))
    }
    func onFire(_ i: Int, _ state: FireState) {
        let (wx, wz) = tileWorld(i % MAP, i / MAP)
        if state != .start { spawnDust(wx, wz, 1) }
        dirtyBuildings = true
    }

    // MARK: per-frame
    func update(dt: Float, speed: Int, night: Float, stats: Stats) {
        time += Double(dt)
        if dirtyStatic { rebuildStatic() }
        if dirtyBuildings { rebuildBuildings() }
        // turbines
        var bladeInst: [ServiceID: [InstanceData]] = [:]
        if !turbines.isEmpty {
            let bp = serviceMesh(.wind).3
            for (i, p, rot) in turbines {
                let spin = Float(time) * (1.2 + (speed > 0 ? 0.6 : 0)) + hashF(i) * 6
                let m = simd_float4x4.translation(p.x, p.y, p.z) * .rotationY(rot) * .translation(bp.x, bp.y, bp.z) * .rotationZ(spin)
                bladeInst[.wind, default: []].append(inst(m))
            }
        }
        for (id, list) in bladeInst { bladeBatches[id]?.instances = list }
        // vehicles
        let roads = stats.roads
        var stations = 0
        for (id, b) in serviceBatches where id == .bus || id == .metro { stations += b.instances.count }
        carTarget = min(320, Int(Float(roads) * 0.6), stats.trips / 9 + stats.jobs / 40 + min(6, roads >> 3))
        busTarget = min(30, stations * 2)
        updateVehicles(dt: dt, speed: speed)
        updateParticles(dt: dt, speed: speed, night: night)
        assemble()
    }

    private func spawnVehicle(bus: Bool) {
        let w = world
        for _ in 0..<30 {
            let i = Int.random(in: 0..<N)
            guard w.kind[i] == Kind.road.rawValue else { continue }
            if !bus && Float.random(in: 0..<1) > 0.12 + Float(w.traffic[i]) / 120 { continue }
            let x = i % MAP, z = i / MAP, mask = roadMask(x, z)
            let dirs = (0..<4).filter { mask & (1 << $0) != 0 }
            guard let out = dirs.randomElement() else { return }
            let palette: [SIMD3<Float>] = [SIMD3(0.65, 0.05, 0.05), SIMD3(0.9, 0.9, 0.9), SIMD3(0.03, 0.03, 0.04), SIMD3(0.05, 0.16, 0.65), SIMD3(0.8, 0.5, 0.05), SIMD3(0.26, 0.31, 0.38), SIMD3(0.03, 0.25, 0.1), SIMD3(0.55, 0.55, 0.55), SIMD3(0.2, 0.05, 0.43)]
            vehicles.append(Vehicle(x: x, z: z, inD: out, outD: out, t: Float.random(in: 0..<1), v: (bus ? 0.45 : 0.6) + Float.random(in: 0..<0.45),
                                    color: bus ? SIMD3(0.89, 0.47, 0.03) : palette.randomElement()!, bus: bus))
            return
        }
    }

    private func updateVehicles(dt: Float, speed: Int) {
        let w = world
        let cars = vehicles.filter { !$0.bus }.count, buses = vehicles.count - cars
        for _ in 0..<min(6, max(0, carTarget - cars)) { spawnVehicle(bus: false) }
        for _ in 0..<min(2, max(0, busTarget - buses)) { spawnVehicle(bus: true) }
        if cars > carTarget, let k = vehicles.firstIndex(where: { !$0.bus }) { vehicles.remove(at: k) }
        if buses > busTarget, let k = vehicles.firstIndex(where: { $0.bus }) { vehicles.remove(at: k) }
        let move = speed > 0 ? dt * Float(Double(speed).squareRoot()) : 0
        var carInst: [InstanceData] = [], busInst: [InstanceData] = []
        var k = vehicles.count - 1
        while k >= 0 {
            var c = vehicles[k]
            var dead = false
            let jam = Float(w.traffic[w.idx(c.x, c.z)])
            c.t += c.v * move / (1 + max(0, jam - 70) / 45)
            while c.t >= 1 {
                c.t -= 1
                let nx = c.x + DIRV[c.outD].0, nz = c.z + DIRV[c.outD].1
                if !w.inb(nx, nz) || w.kind[w.idx(nx, nz)] != Kind.road.rawValue { dead = true; break }
                c.x = nx; c.z = nz; c.inD = c.outD
                let mask = roadMask(nx, nz), back = (c.inD + 2) % 4
                var opts = (0..<4).filter { mask & (1 << $0) != 0 && $0 != back }
                if opts.isEmpty { opts = [back] }
                c.outD = opts.contains(c.inD) && Float.random(in: 0..<1) < 0.6 ? c.inD : opts.randomElement()!
            }
            if dead || w.kind[w.idx(c.x, c.z)] != Kind.road.rawValue { vehicles.remove(at: k); k -= 1; continue }
            vehicles[k] = c
            let (cx, cz) = tileWorld(c.x, c.z)
            let ex = cx - Float(DIRV[c.inD].0) * 0.5, ez = cz - Float(DIRV[c.inD].1) * 0.5
            let xx = cx + Float(DIRV[c.outD].0) * 0.5, xz = cz + Float(DIRV[c.outD].1) * 0.5
            let t = c.t, u = 1 - t
            var px = u * u * ex + 2 * u * t * cx + t * t * xx, pz = u * u * ez + 2 * u * t * cz + t * t * xz
            var tx = 2 * u * (cx - ex) + 2 * t * (xx - cx), tz = 2 * u * (cz - ez) + 2 * t * (xz - cz)
            let l = max(1e-4, (tx * tx + tz * tz).squareRoot()); tx /= l; tz /= l
            let lane: Float = w.level[w.idx(c.x, c.z)] > 0 ? 0.27 : 0.13
            px += -tz * lane; pz += tx * lane
            let d = inst(trs(px, 0.018, pz, rotY: atan2(tx, tz)), c.color)
            if c.bus { busInst.append(d) } else { carInst.append(d) }
            k -= 1
        }
        vehicleBatch.instances = carInst; busBatch.instances = busInst
    }

    func spawnDust(_ x: Float, _ z: Float, _ size: Float) {
        for _ in 0..<Int(10 * size) where particles.count < 700 {
            particles.append(Particle(p: SIMD3(x + Float.random(in: -0.5...0.5) * size, 0.05, z + Float.random(in: -0.5...0.5) * size),
                                      v: SIMD3(Float.random(in: -0.3...0.3), 0.3 + Float.random(in: 0..<0.4), Float.random(in: -0.3...0.3)),
                                      life: 0, max: 0.9 + Float.random(in: 0..<0.5), s0: 0.25, s1: 0.8 * size, c: SIMD3(0.82, 0.74, 0.6), a: 0.55))
        }
    }

    private func updateParticles(dt: Float, speed: Int, night: Float) {
        if speed > 0 && !emitters.isEmpty {
            emitAcc += dt * min(80, Float(emitters.count) * 1.6)
            while emitAcc > 1 && particles.count < 700 {
                emitAcc -= 1
                let e = emitters.randomElement()!
                let steam = e.w > 0.5
                particles.append(Particle(p: SIMD3(e.x, e.y, e.z), v: SIMD3(0.12 + Float.random(in: 0..<0.08), steam ? 0.55 : 0.4, 0.05 + Float.random(in: -0.03...0.03)),
                                          life: 0, max: steam ? 3.5 : 4.5, s0: steam ? 0.5 : 0.18, s1: steam ? 2.2 : 1.1,
                                          c: steam ? SIMD3(0.97, 0.97, 0.98) : SIMD3(0.55, 0.54, 0.52), a: steam ? 0.6 : 0.45))
            }
            if emitAcc > 1 { emitAcc = 0 }
        }
        for f in fires where Float.random(in: 0..<1) < dt * 40 {
            for _ in 0..<(1 + Int(f.z)) where particles.count < 700 {
                if Float.random(in: 0..<1) < 0.6 {
                    particles.append(Particle(p: SIMD3(f.x + Float.random(in: -0.25...0.25) * f.z, 0.1 + Float.random(in: 0..<0.3), f.y + Float.random(in: -0.25...0.25) * f.z),
                                              v: SIMD3(Float.random(in: -0.05...0.05), 0.7 + Float.random(in: 0..<0.5), Float.random(in: -0.05...0.05)),
                                              life: 0, max: 0.5 + Float.random(in: 0..<0.4), s0: 0.55, s1: 0.1, c: SIMD3(4.0, 1.6, 0.35), a: 0.95))
                } else {
                    particles.append(Particle(p: SIMD3(f.x, 0.5, f.y), v: SIMD3(0.12, 0.5, 0.04), life: 0, max: 3.5, s0: 0.3, s1: 1.6, c: SIMD3(0.18, 0.16, 0.15), a: 0.55))
                }
            }
        }
        var i = particles.count - 1
        while i >= 0 {
            particles[i].life += dt
            if particles[i].life >= particles[i].max { particles.swapAt(i, particles.count - 1); particles.removeLast() }
            else { particles[i].p += particles[i].v * dt; particles[i].v.y *= 0.995 }
            i -= 1
        }
        _ = night
    }

    func particleData(night: Float) -> [ParticleData] {
        let light = 1 - night * 0.7
        return particles.map { p in
            let f = p.life / p.max
            let lt: Float = p.c.x > 1.5 ? 1 : light
            return ParticleData(posSize: SIMD4(p.p, p.s0 + (p.s1 - p.s0) * f), color: SIMD4(p.c * lt, p.a * min(1, f * 6) * (1 - f)))
        }
    }

    private func assemble() {
        var o: [Batch] = [roadBatch, treeBatch1, treeBatch2, lampBatch, rubbleBatch, vehicleBatch, busBatch]
        o.append(contentsOf: buildingBatches.values)
        o.append(contentsOf: serviceBatches.values)
        o.append(contentsOf: bladeBatches.values)
        opaque = o.filter { !$0.instances.isEmpty }
        transparent = [plateBatch, aoBatch].filter { !$0.instances.isEmpty }
    }

    var lightPools: Batch { poolBatch }
}

func easeOutBack(_ t: Float) -> Float { let c1: Float = 1.4, c3 = c1 + 1; return 1 + c3 * pow(t - 1, 3) + c1 * pow(t - 1, 2) }

extension simd_float4x4 { static let identity = matrix_identity_float4x4 }
