// City simulation (port of game/src/sim.js). Interlocking systems:
//  networks  → roads, power grid (with brownouts), water coverage
//  traffic   → every household routes a commute to the nearest job over the
//              road graph; loads become congestion, commute time and pollution
//  workforce → education splits workers into low/high skill; jobs have skill
//              needs; unemployment and vacancies feed demand and happiness
//  fields    → land value, pollution, crime, health, education, garbage
//  life      → growth, decline, abandonment, fires, rubble
//  economy   → taxes by wealth, department budgets, policies, loans, tourism
import Foundation

// MARK: - Stats

public struct Factor: Hashable {
    public let label: String
    public let value: Int
    public init(label: String, value: Int) { self.label = label; self.value = value }
}

public struct Breakdown {
    public var incR = 0, incC = 0, incI = 0, fares = 0, tourism = 0, roads = 0
    public var svc: [ServiceID: Double] = [:]
    public var policies = 0
    public var loans = 0
    public init() {}
}

public struct Stats {
    public var pop = 0, comJobs = 0, indJobs = 0, jobs = 0, workers = 0, happiness = 60
    public var powerSupply = 0, powerDemand = 0
    public var income = 0, expense = 0, unpowered = 0, unwatered = 0
    public var avgPollution = 0.0, avgCrime = 0.0
    public var roads = 0
    public var unemployment = 0.0
    public var unreachable = 0, highJobs = 0, lowJobs = 0, highWorkers = 0, lowWorkers = 0
    public var highVac = 0.0, lowVac = 0.0
    public var education = 0, congestion = 0, jammed = 0, avgCommute = 0, trips = 0, transitRiders = 0
    public var garbageProd = 0, garbageCap = 0
    public var avgGarbage = 0.0
    public var burning = 0, abandoned = 0, health = 0, tourists = 0, debt = 0
    public var employedEst = 0
    public var factors: [Factor] = []
    public var breakdown: Breakdown?
    public init() {}
}

// MARK: - Delegate

public protocol SimDelegate: AnyObject {
    func simTilesChanged(_ tiles: [Int])
    func simGrew(_ tile: Int, up: Bool)
    func simToast(_ text: String, kind: ToastKind, at: Int?)
    func simFire(_ tile: Int, state: FireState)
    func simMonth()
    func simPetition(_ p: Petition?)
    func simFeed(_ item: FeedItem)
    func simAchievement(_ id: String)
}

public extension SimDelegate {
    func simTilesChanged(_ tiles: [Int]) {}
    func simGrew(_ tile: Int, up: Bool) {}
    func simToast(_ text: String, kind: ToastKind, at: Int?) {}
    func simFire(_ tile: Int, state: FireState) {}
    func simMonth() {}
    func simPetition(_ p: Petition?) {}
    func simFeed(_ item: FeedItem) {}
    func simAchievement(_ id: String) {}
}

// MARK: - Sim

public final class Sim: @unchecked Sendable {
    public internal(set) var world: World
    public weak var delegate: SimDelegate?
    public var writer: TextWriter = ProceduralWriter()
    public var stats = Stats()
    public var demand = Demand(r: 1, c: 0.6, i: 0.8)
    public var advice: [Advice] = []
    public var rng: () -> Double = { Double.random(in: 0..<1) }
    public let events: Events
    public var netDirty = true
    public var fieldsDirty = true
    /// Queue that async writer results (headlines, chirps, petition text) are delivered on.
    /// nil = deliver on whatever thread the writer finished on.
    public var callbackQueue: DispatchQueue? = .main

    var slice = 0

    // Reusable scratch buffers (avoid per-step allocations).
    private var queue: [Int] = []
    private var comp = [Int32](repeating: -1, count: N)
    private var tDist = [UInt16](repeating: 0, count: N)
    private var tNext = [Int32](repeating: -1, count: N)
    private var tLoad = [Float](repeating: 0, count: N)
    private var tPaths: [(Int, Int)] = []

    static let factorLabels = ["Land value", "No power", "No water", "Health", "Safety", "Education",
                               "No route to work", "Commute", "Garbage", "Jobs", "Taxes", "High-rise ban", "Curfew"]

    public init(world: World) {
        self.world = world
        self.events = Events()
        queue.reserveCapacity(N)
        tPaths.reserveCapacity(N)
        events.sim = self
        recount()
    }

    /// Swap in a different world (e.g. after loading a save) and recompute everything.
    public func replaceWorld(_ w: World) {
        world = w
        slice = 0
        stats = Stats()
        netDirty = true; fieldsDirty = true
        refreshAll()
    }

    public func has(_ p: PolicyID) -> Bool { world.policies.contains(p) }

    func deptMul(_ dept: Dept?) -> Double {
        guard let d = dept else { return 1 }
        return Double(world.budget[d] ?? 100) / 100
    }

    // MARK: delegate helpers

    func toast(_ text: String, _ kind: ToastKind, at: Int? = nil) {
        delegate?.simToast(text, kind: kind, at: at)
    }

    // ======================================================== actions

    public func canAfford(_ cost: Int) -> Bool { world.funds >= Double(cost) }
    func spend(_ cost: Int) { world.funds -= Double(cost) }

    public func buildRoads(_ tiles: [(Int, Int)], cls: Int = 0) -> ActionResult {
        let w = world
        let rc = max(0, min(ROADS.count - 1, cls))
        var todo: [Int] = []
        var cost = 0
        for (x, z) in tiles {
            if !w.inb(x, z) { continue }
            let i = w.idx(x, z)
            if w.terrain[i] != 0 || w.kind[i] == K.service { continue }
            if w.kind[i] == K.road {
                if rc == 1 && w.level[i] == 0 { todo.append(i); cost += Cost.upgrade }
                continue
            }
            if isZoneKind(w.kind[i]) && w.level[i] > 0 { continue }
            todo.append(i); cost += ROADS[rc].cost
        }
        if todo.isEmpty {
            return .fail(rc != 0 ? "Drag over streets to upgrade them, or open land" : "Nothing to build here")
        }
        if !canAfford(cost) { return .fail("Not enough funds") }
        for i in todo {
            w.kind[i] = K.road; w.level[i] = UInt8(rc); w.tree[i] = 0; w.root[i] = Int32(i)
            w.flags[i] = 0; w.garbage[i] = 0
        }
        spend(cost)
        afterChange(todo)
        return ActionResult(ok: true, cost: cost, count: todo.count)
    }

    public func zone(_ r: TileRect, kind: Kind) -> ActionResult {
        guard kind.isZone else { return .fail("Not a zone type") }
        let w = world, kr = kind.rawValue
        var list: [Int] = []
        if r.z0 <= r.z1 && r.x0 <= r.x1 {
            for z in r.z0...r.z1 {
                for x in r.x0...r.x1 {
                    if !w.inb(x, z) { continue }
                    let i = w.idx(x, z)
                    if w.terrain[i] != 0 || (w.flags[i] & F.rubble) != 0 { continue }
                    let k = w.kind[i]
                    if k == K.empty || (isZoneKind(k) && k != kr && w.level[i] == 0) { list.append(i) }
                }
            }
        }
        if list.isEmpty { return .fail("No free land to zone") }
        let cost = list.count * Cost.zone
        if !canAfford(cost) { return .fail("Not enough funds") }
        for i in list { w.kind[i] = kr; w.level[i] = 0; w.root[i] = Int32(i); w.distress[i] = 0 }
        spend(cost)
        afterChange(list)
        return ActionResult(ok: true, cost: cost, count: list.count)
    }

