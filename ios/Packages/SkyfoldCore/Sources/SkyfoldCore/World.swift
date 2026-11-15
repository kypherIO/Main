// World state: tile grids, terrain generation, persistence (port of game/src/world.js).
import Foundation

// MARK: - Persistent model types

public struct Taxes: Codable, Equatable {
    public var r: Int, c: Int, i: Int
    public init(r: Int, c: Int, i: Int) { self.r = r; self.c = c; self.i = i }
}

public struct HistoryPoint: Codable, Equatable {
    public var d: Int, pop: Int, funds: Int, happy: Int, jobs: Int, appr: Int, unemp: Int, cong: Int
    public init(d: Int, pop: Int, funds: Int, happy: Int, jobs: Int, appr: Int, unemp: Int, cong: Int) {
        self.d = d; self.pop = pop; self.funds = funds; self.happy = happy
        self.jobs = jobs; self.appr = appr; self.unemp = unemp; self.cong = cong
    }
}

public struct Loan: Codable, Equatable {
    public var amount: Int, payment: Int, left: Int
    public init(amount: Int, payment: Int, left: Int) { self.amount = amount; self.payment = payment; self.left = left }
}

public struct ApprovalMod: Codable, Equatable {
    public var v: Double
    public var why: String
    public var left: Int
    public init(v: Double, why: String, left: Int) { self.v = v; self.why = why; self.left = left }
}

public struct FeedItem: Codable, Identifiable, Equatable, Sendable {
    public var id: UUID
    public var kind: String          // "news" | "chirp" | "petition"
    public var title: String?
    public var who: String?
    public var body: String
    public var day: Int
    public var date: String
    public var ai: Bool
    public var at: Int?
    public init(id: UUID = UUID(), kind: String, title: String? = nil, who: String? = nil, body: String,
                day: Int = 0, date: String = "", ai: Bool = false, at: Int? = nil) {
        self.id = id; self.kind = kind; self.title = title; self.who = who; self.body = body
        self.day = day; self.date = date; self.ai = ai; self.at = at
    }
}

public struct Petition: Codable, Identifiable, Equatable, Sendable {
    public var id: UUID
    public var type: String
    public var x: Int, z: Int
    public var district: String
    public var goal: String
    public var text: String
    public var rewardApproval: Double
    public var rewardCash: Int
    public var months: Int
    public var expires: Int
    public var deadline: Int?
    public var base: Int?
    public init(id: UUID = UUID(), type: String, x: Int, z: Int, district: String, goal: String, text: String,
                rewardApproval: Double, rewardCash: Int, months: Int, expires: Int, deadline: Int? = nil, base: Int? = nil) {
        self.id = id; self.type = type; self.x = x; self.z = z; self.district = district; self.goal = goal
        self.text = text; self.rewardApproval = rewardApproval; self.rewardCash = rewardCash
        self.months = months; self.expires = expires; self.deadline = deadline; self.base = base
    }
}

public struct PetitionState: Codable, Equatable {
    public var active: [Petition]
    public var offer: Petition?
    public var nextDay: Int
    public init(active: [Petition] = [], offer: Petition? = nil, nextDay: Int = 150) {
        self.active = active; self.offer = offer; self.nextDay = nextDay
    }
}

public struct Counters: Codable, Equatable {
    public var firesOut: Int, firesLost: Int, petitionsDone: Int, petitionsFailed: Int, surplusMonths: Int
    public init(firesOut: Int = 0, firesLost: Int = 0, petitionsDone: Int = 0, petitionsFailed: Int = 0, surplusMonths: Int = 0) {
        self.firesOut = firesOut; self.firesLost = firesLost; self.petitionsDone = petitionsDone
        self.petitionsFailed = petitionsFailed; self.surplusMonths = surplusMonths
    }
}

/// Service coverage fields (0...255), derived by the sim.
public struct Coverage {
    public var police: [UInt8]
    public var fire: [UInt8]
    public var health: [UInt8]
    public var edu: [UInt8]
    public var transit: [UInt8]
    public var garbage: [UInt8]
    public init() {
        let z = [UInt8](repeating: 0, count: N)
        police = z; fire = z; health = z; edu = z; transit = z; garbage = z
    }
    public init(police: [UInt8], fire: [UInt8], health: [UInt8], edu: [UInt8], transit: [UInt8], garbage: [UInt8]) {
        self.police = police; self.fire = fire; self.health = health
        self.edu = edu; self.transit = transit; self.garbage = garbage
    }
}

