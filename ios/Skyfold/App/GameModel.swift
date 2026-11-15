import SwiftUI
import Observation
import GameController
import simd
import SkyfoldCore

struct GameSettings: Codable, Equatable {
    var quality: Quality = .balanced
    var fps: Int = 120
    var sound = true
    var haptics = true
    var disasters = true
}

enum TimeMode: String, CaseIterable, Identifiable { case auto, dawn, noon, dusk, night; var id: String { rawValue } }

struct Toast: Identifiable, Equatable { let id = UUID(); let text: String; let kind: ToastKind; let at: Int?
    static func == (a: Toast, b: Toast) -> Bool { a.id == b.id } }

/// Central game state: owns the simulation, scene, camera, input and Apple services.
@Observable
final class GameModel {
    // simulation
    private(set) var world: World
    private(set) var sim: Sim
    @ObservationIgnored private(set) var scene: CityScene!
    @ObservationIgnored let rig = CameraRig()

    // ui state (observed)
    var playing = false
    var speed = 0
    var tool: Tool = .inspect
    var overlay: Overlay = .none { didSet { overlayDirty = true; rebuildOverlay() } }
    var timeMode: TimeMode = .auto
    var settings: GameSettings { didSet { saveSettings(); haptics.enabled = settings.haptics; audio.muted = !settings.sound; world.disasters = settings.disasters } }
    var inspectTile: Int?
    var petitionOffer: Petition?
    var toasts: [Toast] = []
    var hint: String?
    var hudTick = 0
    var deskOpen = false
    var showAR = false
    var emblem: CGImage?
    var hasSave: Bool

    // render-facing (not observed)
    @ObservationIgnored var tod: Float = 0.36
    @ObservationIgnored private(set) var lighting = DayNight.lighting(0.36)
    @ObservationIgnored var overlayBytes = [UInt8](repeating: 0, count: MAP * MAP * 4)
    @ObservationIgnored var overlayDirty = true
    @ObservationIgnored private var acc: Double = 0
    @ObservationIgnored private var hudT: Float = 0
    @ObservationIgnored private var saveT: Float = 0
    @ObservationIgnored private var drag: (a: (Int, Int), b: (Int, Int))?
    @ObservationIgnored private var ghostAt: (Int, Int)?
    @ObservationIgnored private var lastSpeed = 1

    // Apple services
    @ObservationIgnored let gameCenter = GameCenterService()
    @ObservationIgnored let haptics = HapticsService()
    @ObservationIgnored let audio = AudioService()
    @ObservationIgnored let intelligence = IntelligenceService()
    @ObservationIgnored let emblems = EmblemService()
    @ObservationIgnored private var controllerSink: NSObjectProtocol?

    init() {
        let s = (try? JSONDecoder().decode(GameSettings.self, from: UserDefaults.standard.data(forKey: "skyfold.settings") ?? Data())) ?? GameSettings()
        settings = s
        let saved = Persistence.load()
        hasSave = saved != nil
        let w = saved ?? World.generate(seed: 20261115, name: "Skyfold Bay")
        world = w
        sim = Sim(world: w)
        sim.writer = intelligence.writer
        sim.delegate = self
        if saved == nil { DemoCity.build(sim) }
        sim.refreshAll()
        haptics.enabled = s.haptics
        audio.muted = !s.sound
        rig.dist = 46; rig.orbit = 0.045; rig.yaw = 0.6
        GameControllerSupport.start()
    }

    func attach(device: MTLDevice) {
        if scene == nil { scene = CityScene(device: device, world: world) }
    }

    // MARK: lifecycle
    func start() {
        playing = true
        rig.orbit = 0
        rig.flyTo(0, 0, dist: 30)
        setSpeed(1)
        gameCenter.authenticate()
        audio.start()
        toast("Welcome to \(world.name), Mayor.")
        petitionOffer = world.petitions.offer
        Task { await refreshEmblem() }
    }

    func newCity(name: String, seed: UInt32) {
        let w = World.generate(seed: seed, name: name)
        world = w
        sim = Sim(world: w)
        sim.writer = intelligence.writer
        sim.delegate = self
        sim.refreshAll()
        scene?.setWorld(w)
        petitionOffer = nil
        save()
        hasSave = true
        if !playing { start() } else { rig.flyTo(0, 0, dist: 24); toast("\(name) has been founded!", .milestone) }
        Task { await refreshEmblem() }
    }

    func save() {
        Persistence.save(world)
        IntentsSnapshot.store(from: sim)
    }

