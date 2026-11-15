// Skyfold — core game constants and tuning tables (port of game/src/config.js).
import Foundation

public let MAP = 64                 // tiles per side
public let N = 4096                 // MAP * MAP
public let FLOOR: Float = 0.22      // world height of one storey

public let DAYS_PER_MONTH = 30
public let SIM_DAY_SECONDS = 0.2    // real seconds per sim day at 1x
public let SPEEDS: [Double] = [0, 1, 2, 4]

// MARK: - Tile kinds & flags

public enum Kind: UInt8, Codable, CaseIterable {
    case empty = 0, road, res, com, ind, service

    public var isZone: Bool { self == .res || self == .com || self == .ind }
}

/// Raw tile-kind bytes used in the hot loops (`World.kind` is `[UInt8]`).
enum K {
    static let empty: UInt8 = 0
    static let road: UInt8 = 1
    static let res: UInt8 = 2
    static let com: UInt8 = 3
    static let ind: UInt8 = 4
    static let service: UInt8 = 5
}

/// Raw flag bits (`World.flags` is `[UInt8]`).
enum F {
    static let abandoned: UInt8 = 1
    static let burning: UInt8 = 2
    static let rubble: UInt8 = 4
}

@inline(__always)
func isZoneKind(_ k: UInt8) -> Bool { k >= 2 && k <= 4 }

public struct TileFlags: OptionSet, Codable {
    public let rawValue: UInt8
    public init(rawValue: UInt8) { self.rawValue = rawValue }
    public static let abandoned = TileFlags(rawValue: 1)
    public static let burning = TileFlags(rawValue: 2)
    public static let rubble = TileFlags(rawValue: 4)
}

// MARK: - Zones

public struct ZoneInfo {
    public let key: String
    public let name: String
    public let pop: [Int]
    public let jobs: [Int]
    public let high: [Double]
    public let power: [Int]
    public let garbage: [Int]
    public let pollution: [Int]
    public let color: UInt32
}

public let ZONE_RES = ZoneInfo(key: "res", name: "Residential", pop: [0, 10, 48, 220], jobs: [0, 0, 0, 0], high: [0, 0, 0, 0],
                               power: [0, 1, 3, 8], garbage: [0, 1, 2, 4], pollution: [0, 0, 0, 0], color: 0x5fd068)
public let ZONE_COM = ZoneInfo(key: "com", name: "Commercial", pop: [0, 0, 0, 0], jobs: [0, 6, 30, 120], high: [0, 0, 0.4, 0.8],
                               power: [0, 2, 5, 12], garbage: [0, 1, 2, 4], pollution: [0, 0, 0, 0], color: 0x4aa8ff)
public let ZONE_IND = ZoneInfo(key: "ind", name: "Industrial", pop: [0, 0, 0, 0], jobs: [0, 12, 40, 100], high: [0, 0, 0, 0.7],
                               power: [0, 3, 7, 12], garbage: [0, 2, 3, 4], pollution: [0, 16, 26, 38], color: 0xffc547)
let ZONE_NONE = ZoneInfo(key: "", name: "", pop: [0, 0, 0, 0], jobs: [0, 0, 0, 0], high: [0, 0, 0, 0],
                         power: [0, 0, 0, 0], garbage: [0, 0, 0, 0], pollution: [0, 0, 0, 0], color: 0x888888)

public func zoneInfo(_ k: Kind) -> ZoneInfo {
    switch k {
    case .res: return ZONE_RES
    case .com: return ZONE_COM
    case .ind: return ZONE_IND
    default: return ZONE_NONE
    }
}

