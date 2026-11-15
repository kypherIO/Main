import Foundation
import SkyfoldCore

enum Persistence {
    static var url: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("city.json")
    }

    static func save(_ world: World) {
        guard let data = try? world.save() else { return }
        try? data.write(to: url, options: .atomic)
    }

    static func load() -> World? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? World.load(data)
    }
}

/// Pre-grown showcase city for first launch / title screen.
enum DemoCity {
    static func build(_ sim: Sim) {
        let w = sim.world
        let c = MAP / 2, R = 13
        w.funds = 1e7; w.peakPop = 99999
        func land(_ x: Int, _ z: Int) -> Bool { w.inb(x, z) && w.terrain[w.idx(x, z)] == 0 }
        var roads: [(Int, Int)] = []
        for z in (c - R)...(c + R) { for x in (c - R)...(c + R) where land(x, z) && ((x - c) % 5 == 0 || (z - c) % 5 == 0) { roads.append((x, z)) } }
        _ = sim.buildRoads(roads, cls: 0)
        for z in (c - R)...(c + R) {
            for x in (c - R)...(c + R) where land(x, z) && w.kind[w.idx(x, z)] == Kind.empty.rawValue {
                let d = max(abs(x - c), abs(z - c))
                let kind: Kind = d <= 4 ? .com : (x - c > 6 && z - c > 3) ? .ind : .res
                _ = sim.zone(TileRect(x0: x, x1: x, z0: z, z1: z), kind: kind)
            }
        }
        func spot(_ id: ServiceID, _ x: Int, _ z: Int) {
            let s = SERVICES[id]!
            for oz in 0..<s.size { for ox in 0..<s.size { if !land(x + ox, z + oz) || w.kind[w.idx(x + ox, z + oz)] == Kind.road.rawValue { return } } }
            _ = sim.bulldoze(TileRect(x0: x, x1: x + s.size - 1, z0: z, z1: z + s.size - 1))
            _ = sim.placeService(x, z, id)
        }
        spot(.stadium, c - 4, c + 6); spot(.hospital, c + 1, c - 9); spot(.school, c - 9, c - 4); spot(.gas, c + 11, c + 11)
        spot(.police, c + 2, c + 2); spot(.fire, c - 3, c - 3); spot(.park, c + 1, c - 1); spot(.park, c - 1, c + 1); spot(.park, c - 6, c + 2); spot(.park, c + 7, c - 6)
        for (x, z) in [(c - 12, c - 12), (c + 12, c - 12), (c - 12, c + 12), (c - 7, c - 12), (c + 3, c + 12)] { spot(.tower, x, z) }
        spot(.landfill, c + 11, c - 4); spot(.landfill, c - 14, c + 3); spot(.clinic, c - 6, c - 6); spot(.clinic, c + 6, c + 6); spot(.university, c + 6, c - 4)
        for (x, z) in [(c - 1, c - 6), (c + 4, c + 1), (c - 6, c + 4), (c + 1, c + 9)] { spot(.bus, x, z) }
        for k in 0..<8 { let x = c - R + 1 + k * 3, z = c - R - 1; if land(x, z) { _ = sim.placeService(x, z, .wind) } }
        var av: [(Int, Int)] = []
        for k in -R...R { if land(c + k, c) { av.append((c + k, c)) }; if land(c, c + k) { av.append((c, c + k)) } }
        _ = sim.buildRoads(av, cls: 1)
        var seed: UInt32 = 7
        sim.rng = {
            seed = seed &* 1664525 &+ 1013904223
            return Double(seed >> 8) / 16777216
        }
        for _ in 0..<1400 { sim.step() }
        sim.rng = { Double.random(in: 0..<1) }
        w.funds = 85000; w.day = 0; w.history = []; w.news = []
        w.peakPop = 0
        sim.recount()
    }
}
