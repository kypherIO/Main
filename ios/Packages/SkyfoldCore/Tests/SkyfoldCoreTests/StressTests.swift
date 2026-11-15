import XCTest
import Foundation
@testable import SkyfoldCore

/// Maximum-load stress tests: a fully developed island (every buildable tile),
/// avenue grid, 250+ services, every policy on, fires enabled, 10 simulated years.
final class StressTests: XCTestCase {

    private func maxDensityCity(seed: UInt32 = 31337) -> Sim {
        let w = World.generate(seed: seed, name: "Stressville")
        let sim = Sim(world: w)
        var s: UInt32 = 99
        sim.rng = { s = s &* 1664525 &+ 1013904223; return Double(s >> 8) / 16777216 }
        w.funds = 1e9; w.peakPop = 1_000_000
        var roads: [(Int, Int)] = []
        for z in 1..<(MAP - 1) { for x in 1..<(MAP - 1) where w.terrain[w.idx(x, z)] == 0 && (x % 4 == 0 || z % 4 == 0) { roads.append((x, z)) } }
        XCTAssertTrue(sim.buildRoads(roads, cls: 1).ok)
        let ids: [ServiceID] = [.gas, .tower, .landfill, .police, .fire, .clinic, .school, .bus, .metro, .park, .hospital, .university, .recycling]
        var n = 0
        for z in stride(from: 1, to: MAP - 1, by: 4) { for x in stride(from: 1, to: MAP - 1, by: 4) {
            let id = ids[n % ids.count]; n += 1
            if sim.canPlaceService(x, z, id).ok { _ = sim.placeService(x, z, id) }
        } }
        let kinds: [Kind] = [.res, .res, .com, .ind]
        for i in 0..<N where w.terrain[i] == 0 && w.kind[i] == Kind.empty.rawValue {
            let (x, z) = w.xz(i)
            _ = sim.zone(TileRect(x0: x, x1: x, z0: z, z1: z), kind: kinds[(x * 7 + z * 3) % 4])
        }
        for p in PolicyID.allCases { sim.setPolicy(p, on: true) }
        return sim
    }

    private func assertInvariants(_ sim: Sim, file: StaticString = #filePath, line: UInt = #line) {
        let w = sim.world, s = sim.stats
        XCTAssertTrue(w.funds.isFinite, "funds not finite", file: file, line: line)
        XCTAssertTrue(w.approval.isFinite && w.approval >= 0 && w.approval <= 100, "approval out of range", file: file, line: line)
        XCTAssertTrue(s.unemployment.isFinite && s.unemployment >= 0 && s.unemployment <= 1, file: file, line: line)
        XCTAssertTrue((0...100).contains(s.happiness), file: file, line: line)
        XCTAssertGreaterThanOrEqual(s.pop, 0, file: file, line: line)
        for i in 0..<N {
            XCTAssertLessThanOrEqual(w.level[i], 3, file: file, line: line)
            if w.kind[i] == Kind.service.rawValue {
                let r = Int(w.root[i])
                XCTAssertTrue(r >= 0 && r < N && w.kind[r] == Kind.service.rawValue, "dangling service root at \(i)", file: file, line: line)
            }
            if w.terrain[i] != 0 { XCTAssertEqual(w.kind[i], Kind.empty.rawValue, "building on water at \(i)", file: file, line: line) }
        }
    }

    func testMaxDensityTenYears() {
        let sim = maxDensityCity()
        var times: [Double] = []
        times.reserveCapacity(3650)
        for d in 0..<3650 {
            let t0 = DispatchTime.now().uptimeNanoseconds
            sim.step()
            times.append(Double(DispatchTime.now().uptimeNanoseconds - t0) / 1e6)
            if d % 365 == 364 { assertInvariants(sim) }
        }
        let warm = times.dropFirst(60).sorted()
        let p50 = warm[warm.count / 2], p99 = warm[Int(Double(warm.count) * 0.99)], mx = warm.last!
        let avg = times.reduce(0, +) / Double(times.count)
        print(String(format: "STRESS max-density 10y: pop=%d jobs=%d avg=%.3f ms/day p50=%.3f p99=%.3f max=%.2f fires out/lost=%d/%d",
                     sim.stats.pop, sim.stats.jobs, avg, p50, p99, mx, sim.world.counters.firesOut, sim.world.counters.firesLost))
        XCTAssertGreaterThan(sim.stats.pop, 5000, "max-density city should support a large population")
        XCTAssertLessThan(avg, 5.0, "average sim day too slow for 4× speed at 120 Hz")
    }

    func testRandomActionsChaos() {
        // Thousands of random player actions interleaved with simulation: must never crash or corrupt state.
        let w = World.generate(seed: 2024, name: "Chaos")
        let sim = Sim(world: w)
        var s: UInt32 = 7
        func r() -> Double { s = s &* 1664525 &+ 1013904223; return Double(s >> 8) / 16777216 }
        sim.rng = { r() }
        w.funds = 5e6; w.peakPop = 1_000_000
        let services = ServiceID.allCases
        for step in 0..<6000 {
            let x = Int(r() * Double(MAP)), z = Int(r() * Double(MAP))
            let x2 = min(MAP - 1, x + Int(r() * 6)), z2 = min(MAP - 1, z + Int(r() * 6))
            switch Int(r() * 9) {
            case 0: _ = sim.buildRoads((x...x2).map { ($0, z) }, cls: Int(r() * 2))
            case 1: _ = sim.zone(TileRect(x0: x, x1: x2, z0: z, z1: z2), kind: [.res, .com, .ind][Int(r() * 3)])
            case 2: _ = sim.placeService(x, z, services[Int(r() * Double(services.count))])
            case 3: _ = sim.bulldoze(TileRect(x0: x, x1: x2, z0: z, z1: z2))
            case 4: sim.setPolicy(PolicyID.allCases[Int(r() * Double(PolicyID.allCases.count))], on: r() < 0.5)
            case 5: w.tax = Taxes(r: Int(r() * 21), c: Int(r() * 21), i: Int(r() * 21))
            case 6: if r() < 0.1 { _ = sim.takeLoan(25_000) } else if !w.loans.isEmpty { _ = sim.repayLoan(0) }
            case 7: w.budget[Dept.allCases[Int(r() * 5)]] = 50 + Int(r() * 11) * 10
            default: sim.step()
            }
            if step % 7 == 0 { sim.step() }
            if step % 1000 == 999 { assertInvariants(sim) }
        }
        // save → load round trip of a chaotic state
        let data = try! w.save()
        let back = try! World.load(data)
        XCTAssertEqual(back.kind, w.kind)
        XCTAssertEqual(back.level, w.level)
        XCTAssertEqual(back.flags, w.flags)
    }

    func testBankruptcyAndRecovery() {
        let w = World.generate(seed: 77, name: "Broke")
        let sim = Sim(world: w)
        w.funds = 100
        for d in Dept.allCases { w.budget[d] = 150 }
        for _ in 0..<720 { sim.step() }
        assertInvariants(sim)
        XCTAssertFalse(sim.buildRoads([(10, 10), (11, 10)], cls: 1).ok && w.funds < 0, "spending must be refused when broke")
    }

    func testPerformanceOfFieldsPass() {
        let sim = maxDensityCity()
        for _ in 0..<360 { sim.step() }
        measure { sim.computeFields() }
    }
}