// Flat tables for hot loops (indexed by level 0...3).
let RES_POP: [Int] = [0, 10, 48, 220]
let COM_JOBS: [Int] = [0, 6, 30, 120]
let IND_JOBS: [Int] = [0, 12, 40, 100]
let COM_HIGH: [Double] = [0, 0, 0.4, 0.8]
let IND_HIGH: [Double] = [0, 0, 0, 0.7]
let RES_POWER: [Int] = [0, 1, 3, 8]
let COM_POWER: [Int] = [0, 2, 5, 12]
let IND_POWER: [Int] = [0, 3, 7, 12]
let RES_GARBAGE: [Int] = [0, 1, 2, 4]
let COM_GARBAGE: [Int] = [0, 1, 2, 4]
let IND_GARBAGE: [Int] = [0, 2, 3, 4]
let IND_POLLUTION: [Int] = [0, 16, 26, 38]

@inline(__always) func lvlIndex(_ L: UInt8) -> Int { Int(L > 3 ? 3 : L) }

@inline(__always) func zonePower(_ k: UInt8, _ L: Int) -> Int {
    k == K.res ? RES_POWER[L] : (k == K.com ? COM_POWER[L] : IND_POWER[L])
}
@inline(__always) func zoneGarbage(_ k: UInt8, _ L: Int) -> Int {
    k == K.res ? RES_GARBAGE[L] : (k == K.com ? COM_GARBAGE[L] : IND_GARBAGE[L])
}
@inline(__always) func zoneJobs(_ k: UInt8, _ L: Int) -> Int {
    k == K.com ? COM_JOBS[L] : (k == K.ind ? IND_JOBS[L] : 0)
}
@inline(__always) func zoneHigh(_ k: UInt8, _ L: Int) -> Double {
    k == K.com ? COM_HIGH[L] : (k == K.ind ? IND_HIGH[L] : 0)
}

// MARK: - Roads

public struct RoadClass {
    public let name: String
    public let cap: Double
    public let cost: Int
    public let upkeep: Double
}

/// Road classes: capacity in commuter trips per month-equivalent.
public let ROADS: [RoadClass] = [
    RoadClass(name: "Street", cap: 220, cost: 15, upkeep: 0.5),
    RoadClass(name: "Avenue", cap: 600, cost: 40, upkeep: 1.2),
]

// MARK: - Departments

public enum Dept: String, CaseIterable, Codable {
    case police, fire, health, edu, transit

    public var displayName: String {
        switch self {
        case .police: return "Police"
        case .fire: return "Fire"
        case .health: return "Health"
        case .edu: return "Education"
        case .transit: return "Transit"
        }
    }
}

// MARK: - Services

/// Order matters: the per-tile `svc` byte stores `index + 1`.
public enum ServiceID: String, CaseIterable, Codable {
    case wind, solar, gas, tower, landfill, recycling, police, fire, clinic, hospital, school, university, bus, metro, park, stadium

    /// 0-based position in `allCases`.
    public var index: Int { ServiceID.indexTable[self] ?? 0 }
    public var def: ServiceDef { SERVICE_DEFS[index] }

    private static let indexTable: [ServiceID: Int] = {
        var t: [ServiceID: Int] = [:]
        for (k, id) in ServiceID.allCases.enumerated() { t[id] = k }
        return t
    }()
}

public struct ServiceDef {
    public let id: ServiceID
    public let name: String
    public let size: Int
    public let cost: Int
    public let upkeep: Int
    public let power: Int
    public let pollution: Int
    public let waterRadius: Int
    public let garbage: Int
    public let radius: Int
    public let strength: Double
    public let dept: Dept?
    public let uni: Bool
    public let transit: Double
    public let lv: Int
    public let lvRadius: Int
    public let tourism: Int
    public let unlock: Int
    public let desc: String