    public func canPlaceService(_ x: Int, _ z: Int, _ id: ServiceID) -> ActionResult {
        let w = world
        guard let s = SERVICES[id] else { return .fail("Unknown building") }
        if w.peakPop < s.unlock { return .fail("Unlocks at \(formatThousands(s.unlock)) population") }
        for oz in 0..<s.size {
            for ox in 0..<s.size {
                let tx = x + ox, tz = z + oz
                if !w.inb(tx, tz) { return .fail("Out of bounds") }
                let i = w.idx(tx, tz)
                if w.terrain[i] != 0 { return .fail("Cannot build on water") }
                if (w.flags[i] & F.rubble) != 0 { return .fail("Clear the rubble first") }
                let k = w.kind[i]
                if k != K.empty && !(isZoneKind(k) && w.level[i] == 0) { return .fail("Space is occupied") }
            }
        }
        if !canAfford(s.cost) { return .fail("Not enough funds") }
        return ActionResult(ok: true, cost: s.cost)
    }

    public func placeService(_ x: Int, _ z: Int, _ id: ServiceID) -> ActionResult {
        let chk = canPlaceService(x, z, id)
        if !chk.ok { return chk }
        let w = world
        guard let s = SERVICES[id] else { return .fail("Unknown building") }
        let r = w.idx(x, z)
        var changed: [Int] = []
        let sv = svcIndex(id)
        for oz in 0..<s.size {
            for ox in 0..<s.size {
                let i = w.idx(x + ox, z + oz)
                w.kind[i] = K.service; w.svc[i] = sv; w.root[i] = Int32(r); w.tree[i] = 0; w.level[i] = 1; w.flags[i] = 0
                changed.append(i)
            }
        }
        w.rot[r] = UInt8(faceRoad(x, z, s.size))
        spend(s.cost)
        events.fact(Fact(type: "built", fields: ["id": id.rawValue, "district": w.district(x, z)]))
        afterChange(changed)
        return ActionResult(ok: true, cost: s.cost, count: 1)
    }

    public func bulldoze(_ r: TileRect) -> ActionResult {
        let w = world
        var roots: [Int] = []
        var rootSet = Set<Int>()
        var trees: [Int] = []
        var rubble: [Int] = []
        if r.z0 <= r.z1 && r.x0 <= r.x1 {
            for z in r.z0...r.z1 {
                for x in r.x0...r.x1 {
                    if !w.inb(x, z) { continue }
                    let i = w.idx(x, z)
                    if (w.flags[i] & F.rubble) != 0 {
                        rubble.append(i)
                    } else if w.kind[i] != K.empty {
                        let rt = w.kind[i] == K.service ? Int(w.root[i]) : i
                        if rt >= 0 && !rootSet.contains(rt) { rootSet.insert(rt); roots.append(rt) }
                    } else if w.tree[i] != 0 {
                        trees.append(i)
                    }
                }
            }
        }
        let n = roots.count + trees.count + rubble.count
        if n == 0 { return .fail("Nothing to bulldoze") }
        let cost = n * Cost.bulldoze
        if !canAfford(cost) { return .fail("Not enough funds") }
        var changed = trees + rubble
        for i in trees { w.tree[i] = 0 }
        for i in rubble { w.flags[i] = 0; w.fireT[i] = 0 }
        for rt in roots {
            if w.kind[rt] == K.service, let s = sdef(w.svc[rt]) {
                let (rx, rz) = w.xz(rt)
                for oz in 0..<s.size {
                    for ox in 0..<s.size {
                        if !w.inb(rx + ox, rz + oz) { continue }
                        let i = w.idx(rx + ox, rz + oz)
                        clearTile(i); changed.append(i)
                    }
                }
            } else {
                clearTile(rt); changed.append(rt)
            }
        }
        spend(cost)
        afterChange(changed)
        return ActionResult(ok: true, cost: cost, count: n)
    }

    func clearTile(_ i: Int) {
        let w = world
        w.kind[i] = K.empty; w.level[i] = 0; w.svc[i] = 0; w.root[i] = -1; w.variant[i] = 0
        w.flags[i] = 0; w.fireT[i] = 0; w.distress[i] = 0; w.garbage[i] = 0
    }

    func afterChange(_ changed: [Int]) {
        netDirty = true; fieldsDirty = true
        recount()
        delegate?.simTilesChanged(changed)
    }

    func faceRoad(_ x: Int, _ z: Int, _ size: Int = 1) -> Int {
        let w = world
        for d in [2, 1, 3, 0] {
            for k in 0..<size {
                var tx = 0, tz = 0
                switch d {
                case 0: tx = x + k; tz = z - 1
                case 2: tx = x + k; tz = z + size
                case 1: tx = x + size; tz = z + k
                default: tx = x - 1; tz = z + k
                }
                if w.inb(tx, tz) && w.kind[w.idx(tx, tz)] == K.road { return d }
            }
        }
        return 2
    }

    public func setPolicy(_ id: PolicyID, on: Bool) {
        let w = world, had = has(id)
        if on && !had { w.policies.append(id) }
        if !on && had { w.policies.removeAll { $0 == id } }
        events.fact(Fact(type: "policy", fields: ["id": id.rawValue, "on": on ? "true" : "false"]))
        fieldsDirty = true; netDirty = true
        computeDemand()
    }

    /// Takes a 10-year loan. `cost` of the result is the monthly payment.
    public func takeLoan(_ amount: Int) -> ActionResult {
        let w = world
        if w.loans.count >= 3 { return .fail("The bank won’t lend more than 3 loans") }
        if amount <= 0 { return .fail("Invalid amount") }
        let months = 120, r = 0.055 / 12
        let payment = Int(jsRound((Double(amount) * r) / (1 - pow(1 + r, Double(-months)))))
        w.loans.append(Loan(amount: amount, payment: payment, left: months))
        w.funds += Double(amount)
        events.fact(Fact(type: "loan", fields: ["amount": String(amount)]))
        return ActionResult(ok: true, cost: payment)
    }

    /// Repays a loan early. `cost` of the result is the balance paid.
    public func repayLoan(_ index: Int) -> ActionResult {
        let w = world
        guard index >= 0 && index < w.loans.count else { return ActionResult(ok: false) }
        let L = w.loans[index]
        let r = 0.055 / 12
        let balance = Int(jsRound(Double(L.payment) * (1 - pow(1 + r, Double(-L.left))) / r))
        if w.funds < Double(balance) { return .fail("Need $\(formatThousands(balance)) to repay") }
        w.funds -= Double(balance)
        w.loans.remove(at: index)
        return ActionResult(ok: true, cost: balance)
    }

    /// Outstanding balance if loan `index` were repaid now.
    public func loanBalance(_ index: Int) -> Int {
        guard index >= 0 && index < world.loans.count else { return 0 }
        let L = world.loans[index], r = 0.055 / 12
        return Int(jsRound(Double(L.payment) * (1 - pow(1 + r, Double(-L.left))) / r))
    }

    // ======================================================== networks