// MARK: - Value noise

/// Port of `valueNoise(seed)` in world.js (vals stored as Float32 like the JS Float32Array).
struct ValueNoise {
    private var perm = [UInt8](repeating: 0, count: 512)
    private var vals = [Float](repeating: 0, count: 256)

    init(seed: UInt32) {
        let rnd = mulberry32(seed)
        for i in 0..<256 { perm[i] = UInt8(i); vals[i] = Float(rnd()) }
        var i = 255
        while i > 0 {
            let j = Int(rnd() * Double(i + 1))
            perm.swapAt(i, j)
            i -= 1
        }
        for i in 0..<256 { perm[i + 256] = perm[i] }
    }

    @inline(__always)
    private func v(_ x: Int, _ y: Int) -> Double {
        Double(vals[Int(perm[(Int(perm[x & 255]) + y) & 511])])
    }

    @inline(__always)
    private func s(_ t: Double) -> Double { t * t * (3 - 2 * t) }

    private func n(_ x: Double, _ y: Double) -> Double {
        let xfl = x.rounded(.down), yfl = y.rounded(.down)
        let xi = Int(xfl), yi = Int(yfl)
        let xf = x - xfl, yf = y - yfl
        let a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1)
        let u = s(xf), w = s(yf)
        return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w
    }

    func sample(_ x: Double, _ y: Double, _ oct: Int = 4) -> Double {
        var sum = 0.0, amp = 0.5, f = 1.0, norm = 0.0
        for _ in 0..<oct {
            sum += n(x * f, y * f) * amp
            norm += amp
            amp *= 0.5
            f *= 2.03
        }
        return sum / norm
    }
}