    init(_ id: ServiceID, name: String, size: Int, cost: Int, upkeep: Int,
         power: Int = 0, pollution: Int = 0, waterRadius: Int = 0, garbage: Int = 0, radius: Int = 0,
         strength: Double = 0, dept: Dept? = nil, uni: Bool = false, transit: Double = 0,
         lv: Int = 0, lvRadius: Int = 0, tourism: Int = 0, unlock: Int, desc: String) {
        self.id = id; self.name = name; self.size = size; self.cost = cost; self.upkeep = upkeep
        self.power = power; self.pollution = pollution; self.waterRadius = waterRadius; self.garbage = garbage
        self.radius = radius; self.strength = strength; self.dept = dept; self.uni = uni; self.transit = transit
        self.lv = lv; self.lvRadius = lvRadius; self.tourism = tourism; self.unlock = unlock; self.desc = desc
    }
}

/// Service definitions in `ServiceID.allCases` order.
public let SERVICE_DEFS: [ServiceDef] = [
    ServiceDef(.wind, name: "Wind Turbine", size: 1, cost: 800, upkeep: 15, power: 60, unlock: 0, desc: "Clean power. Small output."),
    ServiceDef(.solar, name: "Solar Farm", size: 2, cost: 4000, upkeep: 40, power: 320, unlock: 1200, desc: "Clean, mid-size power."),
    ServiceDef(.gas, name: "Gas Power Plant", size: 2, cost: 6000, upkeep: 120, power: 900, pollution: 45, unlock: 300, desc: "Big output. Pollutes."),
    ServiceDef(.tower, name: "Water Tower", size: 1, cost: 600, upkeep: 20, waterRadius: 9, unlock: 0, desc: "Supplies water nearby. Needs power."),
    ServiceDef(.landfill, name: "Landfill", size: 2, cost: 2500, upkeep: 55, pollution: 22, garbage: 2400, radius: 20, unlock: 0, desc: "Collects garbage. Smelly — keep it away from homes."),
    ServiceDef(.recycling, name: "Recycling Center", size: 2, cost: 7000, upkeep: 110, garbage: 2600, radius: 18, unlock: 3000, desc: "Clean garbage collection with no pollution."),
    ServiceDef(.police, name: "Police Station", size: 1, cost: 1500, upkeep: 45, radius: 11, dept: .police, unlock: 0, desc: "Reduces crime."),
    ServiceDef(.fire, name: "Fire Station", size: 1, cost: 1500, upkeep: 45, radius: 11, dept: .fire, unlock: 0, desc: "Puts out fires and prevents them."),
    ServiceDef(.clinic, name: "Clinic", size: 1, cost: 900, upkeep: 30, radius: 7, strength: 0.6, dept: .health, unlock: 0, desc: "Basic local healthcare."),
    ServiceDef(.hospital, name: "Hospital", size: 2, cost: 5000, upkeep: 110, radius: 15, dept: .health, unlock: 1200, desc: "Strong healthcare over a wide area."),
    ServiceDef(.school, name: "School", size: 2, cost: 3500, upkeep: 80, radius: 13, dept: .edu, unlock: 300, desc: "Educated workers fill office and hi-tech jobs."),
    ServiceDef(.university, name: "University", size: 2, cost: 12000, upkeep: 220, radius: 22, dept: .edu, uni: true, unlock: 4000, desc: "Higher education city-wide. Unlocks skyscraper offices."),
    ServiceDef(.bus, name: "Bus Stop", size: 1, cost: 350, upkeep: 12, radius: 6, dept: .transit, transit: 0.3, unlock: 0, desc: "Takes cars off nearby roads."),
    ServiceDef(.metro, name: "Metro Station", size: 1, cost: 6500, upkeep: 140, radius: 11, dept: .transit, transit: 0.55, unlock: 5000, desc: "Moves masses underground. Big traffic relief."),
    ServiceDef(.park, name: "Park", size: 1, cost: 150, upkeep: 4, lv: 14, lvRadius: 5, unlock: 0, desc: "Raises land value, cleans air."),
    ServiceDef(.stadium, name: "Stadium", size: 3, cost: 20000, upkeep: 250, lv: 25, lvRadius: 16, tourism: 900, unlock: 5000, desc: "Landmark. Happiness, land value and tourists."),
]