    func cloudSave() { Task { await gameCenter.saveToCloud(world) ; toast("Saved to Game Center") } }

    private func saveSettings() {
        if let d = try? JSONEncoder().encode(settings) { UserDefaults.standard.set(d, forKey: "skyfold.settings") }
    }

    @MainActor func refreshEmblem() async {
        emblem = await emblems.emblem(for: world.name, seed: world.seed)
    }

    // MARK: per-frame
    func update(dt: Float) {
        guard let scene else { return }
        if playing && speed > 0 {
            acc += Double(dt) * SPEEDS[speed]
            var steps = 0
            while acc >= SIM_DAY_SECONDS && steps < 10 { sim.step(); acc -= SIM_DAY_SECONDS; steps += 1 }
            if steps >= 10 { acc = 0 }
        }
        switch timeMode {
        case .auto: tod = (tod + dt / 480 * (speed > 0 || !playing ? max(1, Float(SPEEDS[speed]) * 0.6) : 0.15)).truncatingRemainder(dividingBy: 1)
        case .dawn: tod = 0.265
        case .noon: tod = 0.5
        case .dusk: tod = 0.765
        case .night: tod = 0.03
        }
        lighting = DayNight.lighting(tod)
        GameControllerSupport.poll(self, dt: dt)
        rig.update(dt)
        scene.update(dt: dt, speed: playing ? speed : 1, night: lighting.night, stats: sim.stats)
        audio.update(listener: rig.position, target: rig.target, pop: sim.stats.pop, fires: scene.fires)
        hudT += dt
        if hudT > 0.25 { hudT = 0; hudTick &+= 1 }
        saveT += dt
        if saveT > 30 && playing { saveT = 0; save() }
    }

    // MARK: controls
    func setSpeed(_ s: Int) { if s > 0 { lastSpeed = s }; speed = s }
    func togglePause() { setSpeed(speed == 0 ? lastSpeed : 0) }

    func select(_ t: Tool) {
        if let id = t.service, world.peakPop < SERVICES[id]!.unlock {
            haptics.play(.error)
            toast("\(SERVICES[id]!.name) unlocks at \(SERVICES[id]!.unlock.formatted()) residents", .bad)
            return
        }
        haptics.play(.select); audio.play(.select)
        tool = t
        ghostAt = nil
        scene?.ghost = nil
        scene?.previewBatch.instances = []
        scene?.cursorBatch.instances = []
        inspectTile = nil
        if let id = t.service { flash("\(SERVICES[id]!.name) · $\(SERVICES[id]!.cost.formatted()) — \(SERVICES[id]!.desc)") }
        else if t.drag != .none { flash(t == .avenue ? "Drag to build avenues — or over streets to upgrade them" : "Drag on the map to \(t == .bulldoze ? "demolish" : "build")") }
    }