    func tileDemand(_ i: Int) -> Int {
        let w = world, k = w.kind[i]
        if (w.flags[i] & (F.abandoned | F.rubble)) != 0 { return 0 }
        if isZoneKind(k) { return zonePower(k, lvlIndex(w.level[i])) }
        if k == K.service && w.root[i] == Int32(i), let s = sdef(w.svc[i]) { return s.power > 0 ? 0 : 2 * s.size }
        return 0
    }

    func computeNetworks() {
        let w = world
        // road distance + nearest road (multi-source BFS)
        for i in 0..<N { w.roadDist[i] = 9; w.nearestRoad[i] = -1 }
        queue.removeAll(keepingCapacity: true)
        for i in 0..<N where w.kind[i] == K.road {
            w.roadDist[i] = 0; w.nearestRoad[i] = Int32(i); queue.append(i)
        }
        var h = 0
        while h < queue.count {
            let i = queue[h]; h += 1
            let d = w.roadDist[i]
            if d >= 4 { continue }
            let x = i % MAP, z = i / MAP
            for k in 0..<4 {
                let nx = x + DIRS_X[k], nz = z + DIRS_Z[k]
                if nx < 0 || nz < 0 || nx >= MAP || nz >= MAP { continue }
                let j = nz * MAP + nx
                if w.roadDist[j] > d + 1 { w.roadDist[j] = d + 1; w.nearestRoad[j] = w.nearestRoad[i]; queue.append(j) }
            }
        }
        // power grid
        for i in 0..<N { w.power[i] = 0; comp[i] = -1 }
        var supplyTotal = 0.0, demandTotal = 0
        for i in 0..<N { demandTotal += tileDemand(i) }
        let rooftop = has(.rooftop)
        var cid: Int32 = 0
        for i in 0..<N {
            if w.kind[i] != K.service || w.root[i] != Int32(i) || comp[i] >= 0 { continue }
            guard let sd = sdef(w.svc[i]), sd.power > 0 else { continue }
            queue.removeAll(keepingCapacity: true)
            queue.append(i); comp[i] = cid
            var supply = 0.0, dem = 0
            var qh = 0
            while qh < queue.count {
                let t = queue[qh]; qh += 1
                let kt = w.kind[t]
                if kt == K.service && w.root[t] == Int32(t), let ss = sdef(w.svc[t]), ss.power > 0 { supply += Double(ss.power) }
                if rooftop && kt == K.res && w.level[t] > 0 && w.level[t] < 3 { supply += 0.5 }
                dem += tileDemand(t)
                let x = t % MAP, z = t / MAP
                for k in 0..<4 {
                    let nx = x + DIRS_X[k], nz = z + DIRS_Z[k]
                    if nx < 0 || nz < 0 || nx >= MAP || nz >= MAP { continue }
                    let j = nz * MAP + nx
                    if comp[j] < 0 && w.kind[j] != K.empty { comp[j] = cid; queue.append(j) }
                }
            }
            let ratio = Double(dem) <= supply ? 1.0 : supply / Double(dem)
            for t in queue { w.power[t] = (ratio >= 1 || hash01(t, 7) < ratio) ? 1 : 0 }
            supplyTotal += supply
            cid += 1
        }
        // water
        for i in 0..<N { w.water[i] = 0 }
        let towerByte = svcIndex(.tower)
        let R = SERVICES[.tower]?.waterRadius ?? 9
        for i in 0..<N {
            if w.kind[i] != K.service || w.root[i] != Int32(i) || w.svc[i] != towerByte || w.power[i] == 0 { continue }
            let x0 = i % MAP, z0 = i / MAP
            for z in (z0 - R)...(z0 + R) {
                for x in (x0 - R)...(x0 + R) {
                    if !w.inb(x, z) || (x - x0) * (x - x0) + (z - z0) * (z - z0) > R * R { continue }
                    w.water[z * MAP + x] = 1
                }
            }
        }
        stats.powerSupply = Int(jsRound(supplyTotal))
        stats.powerDemand = demandTotal
        netDirty = false
    }

    // ======================================================== traffic & commutes

    func computeTraffic() {
        let w = world
        let INF: UInt16 = 65535
        for i in 0..<N { tDist[i] = INF; tNext[i] = -1; tLoad[i] = 0 }
        queue.removeAll(keepingCapacity: true)
        // sources: access roads of job sites
        for i in 0..<N {
            let k = w.kind[i]
            if (k == K.com || k == K.ind) && w.level[i] != 0 && (w.flags[i] & F.abandoned) == 0 && w.roadDist[i] <= 3 {
                let r = Int(w.nearestRoad[i])
                if r >= 0 && tDist[r] != 0 { tDist[r] = 0; queue.append(r) }
            }
        }
        var h = 0
        while h < queue.count {
            let i = queue[h]; h += 1
            let x = i % MAP, z = i / MAP
            let d = tDist[i] &+ 1
            for k in 0..<4 {
                let nx = x + DIRS_X[k], nz = z + DIRS_Z[k]
                if nx < 0 || nz < 0 || nx >= MAP || nz >= MAP { continue }
                let j = nz * MAP + nx
                if w.kind[j] == K.road && tDist[j] > d { tDist[j] = d; tNext[j] = Int32(i); queue.append(j) }
            }
        }
        let transitBoost = (has(.freebus) ? 1.5 : 1.0) * deptMul(.transit)
        var trips = 0.0, riders = 0.0
        var commuteSum = 0, commuteN = 0
        tPaths.removeAll(keepingCapacity: true)
        for i in 0..<N {
            let k = w.kind[i]
            if k != K.res || w.level[i] == 0 || (w.flags[i] & F.abandoned) != 0 {
                if k == K.res { w.commute[i] = 0 }
                continue
            }
            let r = Int(w.nearestRoad[i])
            if r < 0 || w.roadDist[i] > 3 || tDist[r] == INF { w.commute[i] = 255; continue }
            let workers = Double(RES_POP[lvlIndex(w.level[i])]) * 0.55
            let share = clamp((Double(w.cov.transit[i]) / 255) * transitBoost, 0, 0.8)
            let t = workers * (1 - share)
            riders += workers * share
            trips += t
            var c = r, n = 0
            while c >= 0 && n < 300 {
                tLoad[c] = Float(Double(tLoad[c]) + t)
                if tDist[c] == 0 { break }
                c = Int(tNext[c]); n += 1
            }
            tPaths.append((i, r))
        }
        // shoppers & deliveries
        for i in 0..<N {
            let k = w.kind[i]
            if (k == K.com || k == K.ind) && w.level[i] != 0 && w.nearestRoad[i] >= 0 {
                let r = Int(w.nearestRoad[i])
                let add = Double(zoneJobs(k, lvlIndex(w.level[i]))) * (k == K.com ? 0.35 : 0.2)
                tLoad[r] = Float(Double(tLoad[r]) + add)
            }
        }
        var cong = 0.0, congW = 0.0, jammed = 0
        for i in 0..<N {
            if w.kind[i] != K.road { w.traffic[i] = 0; continue }
            let ld = Double(tLoad[i])
            let pct = (ld / ROADS[w.level[i] >= 1 ? 1 : 0].cap) * 100
            w.traffic[i] = UInt8(clamp(jsRound(pct), 0, 255))
            if pct > 100 { jammed += 1 }
            cong += min(pct, 250) * ld
            congW += ld
        }
        for (i, r) in tPaths {
            var c = r, n = 0, sum = 0.0
            while c >= 0 && n < 300 {
                sum += Double(min(250, Int(w.traffic[c])))
                if tDist[c] == 0 { break }
                c = Int(tNext[c]); n += 1
            }
            let len = Double(n + 1), avg = sum / len
            let minutes = Double(w.roadDist[i]) * 2 + len * (1 + max(0, avg - 60) / 60) * 1.4 + 4
            w.commute[i] = UInt8(clamp(jsRound(minutes), 1, 254))
            commuteSum += Int(w.commute[i]); commuteN += 1
        }
        stats.trips = Int(jsRound(trips))
        stats.transitRiders = Int(jsRound(riders))
        stats.congestion = congW > 0 ? Int(jsRound(cong / congW)) : 0
        stats.jammed = jammed
        stats.avgCommute = commuteN > 0 ? Int(jsRound(Double(commuteSum) / Double(commuteN))) : 0
    }