public let SERVICES: [ServiceID: ServiceDef] = {
    var d: [ServiceID: ServiceDef] = [:]
    for s in SERVICE_DEFS { d[s.id] = s }
    return d
}()

/// Per-tile service byte for an id (index + 1).
public func svcIndex(_ id: ServiceID) -> UInt8 { UInt8(id.index + 1) }

/// Service id for a per-tile service byte (nil for 0 / out of range).
public func svcId(_ n: UInt8) -> ServiceID? {
    let k = Int(n) - 1
    let all = ServiceID.allCases
    return k >= 0 && k < all.count ? all[k] : nil
}

/// Fast definition lookup from a per-tile service byte.
@inline(__always)
func sdef(_ n: UInt8) -> ServiceDef? {
    let k = Int(n) - 1
    return k >= 0 && k < SERVICE_DEFS.count ? SERVICE_DEFS[k] : nil
}

public enum Cost {
    public static let road = 15
    public static let avenue = 40
    public static let upgrade = 28
    public static let zone = 25
    public static let bulldoze = 10
}

// MARK: - Policies

public struct PolicyDef {
    public let name: String
    public let flat: Double
    public let perCap: Double
    public let desc: String
}

/// City ordinances. cost = flat + perCap * population, per month.
public enum PolicyID: String, CaseIterable, Codable {
    case smoke, watch, freebus, recycle, rooftop, taxbreak, tourism, highrise, curfew

    public var def: PolicyDef {
        switch self {
        case .smoke: return PolicyDef(name: "Smoke Detector Mandate", flat: 50, perCap: 0.03, desc: "Fire risk −45%.")
        case .watch: return PolicyDef(name: "Neighborhood Watch", flat: 80, perCap: 0.04, desc: "Crime −20%.")
        case .freebus: return PolicyDef(name: "Free Public Transit", flat: 300, perCap: 0.02, desc: "Transit ridership +50%. No fare income.")
        case .recycle: return PolicyDef(name: "Recycling Program", flat: 100, perCap: 0.05, desc: "Garbage produced −35%.")
        case .rooftop: return PolicyDef(name: "Rooftop Solar Subsidy", flat: 150, perCap: 0.06, desc: "Each home adds 0.5 MW of clean power.")
        case .taxbreak: return PolicyDef(name: "Industrial Tax Break", flat: 0, perCap: 0, desc: "Industry demand up, industrial tax income −30%.")
        case .tourism: return PolicyDef(name: "Tourism Campaign", flat: 400, perCap: 0, desc: "Commercial demand up; landmarks and waterfront draw visitors.")
        case .highrise: return PolicyDef(name: "High-rise Ban", flat: 0, perCap: 0, desc: "No towers. Residents +4 happiness, land value +6.")
        case .curfew: return PolicyDef(name: "Night Curfew", flat: 60, perCap: 0, desc: "Crime −15%, commercial income −12%, happiness −3.")
        }
    }
}

public let POLICIES: [PolicyID: PolicyDef] = {
    var d: [PolicyID: PolicyDef] = [:]
    for p in PolicyID.allCases { d[p] = p.def }
    return d
}()

// MARK: - Milestones

public struct Milestone: Hashable {
    public let pop: Int
    public let name: String
    public init(pop: Int, name: String) { self.pop = pop; self.name = name }
}

public let MILESTONES: [Milestone] = [
    Milestone(pop: 0, name: "Hamlet"),
    Milestone(pop: 300, name: "Village"),
    Milestone(pop: 1200, name: "Town"),
    Milestone(pop: 5000, name: "City"),
    Milestone(pop: 15000, name: "Metropolis"),
    Milestone(pop: 40000, name: "Megalopolis"),
]

// MARK: - Tools & overlays

public enum DragMode { case none, line, rect }

/// Tool palette (declaration order = UI order).
public enum Tool: String, CaseIterable {
    case inspect, bulldoze, road, avenue, res, com, ind
    case wind, solar, gas, tower, landfill, recycling
    case police, fire, clinic, hospital, school, university
    case bus, metro, park, stadium