    func flash(_ text: String) {
        hint = text
        let token = text
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.6) { [weak self] in if self?.hint == token { self?.hint = nil } }
    }

    func toast(_ text: String, _ kind: ToastKind = .info, at: Int? = nil) {
        let t = Toast(text: text, kind: kind, at: at)
        toasts.append(t)
        if toasts.count > 3 { toasts.removeFirst() }
        DispatchQueue.main.asyncAfter(deadline: .now() + (kind == .milestone ? 4.2 : 2.8)) { [weak self] in self?.toasts.removeAll { $0.id == t.id } }
    }

    func focus(tile i: Int) {
        let (x, z) = world.xz(i)
        let (wx, wz) = tileWorld(x, z)
        rig.flyTo(wx, wz, dist: min(rig.dist, 22))
        setCursor(x, z, size: 1, valid: true)
    }

    func setOverlay(_ o: Overlay) { overlay = o }

    // MARK: input from gestures (view-space points)
    var isDragTool: Bool { tool.drag != .none }

    func tap(at p: CGPoint, in size: CGSize) {
        guard playing, let t = rig.tile(at: p, in: size), t.inside else { return }
        tapTile(t.x, t.z)
    }

    /// Tool action on a tile (touch tap, pointer click or controller A button).
    func tapTile(_ tx: Int, _ tz: Int) {
        let t = (x: tx, z: tz)
        if tool == .inspect {
            audio.play(.click); haptics.play(.tap)
            setCursor(t.x, t.z, size: 1, valid: true)
            inspectTile = world.idx(t.x, t.z)
            return
        }
        if let id = tool.service {
            let def = SERVICES[id]!, o = (def.size - 1) / 2, x = t.x - o, z = t.z - o
            if ghostAt == nil || ghostAt! != (x, z) {
                let chk = sim.canPlaceService(x, z, id)
                showGhost(id, x, z, chk.ok)
                ghostAt = (x, z)
                haptics.play(.tap)
                hint = chk.ok ? "Tap again to build \(def.name) · $\(def.cost.formatted())" : (chk.msg ?? "")
                return
            }
            let r = sim.placeService(x, z, id)
            feedback(r) { self.audio.play(.build, at: self.worldPoint(x, z)); self.haptics.play(.build) }
            if r.ok {
                scene?.onServicePlaced(root: world.idx(x, z), size: def.size)
                ghostAt = nil; scene?.ghost = nil; scene?.cursorBatch.instances = []; hint = nil
            }
            return
        }
        if tool.drag != .none { drag = ((t.x, t.z), (t.x, t.z)); endDrag() }
    }

    func hover(at p: CGPoint?, in size: CGSize) {
        guard playing, let p, let t = rig.tile(at: p, in: size), t.inside else { return }
        if let id = tool.service {
            let def = SERVICES[id]!, o = (def.size - 1) / 2, x = t.x - o, z = t.z - o
            let ok = sim.canPlaceService(x, z, id).ok
            showGhost(id, x, z, ok); ghostAt = (x, z)
        } else if drag == nil { setCursor(t.x, t.z, size: 1, valid: true) }
    }

    func beginDrag(at p: CGPoint, in size: CGSize) {
        guard let t = rig.tile(at: p, in: size) else { return }
        drag = ((t.x, t.z), (t.x, t.z))
        updateDrag()
    }

    func moveDrag(to p: CGPoint, in size: CGSize) {
        guard drag != nil, let t = rig.tile(at: p, in: size) else { return }
        if t.x != drag!.b.0 || t.z != drag!.b.1 {
            drag!.b = (t.x, t.z)
            updateDrag()
            haptics.play(.tick)
            audio.play(.click)
        }
    }

    func cancelDrag() { drag = nil; scene?.previewBatch.instances = []; hint = nil }

    func endDrag() {
        guard let d = drag else { return }
        let tiles = dragTiles(d)
        var r: ActionResult?
        switch tool {
        case .road: r = sim.buildRoads(tiles.list, cls: 0)
        case .avenue: r = sim.buildRoads(tiles.list, cls: 1)
        case .bulldoze:
            r = sim.bulldoze(tiles.rect)
            if r?.ok == true { for (x, z) in tiles.list where Bool.random() { let (wx, wz) = tileWorld(x, z); scene?.spawnDust(wx, wz, 1) } }
        default:
            if let k = tool.zone { r = sim.zone(tiles.rect, kind: k) }
        }
        if let r {
            let pt = worldPoint(d.b.0, d.b.1)
            feedback(r) {
                switch self.tool {
                case .road, .avenue: self.audio.play(.road, at: pt); self.haptics.play(.build)
                case .bulldoze: self.audio.play(.bulldoze, at: pt); self.haptics.play(.rumble)
                default: self.audio.play(.zone, at: pt); self.haptics.play(.tap)
                }
            }
        }
        drag = nil
        scene?.previewBatch.instances = []
        hint = nil
    }

    private func dragTiles(_ d: (a: (Int, Int), b: (Int, Int))) -> (list: [(Int, Int)], rect: TileRect) {
        let cl = { (v: Int) in max(0, min(MAP - 1, v)) }
        if tool.drag == .line {
            var out: [(Int, Int)] = []
            let (ax, az) = d.a, (bx, bz) = d.b
            let hFirst = abs(bx - ax) >= abs(bz - az)
            let corner = hFirst ? (bx, az) : (ax, bz)
            func seg(_ p: (Int, Int), _ q: (Int, Int)) {
                let n = max(abs(q.0 - p.0), abs(q.1 - p.1))
                for k in 0...n {
                    let f = n == 0 ? 0 : Double(k) / Double(n)
                    out.append((Int((Double(p.0) + Double(q.0 - p.0) * f).rounded()), Int((Double(p.1) + Double(q.1 - p.1) * f).rounded())))
                }
            }
            seg(d.a, corner); seg(corner, d.b)
            let list = out.filter { $0.0 >= 0 && $0.1 >= 0 && $0.0 < MAP && $0.1 < MAP }
            return (list, TileRect(x0: 0, x1: 0, z0: 0, z1: 0))
        }
        let r = TileRect(x0: cl(min(d.a.0, d.b.0)), x1: cl(max(d.a.0, d.b.0)), z0: cl(min(d.a.1, d.b.1)), z1: cl(max(d.a.1, d.b.1)))
        var list: [(Int, Int)] = []
        for z in r.z0...r.z1 { for x in r.x0...r.x1 { list.append((x, z)) } }
        return (list, r)
    }

    private func updateDrag() {
        guard let d = drag, let scene else { return }
        let tiles = dragTiles(d).list
        var count = 0, cost = 0
        var inst: [InstanceData] = []
        let w = world
        for (x, z) in tiles {
            let i = w.idx(x, z), k = Kind(rawValue: w.kind[i]) ?? .empty
            let zoneEmpty = (k == .res || k == .com || k == .ind) && w.level[i] == 0
            var ok = false
            switch tool {
            case .road: ok = w.terrain[i] == 0 && (k == .empty || zoneEmpty); if ok { cost += ROADS[0].cost }
            case .avenue:
                ok = w.terrain[i] == 0 && (k == .empty || zoneEmpty || (k == .road && w.level[i] == 0))
                if ok { cost += k == .road ? 28 : ROADS[1].cost }
            case .bulldoze: ok = k != .empty || w.tree[i] != 0 || TileFlags(rawValue: w.flags[i]).contains(.rubble); if ok { cost += 10 }
            default:
                if let zk = tool.zone { ok = w.terrain[i] == 0 && (k == .empty || (zoneEmpty && k != zk)); if ok { cost += 25 } }
            }
            if ok { count += 1 }
            let col: SIMD3<Float>
            if !ok { col = k == .road && (tool == .road || tool == .avenue) ? SIMD3(0.6, 0.7, 0.78) : SIMD3(1, 0.3, 0.35) }
            else if tool == .bulldoze { col = SIMD3(1, 0.54, 0.29) }
            else if tool == .res { col = SIMD3(0.37, 0.82, 0.41) } else if tool == .com { col = SIMD3(0.29, 0.66, 1) } else if tool == .ind { col = SIMD3(1, 0.77, 0.28) }
            else { col = SIMD3(0.9, 0.96, 1) }
            let (wx, wz) = tileWorld(x, z)
            inst.append(InstanceData(model: .translation(wx, 0, wz), tint: SIMD4(col, 0), extra: .zero))
        }
        scene.previewBatch.instances = inst
        setCursor(d.b.0, d.b.1, size: 1, valid: true)
        hint = "\(tool.label) · \(count) tile\(count == 1 ? "" : "s") · $\(cost.formatted())\(cost > Int(world.funds) ? " (not enough funds)" : "")"
    }

    private func showGhost(_ id: ServiceID, _ x: Int, _ z: Int, _ ok: Bool) {
        guard let scene else { return }
        let def = SERVICES[id]!, (wx, wz) = tileWorld(x, z), off = Float(def.size - 1) / 2
        let col: SIMD3<Float> = ok ? SIMD3(0.62, 0.88, 1) : SIMD3(1, 0.5, 0.5)
        scene.ghost = Batch(mesh: scene.serviceMesh(id).0, instances: [InstanceData(model: .translation(wx + off, 0, wz + off), tint: SIMD4(col, -1), extra: .zero)], shadow: false)
        setCursor(x, z, size: def.size, valid: ok)
    }

    private func setCursor(_ x: Int, _ z: Int, size: Int, valid: Bool) {
        let (wx, wz) = tileWorld(x, z), off = Float(size - 1) / 2
        scene?.cursorBatch.instances = [InstanceData(model: .translation(wx + off, 0, wz + off) * .scale(Float(size), 1, Float(size)),
                                                     tint: SIMD4(valid ? SIMD3(1, 1, 1) : SIMD3(1, 0.35, 0.35), 0), extra: .zero)]
    }

    private func worldPoint(_ x: Int, _ z: Int) -> SIMD3<Float> { let (wx, wz) = tileWorld(x, z); return SIMD3(wx, 0.2, wz) }

    private func feedback(_ r: ActionResult, ok: () -> Void) {
        if r.ok { ok(); hudTick &+= 1 }
        else { audio.play(.error); haptics.play(.error); toast(r.msg ?? "Can't do that", .bad) }
    }

    // MARK: camera gestures
    func panCamera(from a: CGPoint, to b: CGPoint, in size: CGSize) {
        guard let ga = rig.ground(at: a, in: size), let gb = rig.ground(at: b, in: size) else { return }
        rig.target.x += ga.x - gb.x; rig.target.z += ga.z - gb.z
        rig.goal = nil
        if !playing { rig.orbit = 0 }
    }
    func fling(_ v: SIMD2<Float>) { rig.vel = v }
    func pinch(_ scale: Float, at p: CGPoint, in size: CGSize) { rig.zoom(by: 1 / max(0.2, scale), at: p, in: size) }
    func rotate(_ radians: Float) { rig.yaw -= radians }
    func cameraAction(_ a: String) {
        switch a {
        case "rotl": rig.yaw += .pi / 4
        case "rotr": rig.yaw -= .pi / 4
        case "top": rig.flyTo(0, 0, dist: 95)
        default: rig.flyTo(0, 0, dist: 26)
        }
    }

    // MARK: overlay texture
    func rebuildOverlay() {
        let w = world
        for z in 0..<MAP { for x in 0..<MAP {
            let i = z * MAP + x, o = i * 4
            var c: (Double, Double, Double, Double) = (0, 0, 0, 0)
            let k = Kind(rawValue: w.kind[i]) ?? .empty
            let dev = k != .empty
            if w.terrain[i] == 0 {
                switch overlay {
                case .traffic: if k == .road { let v = min(1, Double(w.traffic[i]) / 130); c = (60 + 195 * min(1, v * 2), 220 - 180 * max(0, v * 2 - 1), 70, 235) }
                case .happy: if k == .res && w.level[i] > 0 { let v = Double(w.happy[i]) / 100; c = (255 * (1 - v) + 40 * v, 70 + 185 * v, 90 + 60 * v, 210) }
                case .edu: let v = Double(w.cov.edu[i]) / 255; c = (120, 90 + 60 * v, 255, v * 220)
                case .garbage: let v = min(1, Double(w.garbage[i]) / 70); c = (150, 110, 40, v * 235)
                case .power: if dev && k != .road { c = w.power[i] != 0 ? (60, 230, 120, 200) : (255, 60, 60, 200) }
                case .water: if w.water[i] != 0 { c = (60, 160, 255, 170) } else if dev && k != .road { c = (255, 120, 60, 150) }
                case .lv: let v = Double(w.lv[i]) / 100; c = (255 * (1 - v) + 40 * v, 80 + 175 * v, 60, 160)
                case .pollution: c = (150, 90, 40, min(1, Double(w.pollution[i]) / 60) * 230)
                case .crime: c = (255, 40, 90, min(1, Double(w.crime[i]) / 50) * 230)
                case .none: break
                }
            }
            overlayBytes[o] = UInt8(c.0); overlayBytes[o + 1] = UInt8(c.1); overlayBytes[o + 2] = UInt8(c.2); overlayBytes[o + 3] = UInt8(c.3)
        } }
        overlayDirty = true
    }
}