@inline(__always)
private func smooth(_ a: Double, _ b: Double, _ x: Double) -> Double {
    let t = clamp((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)
}

// MARK: - World

public final class World: Codable {
    public var terrain = [UInt8](repeating: 0, count: N)   // 0 land, 1 water
    public var kind = [UInt8](repeating: 0, count: N)      // Kind raw values
    public var level = [UInt8](repeating: 0, count: N)
    public var variant = [UInt8](repeating: 0, count: N)
    public var rot = [UInt8](repeating: 0, count: N)
    public var svc = [UInt8](repeating: 0, count: N)       // service index (+1)
    public var root = [Int32](repeating: -1, count: N)
    public var tree = [UInt8](repeating: 0, count: N)      // 0 none, 1 pine, 2 broadleaf
    // derived fields (sim)
    public var power = [UInt8](repeating: 0, count: N)
    public var water = [UInt8](repeating: 0, count: N)
    public var roadDist = [UInt8](repeating: 0, count: N)
    public var waterDist = [UInt8](repeating: 0, count: N)
    public var lv = [UInt8](repeating: 0, count: N)
    public var pollution = [UInt8](repeating: 0, count: N)
    public var crime = [UInt8](repeating: 0, count: N)
    public var cov = Coverage()
    public var flags = [UInt8](repeating: 0, count: N)     // abandoned | burning | rubble
    public var fireT = [UInt8](repeating: 0, count: N)
    public var distress = [UInt8](repeating: 0, count: N)
    public var garbage = [UInt8](repeating: 0, count: N)
    public var traffic = [UInt8](repeating: 0, count: N)   // road congestion % (0...255)
    public var commute = [UInt8](repeating: 0, count: N)   // res commute minutes-ish (255 = no route)
    public var happy = [UInt8](repeating: 0, count: N)
    public var nearestRoad = [Int32](repeating: -1, count: N)

    public var name = "New Harbor"
    public var seed: UInt32 = 1
    public var funds: Double = 50000
    public var day = 0
    public var tax = Taxes(r: 9, c: 9, i: 9)
    public var peakPop = 0
    public var history: [HistoryPoint] = []
    public var version = 2

    // meta
    public var budget: [Dept: Int] = [.police: 100, .fire: 100, .health: 100, .edu: 100, .transit: 100]
    public var policies: [PolicyID] = []
    public var loans: [Loan] = []
    public var approval: Double = 60
    public var approvalMods: [ApprovalMod] = []
    public var news: [FeedItem] = []
    public var petitions = PetitionState()
    public var achievements: [String] = []
    public var counters = Counters()
    public var disasters = true
    public var districts: [String] = []

    public init() {}

    public func resetMeta() {
        budget = [.police: 100, .fire: 100, .health: 100, .edu: 100, .transit: 100]
        policies = []
        loans = []
        approval = 60
        approvalMods = []
        news = []
        petitions = PetitionState(active: [], offer: nil, nextDay: 150)
        achievements = []
        counters = Counters()
        disasters = true
        districts = []
    }

    // MARK: geometry helpers

    @inline(__always) public func idx(_ x: Int, _ z: Int) -> Int { z * MAP + x }
    @inline(__always) public func inb(_ x: Int, _ z: Int) -> Bool { x >= 0 && z >= 0 && x < MAP && z < MAP }
    @inline(__always) public func xz(_ i: Int) -> (Int, Int) { (i % MAP, i / MAP) }

    /// Tile kind as an enum (convenience for UI code).
    public func kindAt(_ i: Int) -> Kind { Kind(rawValue: kind[i]) ?? .empty }
    public func flagsAt(_ i: Int) -> TileFlags { TileFlags(rawValue: flags[i]) }
    public func serviceAt(_ i: Int) -> ServiceID? { svcId(svc[i]) }

    // 4×4 grid of named neighbourhoods
    public func nameDistricts() {
        let rnd = mulberry32(seed ^ 0xabcdef)
        let A = ["Harbor", "Oak", "Cedar", "Maple", "Summit", "River", "Lantern", "Copper", "Willow", "Juniper", "Granite", "Sunset",
                 "Elm", "Marina", "Lark", "Fern", "Kestrel", "Ash", "Beacon", "Clover", "Saltwind", "Orchard", "Pier", "Foundry"]
        let B = [" Heights", " Park", " Village", " Flats", " Point", " Gardens", " Hill", " Quarter", " Commons", " Row",
                 " Landing", "side", "wood", " Bend", " Square", " Terrace"]
        var used = Set<String>()
        var out: [String] = []
        for _ in 0..<16 {
            var n: String
            repeat {
                let a = A[min(A.count - 1, Int(rnd() * Double(A.count)))]
                let b = B[min(B.count - 1, Int(rnd() * Double(B.count)))]
                n = a + b
            } while used.contains(n)
            used.insert(n)
            out.append(n)
        }
        districts = out
    }

    public func district(_ x: Int, _ z: Int) -> String {
        let cx = x / 16, cz = z / 16
        guard x >= 0, z >= 0, cx < 4, cz < 4 else { return "Downtown" }
        let k = cz * 4 + cx
        return k < districts.count ? districts[k] : "Downtown"
    }

    // MARK: generation

    public static func generate(seed: UInt32, name: String) -> World {
        let w = World()
        w.regenerate(seed: seed, name: name)
        return w
    }

    /// Regenerates this world in place (port of `World.generate`).
    public func regenerate(seed newSeed: UInt32, name newName: String? = nil) {
        // reset all grids
        terrain = [UInt8](repeating: 0, count: N); kind = terrain; level = terrain; variant = terrain
        rot = terrain; svc = terrain; tree = terrain; flags = terrain; fireT = terrain; distress = terrain
        garbage = terrain; power = terrain; water = terrain; roadDist = terrain; lv = terrain
        pollution = terrain; crime = terrain; traffic = terrain; commute = terrain; happy = terrain
        root = [Int32](repeating: -1, count: N); nearestRoad = root
        cov = Coverage()

        seed = newSeed
        if let nm = newName, !nm.isEmpty { name = nm }
        let rnd = mulberry32(seed ^ 0x9e3779b9)
        let noise = ValueNoise(seed: seed)
        let forest = ValueNoise(seed: seed &+ 17)
        let c = MAP / 2
        let cd = Double(c)
        // island heightfield
        for z in 0..<MAP {
            for x in 0..<MAP {
                let dx = (Double(x) + 0.5 - cd) / cd
                let dz = (Double(z) + 0.5 - cd) / cd
                let r = hypot(dx, dz) * 0.65 + max(abs(dx), abs(dz)) * 0.35
                let edge = 1 - smooth(0.62, 1.0, r)
                let h = noise.sample(Double(x) / 15, Double(z) / 15, 4) * 0.6 + edge * 0.8 - 0.5
                let land = h > 0 && x > 1 && z > 1 && x < MAP - 2 && z < MAP - 2
                terrain[idx(x, z)] = land ? 0 : 1
            }
        }
        // carve a river from an off-centre point to the coast
        let side = min(3, Int(rnd() * 4))
        let sign: Double = rnd() < 0.5 ? -1 : 1
        let off = 9 + rnd() * 4
        var px = cd + sign * off
        var pz = cd + (rnd() - 0.5) * 10
        let dirs: [(Double, Double)] = [(1, 0), (0, 1), (-1, 0), (0, -1)]
        let dir = dirs[side]
        for s in 0..<80 {
            let w = 1 + (s > 20 ? 1 : 0)
            for oz in (-w + 1)..<w {
                for ox in (-w + 1)..<w {
                    let x = Int(jsRound(px + Double(ox))), z = Int(jsRound(pz + Double(oz)))
                    if inb(x, z) { terrain[idx(x, z)] = 1 }
                }
            }
            px += dir.0 * 0.9 + (rnd() - 0.5) * 1.4
            pz += dir.1 * 0.9 + (rnd() - 0.5) * 1.4
            if !inb(Int(jsRound(px)), Int(jsRound(pz))) { break }
        }
        // ensure a buildable heart
        for z in (c - 5)..<(c + 5) { for x in (c - 5)..<(c + 5) { terrain[idx(x, z)] = 0 } }
        // remove 1-tile specks of land/water
        for _ in 0..<2 {
            for z in 1..<(MAP - 1) {
                for x in 1..<(MAP - 1) {
                    let i = idx(x, z)
                    var same = 0
                    if terrain[idx(x + 1, z)] == terrain[i] { same += 1 }
                    if terrain[idx(x - 1, z)] == terrain[i] { same += 1 }
                    if terrain[idx(x, z + 1)] == terrain[i] { same += 1 }
                    if terrain[idx(x, z - 1)] == terrain[i] { same += 1 }
                    if same <= 1 { terrain[i] ^= 1 }
                }
            }
        }
        computeWaterDist()
        // trees
        for i in 0..<N {
            if terrain[i] != 0 { continue }
            let (x, z) = xz(i)
            let f = forest.sample(Double(x) / 9, Double(z) / 9, 3)
            let nearCentre = abs(x - c) < 7 && abs(z - c) < 7
            if !nearCentre && ((f > 0.56 && rnd() < 0.8) || rnd() < 0.04) {
                tree[i] = (f > 0.62 || rnd() < 0.3) ? 1 : 2
            }
        }
        // starter main street
        for x in (c - 9)...(c + 9) { _ = setRoad(x, c) }
        for z in (c - 6)...(c + 6) { _ = setRoad(c, z) }
        funds = 50000; day = 0; peakPop = 0; history = []
        tax = Taxes(r: 9, c: 9, i: 9)
        resetMeta()
        nameDistricts()
    }

    @discardableResult
    public func setRoad(_ x: Int, _ z: Int) -> Bool {
        guard inb(x, z) else { return false }
        let i = idx(x, z)
        if terrain[i] != 0 || kind[i] != K.empty { return false }
        kind[i] = K.road; tree[i] = 0; root[i] = Int32(i)
        return true
    }

    public func computeWaterDist() {
        var q: [Int] = []
        q.reserveCapacity(N)
        for i in 0..<N { waterDist[i] = 255 }
        for i in 0..<N where terrain[i] != 0 { waterDist[i] = 0; q.append(i) }
        var h = 0
        let ox: [Int] = [1, -1, 0, 0], oz: [Int] = [0, 0, 1, -1]
        while h < q.count {
            let i = q[h]; h += 1
            let d = waterDist[i]
            if d >= 6 { continue }
            let x = i % MAP, z = i / MAP
            for k in 0..<4 {
                let nx = x + ox[k], nz = z + oz[k]
                if !inb(nx, nz) { continue }
                let j = idx(nx, nz)
                if waterDist[j] > d + 1 { waterDist[j] = d + 1; q.append(j) }
            }
        }
    }

    public func dateString() -> String {
        let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        let m = day / 30
        return "\(months[((m % 12) + 12) % 12]) \(2030 + m / 12)"
    }

    // MARK: persistence

    private enum CodingKeys: String, CodingKey {
        case v, name, seed, funds, day, tax, peakPop, history
        case terrain, kind, level, variant, rot, svc, root, tree, flags, fireT, distress, garbage
        case meta
    }

    private struct Meta: Codable {
        var budget: [Dept: Int]?
        var policies: [PolicyID]?
        var loans: [Loan]?
        var approval: Double?
        var approvalMods: [ApprovalMod]?
        var news: [FeedItem]?
        var petitions: PetitionState?
        var achievements: [String]?
        var counters: Counters?
        var disasters: Bool?
        var districts: [String]?
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(version, forKey: .v)
        try c.encode(name, forKey: .name)
        try c.encode(seed, forKey: .seed)
        try c.encode(funds, forKey: .funds)
        try c.encode(day, forKey: .day)
        try c.encode(tax, forKey: .tax)
        try c.encode(peakPop, forKey: .peakPop)
        try c.encode(Array(history.suffix(120)), forKey: .history)
        try c.encode(Data(terrain), forKey: .terrain)
        try c.encode(Data(kind), forKey: .kind)
        try c.encode(Data(level), forKey: .level)
        try c.encode(Data(variant), forKey: .variant)
        try c.encode(Data(rot), forKey: .rot)
        try c.encode(Data(svc), forKey: .svc)
        try c.encode(root, forKey: .root)
        try c.encode(Data(tree), forKey: .tree)
        try c.encode(Data(flags), forKey: .flags)
        try c.encode(Data(fireT), forKey: .fireT)
        try c.encode(Data(distress), forKey: .distress)
        try c.encode(Data(garbage), forKey: .garbage)
        let meta = Meta(budget: budget, policies: policies, loans: loans, approval: approval, approvalMods: approvalMods,
                        news: Array(news.suffix(40)), petitions: petitions, achievements: achievements,
                        counters: counters, disasters: disasters, districts: districts)
        try c.encode(meta, forKey: .meta)
    }

    public required init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        version = try c.decodeIfPresent(Int.self, forKey: .v) ?? 2
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? "New Harbor"
        seed = try c.decodeIfPresent(UInt32.self, forKey: .seed) ?? 1
        funds = try c.decodeIfPresent(Double.self, forKey: .funds) ?? 50000
        day = try c.decodeIfPresent(Int.self, forKey: .day) ?? 0
        tax = try c.decodeIfPresent(Taxes.self, forKey: .tax) ?? Taxes(r: 9, c: 9, i: 9)
        peakPop = try c.decodeIfPresent(Int.self, forKey: .peakPop) ?? 0
        history = try c.decodeIfPresent([HistoryPoint].self, forKey: .history) ?? []

        if let a = try World.bytes(c, .terrain) { terrain = a }
        if let a = try World.bytes(c, .kind) { kind = a }
        if let a = try World.bytes(c, .level) { level = a }
        if let a = try World.bytes(c, .variant) { variant = a }
        if let a = try World.bytes(c, .rot) { rot = a }
        if let a = try World.bytes(c, .svc) { svc = a }
        if let a = try World.bytes(c, .tree) { tree = a }
        if let a = try World.bytes(c, .flags) { flags = a }
        if let a = try World.bytes(c, .fireT) { fireT = a }
        if let a = try World.bytes(c, .distress) { distress = a }
        if let a = try World.bytes(c, .garbage) { garbage = a }
        if let r = try c.decodeIfPresent([Int32].self, forKey: .root) {
            guard r.count == N else {
                throw DecodingError.dataCorruptedError(forKey: .root, in: c, debugDescription: "root must have \(N) entries")
            }
            root = r
        }

        if let m = try c.decodeIfPresent(Meta.self, forKey: .meta) {
            if let v = m.budget { budget = v }
            if let v = m.policies { policies = v }
            if let v = m.loans { loans = v }
            if let v = m.approval { approval = v }
            if let v = m.approvalMods { approvalMods = v }
            if let v = m.news { news = v }
            if let v = m.petitions { petitions = v }
            if let v = m.achievements { achievements = v }
            if let v = m.counters { counters = v }
            if let v = m.disasters { disasters = v }
            if let v = m.districts { districts = v }
        }
        if districts.count != 16 { nameDistricts() }
        computeWaterDist()
    }

    private static func bytes(_ c: KeyedDecodingContainer<CodingKeys>, _ key: CodingKeys) throws -> [UInt8]? {
        guard let d = try c.decodeIfPresent(Data.self, forKey: key) else { return nil }
        guard d.count == N else {
            throw DecodingError.dataCorruptedError(forKey: key, in: c, debugDescription: "\(key.stringValue) must have \(N) bytes")
        }
        return [UInt8](d)
    }

    /// JSON save. Derived fields (power, traffic, coverage…) are not stored; call `Sim.refreshAll()` after loading.
    public func save() throws -> Data {
        try JSONEncoder().encode(self)
    }

    public static func load(_ data: Data) throws -> World {
        try JSONDecoder().decode(World.self, from: data)
    }
}