    public var service: ServiceID? { ServiceID(rawValue: rawValue) }

    public var zone: Kind? {
        switch self {
        case .res: return .res
        case .com: return .com
        case .ind: return .ind
        default: return nil
        }
    }

    public var label: String {
        if let s = service { return SERVICES[s]?.name ?? rawValue }
        switch self {
        case .inspect: return "Inspect"
        case .bulldoze: return "Bulldoze"
        case .road: return "Street"
        case .avenue: return "Avenue"
        case .res: return "Residential"
        case .com: return "Commercial"
        case .ind: return "Industrial"
        default: return rawValue
        }
    }

    public var group: String {
        switch self {
        case .inspect, .bulldoze, .road, .avenue: return "Core"
        case .res, .com, .ind: return "Zones"
        case .wind, .solar, .gas, .tower, .landfill, .recycling: return "Utilities"
        case .police, .fire, .clinic, .hospital, .school, .university: return "Services"
        case .bus, .metro: return "Transit"
        case .park, .stadium: return "Leisure"
        }
    }

    public var cost: Int {
        if let s = service { return SERVICES[s]?.cost ?? 0 }
        switch self {
        case .bulldoze: return Cost.bulldoze
        case .road: return Cost.road
        case .avenue: return Cost.avenue
        case .res, .com, .ind: return Cost.zone
        default: return 0
        }
    }

    public var drag: DragMode {
        switch self {
        case .bulldoze, .res, .com, .ind: return .rect
        case .road, .avenue: return .line
        default: return .none
        }
    }
}

public enum Overlay: String, CaseIterable {
    case none, traffic, power, water, lv, happy, edu, pollution, crime, garbage

    public var label: String {
        switch self {
        case .none: return "Off"
        case .traffic: return "Traffic"
        case .power: return "Power"
        case .water: return "Water"
        case .lv: return "Land value"
        case .happy: return "Happiness"
        case .edu: return "Education"
        case .pollution: return "Pollution"
        case .crime: return "Crime"
        case .garbage: return "Garbage"
        }
    }
}

// MARK: - Small value types shared by the API

public struct TileRect: Equatable {
    public var x0: Int, x1: Int, z0: Int, z1: Int
    public init(x0: Int, x1: Int, z0: Int, z1: Int) {
        self.x0 = x0; self.x1 = x1; self.z0 = z0; self.z1 = z1
    }
    /// Rectangle spanning two corners in any order.
    public init(corners ax: Int, _ az: Int, _ bx: Int, _ bz: Int) {
        self.init(x0: min(ax, bx), x1: max(ax, bx), z0: min(az, bz), z1: max(az, bz))
    }
}

public struct ActionResult {
    public var ok: Bool
    public var msg: String?
    public var cost: Int
    public var count: Int
    public init(ok: Bool, msg: String? = nil, cost: Int = 0, count: Int = 0) {
        self.ok = ok; self.msg = msg; self.cost = cost; self.count = count
    }
    static func fail(_ msg: String) -> ActionResult { ActionResult(ok: false, msg: msg) }
}

public enum ToastKind { case info, bad, milestone }
public enum FireState { case start, out, lost }

public struct Advice: Hashable {
    public var lvl: String   // "bad" | "warn" | "info" | "good"
    public var who: String
    public var text: String
    public init(lvl: String, who: String, text: String) { self.lvl = lvl; self.who = who; self.text = text }
}

public struct Demand: Equatable {
    public var r: Double, c: Double, i: Double
    public init(r: Double, c: Double, i: Double) { self.r = r; self.c = c; self.i = i }
}

/// Neighbour offsets used by the network searches (order matters for ties).
let DIRS_X: [Int] = [0, 1, 0, -1]
let DIRS_Z: [Int] = [-1, 0, 1, 0]