    // ======================================================== fields

    /// Calls `fn(tile, falloff)` for every tile within `R` of the footprint centre.
    @inline(__always)
    private func radial(_ i: Int, _ size: Int, _ R: Double, _ fn: (Int, Double) -> Void) {
        if !(R > 0) { return }
        let x0 = i % MAP, z0 = i / MAP
        let c = Double(size - 1) / 2
        let zs = Int((Double(z0) + c - R).rounded(.down)), ze = Int((Double(z0) + c + R).rounded(.up))
        let xs = Int((Double(x0) + c - R).rounded(.down)), xe = Int((Double(x0) + c + R).rounded(.up))
        if zs > ze || xs > xe { return }
        let r2 = R * R, invR = 1 / R
        for z in max(0, zs)...min(MAP - 1, max(0, ze)) {
            let dz = Double(z - z0) - c, dz2 = dz * dz
            if dz2 > r2 { continue }
            let row = z * MAP
            for x in max(0, xs)...min(MAP - 1, max(0, xe)) {
                let dx = Double(x - x0) - c
                let d2 = dx * dx + dz2
                if d2 <= r2 { fn(row + x, 1 - d2.squareRoot() * invR) }
            }
        }
    }

    private func putCoverage(_ arr: inout [UInt8], _ i: Int, _ size: Int, _ R: Double, _ strength: Double) {
        radial(i, size, R) { j, f in
            let v = UInt8(clamp(jsRound(255 * clamp(f * 1.4 * strength, 0, 1)), 0, 255))
            if v > arr[j] { arr[j] = v }
        }
    }

    func computeFields() {
        let w = world
        var police = [UInt8](repeating: 0, count: N)
        var fire = police, health = police, edu = police, transit = police, gcov = police, uniCov = police
        var pol = [Float](repeating: 0, count: N)
        var parkAdd = [Float](repeating: 0, count: N)
        var services: [Int] = []
        for i in 0..<N where w.kind[i] == K.service && w.root[i] == Int32(i) && (w.flags[i] & F.rubble) == 0 {
            services.append(i)
        }
        let parkByte = svcIndex(.park)
        var garbageCap = 0
        for i in services {
            guard let s = sdef(w.svc[i]) else { continue }
            let powered = w.power[i] != 0 || s.power > 0
            let mul = deptMul(s.dept) * (powered ? 1 : 0.35)
            let R = s.radius > 0 ? Double(s.radius) * max(0.3, mul).squareRoot() : 0
            if let dept = s.dept {
                switch dept {
                case .police: putCoverage(&police, i, s.size, R, mul)
                case .fire: putCoverage(&fire, i, s.size, R, mul)
                case .health: putCoverage(&health, i, s.size, R, (s.strength > 0 ? s.strength : 1) * mul)
                case .edu:
                    if s.uni { putCoverage(&uniCov, i, s.size, R, mul) } else { putCoverage(&edu, i, s.size, R, mul) }
                case .transit: break
                }
            }
            if s.transit > 0 {
                let tr = s.transit
                radial(i, s.size, R) { j, f in
                    let v = UInt8(clamp(jsRound(255 * tr * min(1, f * 1.6) * mul), 0, 255))
                    if v > transit[j] { transit[j] = v }
                }
            }
            if s.garbage > 0 {
                garbageCap += s.garbage
                radial(i, s.size, Double(s.radius)) { j, _ in gcov[j] = 1 }
            }
            if s.lv > 0 {
                let lvv = Double(s.lv)
                radial(i, s.size, Double(s.lvRadius)) { j, f in parkAdd[j] = Float(Double(parkAdd[j]) + lvv * f) }
            }
            if s.pollution > 0 {
                let pv = Double(s.pollution)
                radial(i, s.size, 8) { j, f in pol[j] = Float(Double(pol[j]) + pv * f) }
            }
            if w.svc[i] == parkByte {
                radial(i, 1, 3) { j, f in pol[j] = Float(Double(pol[j]) - 12 * f) }
            }
        }
        // education: schools + university
        for i in 0..<N { edu[i] = u8t(min(255, Double(edu[i]) * 0.75 + Double(uniCov[i]) * 0.6)) }
        for i in 0..<N {
            let k = w.kind[i]
            if k == K.ind && w.level[i] > 0 && (w.flags[i] & F.abandoned) == 0 {
                let p = Double(IND_POLLUTION[lvlIndex(w.level[i])])
                radial(i, 1, 6) { j, f in pol[j] = Float(Double(pol[j]) + p * f * 0.55) }
            }
            if k == K.road && w.traffic[i] > 40 {
                let p = min(30, Double(Int(w.traffic[i]) - 40) * 0.12)
                radial(i, 1, 2) { j, f in pol[j] = Float(Double(pol[j]) + p * f) }
            }
            if (w.flags[i] & F.burning) != 0 {
                radial(i, 1, 4) { j, f in pol[j] = Float(Double(pol[j]) + 30 * f) }
            }
        }
        w.cov = Coverage(police: police, fire: fire, health: health, edu: edu, transit: transit, garbage: gcov)

        // garbage production vs. capacity
        let recycle = has(.recycle) ? 0.65 : 1.0
        var prod = 0.0
        for i in 0..<N {
            let k = w.kind[i]
            if isZoneKind(k) && w.level[i] != 0 && (w.flags[i] & F.abandoned) == 0 {
                prod += Double(zoneGarbage(k, lvlIndex(w.level[i]))) * 10 * recycle
            }
        }
        let ratio = prod > 0 ? min(1, Double(garbageCap) / prod) : 1
        stats.garbageProd = Int(jsRound(prod))
        stats.garbageCap = garbageCap
        let popFactor = stats.pop > 250 ? 1.0 : 0.25
        var gSum = 0, gN = 0
        for i in 0..<N {
            let k = w.kind[i]
            if !isZoneKind(k) || w.level[i] == 0 {
                if k != K.service { w.garbage[i] = 0 }
                continue
            }
            let make = (w.flags[i] & F.abandoned) != 0 ? 0 : Double(zoneGarbage(k, lvlIndex(w.level[i]))) * recycle * popFactor
            let cur = Double(w.garbage[i])
            let g = gcov[i] != 0 ? cur + make - 9 * ratio : cur + make
            w.garbage[i] = UInt8(clamp(jsRound(g), 0, 100))
            gSum += Int(w.garbage[i]); gN += 1
        }
        stats.avgGarbage = gN > 0 ? Double(gSum) / Double(gN) : 0

        let trafficPol = min(10, Double(stats.pop) / 1500)
        let crimeMul = (has(.watch) ? 0.8 : 1.0) * (has(.curfew) ? 0.85 : 1.0)
        let unemp = stats.unemployment
        let highrise = has(.highrise)
        // Summed-area tables → O(1) neighbourhood sums (was a 5×5 scan per tile).
        let S = MAP + 1
        var satTree = [Int32](repeating: 0, count: S * S), satDens = satTree, satAband = satTree, satInd = satTree
        for z in 0..<MAP {
            for x in 0..<MAP {
                let i = z * MAP + x, k = w.kind[i], L = Int32(w.level[i]), o = (z + 1) * S + (x + 1)
                let up = o - S, left = o - 1, diag = o - S - 1
                satTree[o] = (w.tree[i] != 0 ? 1 : 0) + satTree[up] + satTree[left] - satTree[diag]
                satDens[o] = ((k == K.res || k == K.com) && L != 0 ? L : 0) + satDens[up] + satDens[left] - satDens[diag]
                satAband[o] = ((w.flags[i] & F.abandoned) != 0 ? 1 : 0) + satAband[up] + satAband[left] - satAband[diag]
                satInd[o] = (k == K.ind && L != 0 ? 1 : 0) + satInd[up] + satInd[left] - satInd[diag]
            }
        }
        func boxSum(_ t: [Int32], _ x: Int, _ z: Int, _ r: Int) -> Int {
            let x0 = max(0, x - r), z0 = max(0, z - r), x1 = min(MAP - 1, x + r) + 1, z1 = min(MAP - 1, z + r) + 1
            return Int(t[z1 * S + x1] - t[z0 * S + x1] - t[z1 * S + x0] + t[z0 * S + x0])
        }
        var polSum = 0.0, crimeSum = 0.0, healthSum = 0.0, eduSum = 0.0
        var cnt = 0, resN = 0
        for i in 0..<N {
            let x = i % MAP, z = i / MAP
            let trees = boxSum(satTree, x, z, 2), dens = boxSum(satDens, x, z, 2)
            let aband = boxSum(satAband, x, z, 2), nearInd = boxSum(satInd, x, z, 1)
            var traf = 0
            for nz in max(0, z - 1)...min(MAP - 1, z + 1) {
                for nx in max(0, x - 1)...min(MAP - 1, x + 1) {
                    let j = nz * MAP + nx
                    if w.kind[j] == K.road && Int(w.traffic[j]) > traf { traf = Int(w.traffic[j]) }
                }
            }
            let ki = w.kind[i]
            let gi = Double(w.garbage[i])
            var p = Double(pol[i]) - Double(trees) * 0.8
            p += (ki == K.road ? trafficPol : 0) + gi * 0.15
            p = clamp(p, 0, 100)
            w.pollution[i] = u8t(p)
            var crimeRaw = Double(dens) * 1.15 - 10 + Double(aband) * 6
            crimeRaw += unemp * 60 + gi * 0.1
            let crime = clamp(crimeRaw * crimeMul - Double(police[i]) * 0.22, 0, 100)
            w.crime[i] = u8t(crime)
            var lv = 40.0
            if w.waterDist[i] <= 4 { lv += 18 * (1 - Double(w.waterDist[i]) / 5) }
            lv += Double(min(8, trees))
            lv += min(34, Double(parkAdd[i]))
            var cv = Double(police[i]) * 0.035 + Double(edu[i]) * 0.04
            cv += Double(health[i]) * 0.04 + Double(fire[i]) * 0.025 + Double(transit[i]) * 0.03
            lv += cv
            var minus = p * 0.6 + crime * 0.25 + Double(nearInd) * 4 + Double(aband) * 3
            minus += max(0, Double(traf) - 70) * 0.06 + gi * 0.2
            lv -= minus
            if highrise { lv += 6 }
            w.lv[i] = UInt8(clamp(jsRound(lv), 0, 100))
            if ki == K.res || ki == K.com { polSum += p; crimeSum += crime; cnt += 1 }
            if ki == K.res && w.level[i] != 0 {
                healthSum += clamp(50 + Double(health[i]) * 0.2 - p * 0.6, 0, 100)
                eduSum += Double(edu[i]) / 2.55
                resN += 1
            }
        }
        stats.avgPollution = cnt > 0 ? polSum / Double(cnt) : 0
        stats.avgCrime = cnt > 0 ? crimeSum / Double(cnt) : 0
        stats.health = resN > 0 ? Int(jsRound(healthSum / Double(resN))) : 50
        stats.education = resN > 0 ? Int(jsRound(eduSum / Double(resN))) : 0
        fieldsDirty = false
    }