// MARK: - SimDelegate (sim calls on the main thread; async AI posts may arrive from tasks)
extension GameModel: SimDelegate {
    func simTilesChanged(_ tiles: [Int]) { onMain { self.scene?.onTilesChanged(); if self.overlay != .none { self.rebuildOverlay() } } }
    func simGrew(_ tile: Int, up: Bool) { onMain { self.scene?.onGrow(tile, up: up); if up { self.audio.play(.grow, at: self.worldPoint(tile % MAP, tile / MAP), volume: 0.25) } } }
    func simToast(_ text: String, kind: ToastKind, at: Int?) {
        onMain {
            guard self.playing else { return }
            self.toast(text, kind, at: at)
            if kind == .milestone { self.audio.play(.milestone); self.haptics.play(.success) }
            else if kind == .bad && at != nil { self.audio.play(.alarm); self.haptics.play(.rumble) }
        }
    }
    func simFire(_ tile: Int, state: FireState) { onMain { self.scene?.onFire(tile, state) } }
    func simMonth() {
        onMain {
            guard self.playing else { return }
            if self.overlay != .none { self.rebuildOverlay() }
            if self.sim.stats.income > self.sim.stats.expense { self.audio.play(.cash, volume: 0.4) }
            self.gameCenter.submit(population: self.sim.stats.pop, approval: Int(self.world.approval), funds: Int(self.world.funds))
            IntentsSnapshot.store(from: self.sim)
            self.hudTick &+= 1
        }
    }
    func simPetition(_ p: Petition?) { onMain { if self.playing { self.petitionOffer = p; if p != nil { self.haptics.play(.select) } } } }
    func simFeed(_ item: FeedItem) { onMain { self.hudTick &+= 1 } }
    func simAchievement(_ id: String) { onMain { self.gameCenter.unlock(achievement: id) } }

    private func onMain(_ f: @escaping () -> Void) { if Thread.isMainThread { f() } else { DispatchQueue.main.async(execute: f) } }
}