    // ======================================================== happiness

    @inline(__always)
    private func rounded(_ v: Double) -> Int? {
        abs(v) >= 0.5 ? Int(jsRound(v)) : nil
    }

    /// Visits each happiness factor as (label index into `factorLabels`, rounded value), allocation-free.
    private func eachFactor(_ i: Int, _ body: (Int, Int) -> Void) {
        let w = world
        if let v = rounded((Double(w.lv[i]) - 45) * 0.35) { body(0, v) }
        if w.power[i] == 0 { body(1, -25) }
        if w.water[i] == 0 { body(2, -12) }
        if let v = rounded(Double(w.cov.health[i]) * 0.05 - Double(w.pollution[i]) * 0.25) { body(3, v) }
        if let v = rounded(-Double(w.crime[i]) * 0.2) { body(4, v) }
        if let v = rounded(Double(w.cov.edu[i]) * 0.03) { body(5, v) }
        let c = Int(w.commute[i])
        if c == 255 {
            body(6, -18)
        } else if let v = rounded(-Double(max(0, c - 14)) * 0.7) {
            body(7, v)
        }
        if let v = rounded(-Double(w.garbage[i]) * 0.25) { body(8, v) }
        if let v = rounded(-stats.unemployment * 70) { body(9, v) }
        if let v = rounded(-Double(w.tax.r - 9) * 3) { body(10, v) }
        if has(.highrise) { body(11, 4) }
        if has(.curfew) { body(12, -3) }
    }

    public func happinessFactors(_ i: Int) -> [Factor] {
        var out: [Factor] = []
        eachFactor(i) { l, v in out.append(Factor(label: Sim.factorLabels[l], value: v)) }
        return out
    }

    public func tileHappiness(_ i: Int) -> Double {
        var sum = 0
        eachFactor(i) { _, v in sum += v }
        return clamp(60 + Double(sum), 0, 100)
    }

    // ======================================================== counts & workforce

    public func recount() {
        let w = world
        var pop = 0, com = 0, ind = 0, roads = 0, unpowered = 0, unwatered = 0, burning = 0, abandoned = 0
        var happySum = 0.0, lowW = 0.0, highW = 0.0, unreach = 0.0, lowJ = 0.0, highJ = 0.0
        let sampleFactors = (w.day % 30) < 1 || stats.factors.isEmpty
        var facSum = [Double](repeating: 0, count: Sim.factorLabels.count)
        var facSeen = [Bool](repeating: false, count: Sim.factorLabels.count)
        var facOrder: [Int] = []
        for i in 0..<N {
            let k = w.kind[i], fl = w.flags[i]
            let L = lvlIndex(w.level[i])
            if (fl & F.burning) != 0 { burning += 1 }
            if k == K.road { roads += 1 }
            if !isZoneKind(k) { continue }
            if (fl & F.abandoned) != 0 { abandoned += 1; continue }
            if w.power[i] == 0 && w.roadDist[i] <= 3 && (fl & F.rubble) == 0 { unpowered += 1 }
            if L >= 1 && w.water[i] == 0 { unwatered += 1 }
            if L == 0 { continue }
            if k == K.res {
                let p = RES_POP[L]
                pop += p
                let hp = tileHappiness(i)
                w.happy[i] = u8t(hp)
                happySum += hp * Double(p)
                if sampleFactors {
                    eachFactor(i) { l, v in
                        if !facSeen[l] { facSeen[l] = true; facOrder.append(l) }
                        facSum[l] += Double(v * p)
                    }
                }
                let workers = Double(p) * 0.55, e = Double(w.cov.edu[i]) / 255
                if w.commute[i] == 255 {
                    unreach += workers
                } else {
                    highW += workers * e
                    lowW += workers * (1 - e)
                }
            } else {
                let j = zoneJobs(k, L)
                if k == K.com { com += j } else { ind += j }
                if w.power[i] == 0 { continue }
                let hi = zoneHigh(k, L)
                highJ += Double(j) * hi
                lowJ += Double(j) * (1 - hi)
            }
        }
        // service jobs (low skill)
        let workers = Double(pop) * 0.55
        let empHigh = min(highW, highJ)
        let empLow = min(lowJ, lowW + (highW - empHigh))
        let employed = empHigh + empLow
        stats.pop = pop
        stats.comJobs = com
        stats.indJobs = ind
        stats.jobs = com + ind
        stats.workers = Int(jsRound(workers))
        stats.roads = roads
        stats.unpowered = unpowered
        stats.unwatered = unwatered
        stats.burning = burning
        stats.abandoned = abandoned
        stats.lowWorkers = Int(jsRound(lowW))
        stats.highWorkers = Int(jsRound(highW))
        stats.lowJobs = Int(jsRound(lowJ))
        stats.highJobs = Int(jsRound(highJ))
        stats.unreachable = Int(jsRound(unreach))
        stats.unemployment = workers > 20 ? clamp((workers - employed) / workers, 0, 1) : 0
        stats.highVac = highJ > 5 ? clamp((highJ - empHigh) / highJ, 0, 1) : 0
        stats.lowVac = lowJ > 5 ? clamp((lowJ - empLow) / lowJ, 0, 1) : 0
        stats.happiness = pop > 0 ? Int(jsRound(happySum / Double(pop))) : 60
        if sampleFactors && pop > 0 {
            var list: [(order: Int, label: Int, value: Int)] = []
            for (k, l) in facOrder.enumerated() {
                list.append((order: k, label: l, value: Int(jsRound(facSum[l] / Double(pop)))))
            }
            list.sort { a, b in
                abs(a.value) != abs(b.value) ? abs(a.value) > abs(b.value) : a.order < b.order
            }
            stats.factors = list.map { Factor(label: Sim.factorLabels[$0.label], value: $0.value) }
        }
        if pop > w.peakPop {
            let before = milestone(w.peakPop)
            w.peakPop = pop
            let after = milestone(pop)
            if after.name != before.name {
                toast("\(w.name) is now a \(after.name)! New buildings unlocked.", .milestone)
                events.fact(Fact(type: "milestone", fields: ["name": after.name, "pop": String(pop)]))
            }
        }
    }

    public func milestone(_ pop: Int? = nil) -> Milestone {
        let p = pop ?? world.peakPop
        var m = MILESTONES[0]
        for x in MILESTONES where p >= x.pop { m = x }
        return m
    }

    public func nextMilestone() -> Milestone? {
        MILESTONES.first { $0.pop > world.peakPop }
    }

    public func computeDemand() {
        let s = stats, t = world.tax
        let avail = Double(s.lowJobs) * (1 - s.lowVac) + Double(s.highJobs) * (1 - s.highVac)
        let workers = Double(s.workers)
        var r = (Double(s.jobs) + 50 - workers) / max(50, workers * 0.4)
        r -= s.unemployment * 2.5
        let pop = Double(s.pop), comJobs = Double(s.comJobs), indJobs = Double(s.indJobs)
        var c = (pop * 0.22 + 20 - comJobs) / max(20, comJobs * 0.5)
        var i = (pop * 0.33 + 30 - indJobs) / max(30, indJobs * 0.5)
        // businesses can't hire → they stop expanding
        if s.jobs > 60 { c -= s.lowVac * 0.9; i -= s.lowVac * 0.9 }
        r += (Double(s.happiness) - 55) / 90
        r -= Double(t.r - 9) * 0.07
        r -= max(0, Double(s.avgCommute) - 25) * 0.02
        c -= Double(t.c - 9) * 0.07
        i -= Double(t.i - 9) * 0.07
        if has(.tourism) { c += 0.2 }
        if has(.taxbreak) { i += 0.3 }
        if has(.curfew) { c -= 0.1 }
        c += min(0.3, Double(s.tourists) / 4000)
        demand = Demand(r: clamp(r, -1, 1), c: clamp(c, -1, 1), i: clamp(i, -1, 1))
        stats.employedEst = Int(jsRound(avail))
    }

    public func maxLevel(_ i: Int) -> Int {
        let w = world, k = w.kind[i], lv = Int(w.lv[i]), pop = w.peakPop
        if w.water[i] == 0 { return 1 }
        let ban = has(.highrise) ? 2 : 3
        if k == K.ind {
            if pop >= 1500 && w.cov.edu[i] > 40 && stats.highVac < 0.5 { return min(3, ban + 1) }
            return pop >= 250 ? 2 : 1
        }
        if k == K.com {
            if lv >= 58 && pop >= 1200 && (stats.highVac < 0.5 || stats.highJobs < 50) { return ban }
            return lv >= 34 ? 2 : 1
        }
        if lv >= 60 && pop >= 1200 && w.cov.edu[i] > 20 { return ban }
        if lv >= 36 { return 2 }
        return 1
    }

    func growTile(_ i: Int) {
        let w = world, k = w.kind[i], fl = w.flags[i]
        if (fl & (F.rubble | F.burning)) != 0 { return }
        let L = Int(w.level[i]), r = rng()
        // distress → abandonment
        if L > 0 {
            var bad = w.power[i] == 0 || w.garbage[i] > 80
            if !bad && k == K.res { bad = w.happy[i] < 18 || w.commute[i] == 255 }
            if !bad && k != K.res { bad = stats.jobs > 100 && stats.lowVac > 0.65 }
            w.distress[i] = UInt8(clamp(Int(w.distress[i]) + (bad ? 6 : -6), 0, 100))
            if (fl & F.abandoned) == 0 && w.distress[i] > 70 {
                w.flags[i] |= F.abandoned
                delegate?.simGrew(i, up: false)
                netDirty = true
                return
            }
            if (fl & F.abandoned) != 0 {
                if w.distress[i] < 15 {
                    w.flags[i] &= ~F.abandoned
                    delegate?.simGrew(i, up: true)
                    netDirty = true
                }
                return
            }
        }
        let d = k == K.res ? demand.r : (k == K.com ? demand.c : demand.i)
        let connected = w.roadDist[i] <= 3 && w.power[i] != 0
        if !connected {
            if L > 0 && r < 0.1 { setLevel(i, L - 1) }
            return
        }
        let maxL = maxLevel(i)
        if L < maxL && d > 0 && r < 0.08 + d * 0.35 { setLevel(i, L + 1); return }
        if L > maxL && r < 0.08 { setLevel(i, L - 1); return }
        if d < -0.35 && L > 0 && r < -d * 0.04 { setLevel(i, L - 1) }
    }

    func setLevel(_ i: Int, _ L: Int) {
        let w = world
        let up = L > Int(w.level[i])
        w.level[i] = UInt8(clamp(L, 0, 3))
        if up {
            w.variant[i] = UInt8(min(3, Int(rng() * 4)))
            let (x, z) = w.xz(i)
            w.rot[i] = UInt8(faceRoad(x, z))
            w.tree[i] = 0
            if L == 3 && w.kind[i] != K.ind {
                events.fact(Fact(type: "tower", fields: ["kind": String(w.kind[i]), "district": w.district(x, z)]))
            }
        }
        netDirty = true
        delegate?.simGrew(i, up: up)
    }

    // ======================================================== fire

    func fireStep() {
        let w = world
        var changed: [Int] = []
        // ignition (checked on this day's slice)
        if w.disasters && stats.pop > 150 {
            let smoke = has(.smoke) ? 0.55 : 1.0
            var i = slice
            while i < N {
                defer { i += 6 }
                let k = w.kind[i]
                let isRoot = k == K.service && w.root[i] == Int32(i)
                if !(isZoneKind(k) && w.level[i] != 0) && !isRoot { continue }
                if (w.flags[i] & (F.burning | F.rubble)) != 0 { continue }
                let L = w.level[i] != 0 ? Double(w.level[i]) : 1
                var risk = 0.00016 * L * (k == K.ind ? 2.2 : 1)
                risk *= (w.flags[i] & F.abandoned) != 0 ? 3 : 1
                risk *= smoke * (1 - (Double(w.cov.fire[i]) / 255) * 0.85)
                if rng() < risk { ignite(i) }
            }
        }
        // burning tiles
        for i in 0..<N {
            if (w.flags[i] & F.burning) == 0 { continue }
            w.fireT[i] &+= 1
            let cov = Double(w.cov.fire[i]) / 255
            if rng() < 0.015 + cov * 0.3 { // extinguished
                w.flags[i] &= ~F.burning; w.fireT[i] = 0; w.counters.firesOut += 1
                delegate?.simFire(i, state: .out)
                changed.append(i)
                continue
            }
            if rng() < 0.05 * (1 - cov * 0.8) {
                let (x, z) = w.xz(i)
                let dk = min(3, Int(rng() * 4))
                let j = w.idx(clamp(x + DIRS_X[dk], 0, MAP - 1), clamp(z + DIRS_Z[dk], 0, MAP - 1))
                let kj = w.kind[j]
                let flammable = (isZoneKind(kj) && w.level[j] != 0) || kj == K.service
                if flammable && (w.flags[j] & (F.burning | F.rubble)) == 0 {
                    let target = kj == K.service ? Int(w.root[j]) : j
                    if target >= 0 { ignite(target, spread: true) }
                }
            }
            if w.fireT[i] > 20 { burnDown(i); changed.append(i) }
        }
        if !changed.isEmpty { afterChange(changed) }
    }

    public func ignite(_ i: Int, spread: Bool = false) {
        let w = world
        guard i >= 0 && i < N else { return }
        w.flags[i] |= F.burning; w.fireT[i] = 0
        let (x, z) = w.xz(i)
        if !spread {
            toast("🔥 Fire in \(w.district(x, z))!", .bad, at: i)
            events.fact(Fact(type: "fire", fields: ["district": w.district(x, z)]))
        }
        delegate?.simFire(i, state: .start)
        fieldsDirty = true
    }

    func burnDown(_ i: Int) {
        let w = world
        w.counters.firesLost += 1
        if w.kind[i] == K.service, let s = sdef(w.svc[i]) {
            let (rx, rz) = w.xz(i)
            for oz in 0..<s.size {
                for ox in 0..<s.size {
                    if !w.inb(rx + ox, rz + oz) { continue }
                    let j = w.idx(rx + ox, rz + oz)
                    clearTile(j); w.flags[j] = F.rubble
                }
            }
        } else {
            w.level[i] = 0; w.flags[i] = F.rubble; w.fireT[i] = 0; w.distress[i] = 0
        }
        delegate?.simFire(i, state: .lost)
        addApproval(-1.5, "Building lost to fire")
    }

    public func addApproval(_ v: Double, _ why: String) {
        world.approvalMods.append(ApprovalMod(v: v, why: why, left: 12))
    }

    // ======================================================== tick

    public func step() {
        let w = world
        if netDirty { computeNetworks() }
        if fieldsDirty { computeTraffic(); computeFields() }
        w.day += 1
        // Stagger the heavy passes on different days so no single tick stacks them.
        let phase = w.day % 10
        if phase == 3 { computeTraffic() } else if phase == 7 { computeFields() }
        var changed: [Int] = []
        var i = slice
        while i < N {
            if isZoneKind(w.kind[i]) {
                let L = w.level[i], f = w.flags[i]
                growTile(i)
                if w.level[i] != L || w.flags[i] != f { changed.append(i) }
            }
            i += 6
        }
        fireStep()
        slice = (slice + 1) % 6
        if !changed.isEmpty { recount(); delegate?.simTilesChanged(changed) }
        if w.day % 5 == 0 { recount(); computeDemand() }
        if w.day % DAYS_PER_MONTH == 0 { monthly() }
    }

    func tourism() -> Int {
        let w = world
        let parkByte = svcIndex(.park)
        var t = 0.0
        for i in 0..<N {
            if w.kind[i] == K.service && w.root[i] == Int32(i), let s = sdef(w.svc[i]) {
                if s.tourism > 0 { t += Double(s.tourism) }
                if w.svc[i] == parkByte && w.waterDist[i] <= 2 { t += 40 }
            }
            if w.kind[i] == K.com && w.level[i] == 3 && w.waterDist[i] <= 3 { t += 25 }
        }
        return Int(jsRound(t * (has(.tourism) ? 1.8 : 1) * (0.4 + Double(stats.happiness) / 100)))
    }

    func monthly() {
        let w = world
        // Fields/traffic are kept fresh by the staggered schedule in step(); only
        // refresh what player actions invalidated.
        if netDirty { computeNetworks() }
        recount(); computeDemand()
        stats.tourists = tourism()
        // income — residents pay more in high land value areas
        var wealth = 0.0
        for i in 0..<N where w.kind[i] == K.res && w.level[i] != 0 && (w.flags[i] & F.abandoned) == 0 {
            wealth += Double(RES_POP[lvlIndex(w.level[i])]) * (0.6 + Double(w.lv[i]) / 100)
        }
        let incR = wealth * Double(w.tax.r) * 0.05
        let incC = Double(stats.comJobs) * Double(w.tax.c) * 0.06 * (has(.curfew) ? 0.88 : 1)
        let incI = Double(stats.indJobs) * Double(w.tax.i) * 0.06 * (has(.taxbreak) ? 0.7 : 1)
        let fares = has(.freebus) ? 0 : Double(stats.transitRiders) * 0.25
        let tourismInc = Double(stats.tourists) * 0.6
        // expenses
        var roadsUp = 0.0
        for i in 0..<N where w.kind[i] == K.road { roadsUp += ROADS[w.level[i] >= 1 ? 1 : 0].upkeep }
        var svcUpkeep: [ServiceID: Double] = [:]
        var upkeep = roadsUp
        for i in 0..<N where w.kind[i] == K.service && w.root[i] == Int32(i) {
            guard let sv = sdef(w.svc[i]) else { continue }
            let c = Double(sv.upkeep) * deptMul(sv.dept)
            svcUpkeep[sv.id, default: 0] += c
            upkeep += c
        }
        var policyCost = 0.0
        for p in w.policies { policyCost += p.def.flat + p.def.perCap * Double(stats.pop) }
        var loanPay = 0
        for k in w.loans.indices { loanPay += w.loans[k].payment; w.loans[k].left -= 1 }
        w.loans.removeAll { $0.left <= 0 }
        upkeep += policyCost + Double(loanPay)
        stats.income = Int(jsRound(incR + incC + incI + fares + tourismInc))
        stats.expense = Int(jsRound(upkeep))
        stats.debt = w.loans.reduce(0) { $0 + $1.payment * $1.left }
        var b = Breakdown()
        b.incR = Int(jsRound(incR)); b.incC = Int(jsRound(incC)); b.incI = Int(jsRound(incI))
        b.fares = Int(jsRound(fares)); b.tourism = Int(jsRound(tourismInc)); b.roads = Int(jsRound(roadsUp))
        b.svc = svcUpkeep; b.policies = Int(jsRound(policyCost)); b.loans = loanPay
        stats.breakdown = b
        w.funds += Double(stats.income - stats.expense)
        if stats.income >= stats.expense { w.counters.surplusMonths += 1 } else { w.counters.surplusMonths = 0 }
        w.history.append(HistoryPoint(d: w.day, pop: stats.pop, funds: Int(jsRound(w.funds)), happy: stats.happiness,
                                      jobs: stats.jobs, appr: Int(jsRound(w.approval)),
                                      unemp: Int(jsRound(stats.unemployment * 100)), cong: stats.congestion))
        if w.history.count > 240 { w.history.removeFirst() }
        events.monthly()
        buildAdvice()
        delegate?.simMonth()
    }

    public func buildAdvice() {
        let s = stats, d = demand, w = world
        var a: [Advice] = []
        if s.burning > 0 {
            a.append(Advice(lvl: "bad", who: "Fire Dept.", text: "\(s.burning) building\(s.burning > 1 ? "s are" : " is") on fire! Fire stations nearby put them out."))
        }
        if s.powerDemand > s.powerSupply {
            a.append(Advice(lvl: "bad", who: "Utilities", text: "Power shortfall: \(s.powerDemand) MW needed, \(s.powerSupply) MW supplied. Build more generation."))
        }
        if s.unpowered > 0 {
            a.append(Advice(lvl: "bad", who: "Utilities", text: "\(s.unpowered) zoned lots have no power. Connect them to a plant through roads or buildings."))
        }
        if s.unwatered > 4 {
            a.append(Advice(lvl: "warn", who: "Utilities", text: "\(s.unwatered) buildings lack water and can't grow past low density. Place powered water towers."))
        }
        if s.avgGarbage > 25 {
            let text = s.garbageCap < s.garbageProd
                ? "Garbage is piling up: \(s.garbageProd) t produced vs \(s.garbageCap) t capacity. Build a landfill or recycling center."
                : "Some neighbourhoods are outside garbage collection range."
            a.append(Advice(lvl: "warn", who: "Sanitation", text: text))
        }
        if s.jammed > 3 {
            a.append(Advice(lvl: "warn", who: "Transport", text: "\(s.jammed) road segments are gridlocked (avg congestion \(s.congestion)%). Upgrade to avenues, add alternate routes or bus stops."))
        }
        if s.avgCommute > 28 {
            a.append(Advice(lvl: "warn", who: "Transport", text: "Average commute is \(s.avgCommute) min. Zone jobs closer to homes or add transit."))
        }
        if s.unreachable > 20 {
            a.append(Advice(lvl: "bad", who: "Transport", text: "\(s.unreachable) workers have no road route to any job."))
        }
        if s.unemployment > 0.1 {
            let extra = s.highWorkers > s.highJobs ? " — educated workers want offices" : ""
            a.append(Advice(lvl: "warn", who: "Economy", text: "Unemployment is \(Int(jsRound(s.unemployment * 100)))%. Zone commercial and industry\(extra)."))
        }
        if s.highVac > 0.4 && s.highJobs > 50 {
            a.append(Advice(lvl: "warn", who: "Education", text: "\(Int(jsRound(s.highVac * 100)))% of skilled jobs are unfilled. Build schools and a university."))
        }
        if s.lowVac > 0.4 && s.jobs > 80 {
            a.append(Advice(lvl: "info", who: "Economy", text: "Businesses can’t find workers. Zone more housing."))
        }
        if d.r > 0.5 { a.append(Advice(lvl: "info", who: "Planning", text: "Strong housing demand. Zone more residential near jobs.")) }
        if d.c > 0.5 { a.append(Advice(lvl: "info", who: "Planning", text: "Shops want customers. Zone commercial along busy roads.")) }
        if d.i > 0.5 { a.append(Advice(lvl: "info", who: "Planning", text: "Industry is looking for land. Zone industrial away from homes.")) }
        if s.avgPollution > 22 {
            a.append(Advice(lvl: "warn", who: "Environment", text: "Pollution is hurting land value. Add parks, trees and clean power."))
        }
        if s.avgCrime > 18 {
            a.append(Advice(lvl: "warn", who: "Safety", text: "Crime is rising in dense areas. Build police stations or fund the department."))
        }
        if s.abandoned > 3 {
            a.append(Advice(lvl: "warn", who: "Housing", text: "\(s.abandoned) buildings are abandoned. Fix power, jobs, garbage or happiness in those areas."))
        }
        if s.health < 40 && s.pop > 300 {
            a.append(Advice(lvl: "warn", who: "Health", text: "Public health is poor. Build clinics and reduce pollution."))
        }
        if w.funds < 2000 {
            a.append(Advice(lvl: "bad", who: "Finance", text: "Treasury is nearly empty. Raise taxes, cut budgets or take a loan."))
        }
        if s.income < s.expense && s.pop > 0 {
            a.append(Advice(lvl: "warn", who: "Finance", text: "Running a deficit of $\(formatThousands(s.expense - s.income))/mo."))
        }
        if s.happiness < 40 && s.pop > 100 {
            a.append(Advice(lvl: "warn", who: "Citizens", text: "Citizens are unhappy. Check the happiness breakdown on the Overview tab."))
        }
        if a.isEmpty { a.append(Advice(lvl: "good", who: "Mayor’s office", text: "All systems nominal. The city is thriving.")) }
        advice = a
    }

    public func refreshAll() {
        computeNetworks(); computeTraffic(); computeFields(); computeNetworks(); recount(); computeDemand(); buildAdvice()
    }
}
