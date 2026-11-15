import XCTest
@testable import SkyfoldCore

final class SimTests: XCTestCase {
    let c = 32

    // MARK: helpers

    /// Mirrors the JS reference scenario (which reached pop ≈ 3000 after 1440 days with mulberry32(7)).
    private func buildTown(_ sim: Sim) {
        let w = sim.world
        var roads: [(Int, Int)] = []
        for z in (c - 12)...(c + 12) {
            for x in (c - 12)...(c + 12) {
                if w.terrain[w.idx(x, z)] != 0 { continue }
                if (x - c) % 4 == 0 || (z - c) % 4 == 0 { roads.append((x, z)) }
            }
        }
        XCTAssertTrue(sim.buildRoads(roads, cls: 0).ok)
        for z in (c - 12)...(c + 12) {
            for x in (c - 12)...(c + 12) {
                let i = w.idx(x, z)
                if w.terrain[i] != 0 || w.kind[i] != Kind.empty.rawValue { continue }
                let kind: Kind
                if max(abs(x - c), abs(z - c)) <= 3 { kind = .com }
                else if x > c + 5 && z > c + 2 { kind = .ind }
                else { kind = .res }
                _ = sim.zone(TileRect(x0: x, x1: x, z0: z, z1: z), kind: kind)
            }
        }
        w.peakPop = 99999
        func place(_ id: ServiceID, _ x: Int, _ z: Int) {
            let s = SERVICES[id]!.size
            _ = sim.bulldoze(TileRect(x0: x, x1: x + s - 1, z0: z, z1: z + s - 1))
            let r = sim.placeService(x, z, id)
            XCTAssertTrue(r.ok, "\(id) at \(x),\(z): \(r.msg ?? "")")
        }
        place(.gas, c + 9, c + 9)
        place(.wind, c - 6, c + 10)
        place(.wind, c - 5, c + 10)
        for (x, z) in [(c - 9, c - 9), (c + 7, c - 7), (c - 7, c + 7), (c + 2, c + 2)] { place(.tower, x, z) }
        place(.landfill, c + 9, c + 5)
        place(.landfill, c - 11, c - 2)
        place(.police, c + 1, c - 1)
        place(.fire, c - 1, c + 1)
        place(.school, c - 3, c - 3)
        place(.clinic, c + 3, c - 3)
        place(.bus, c + 1, c + 3)
        place(.park, c - 2, c + 5)
        w.peakPop = 0
        w.funds = 50000
    }

    // MARK: RNG parity with JS

    func testRNGMatchesJS() {
        let r = mulberry32(12345)
        XCTAssertEqual(r(), 0.9797282677609473)
        XCTAssertEqual(r(), 0.3067522644996643)
        XCTAssertEqual(r(), 0.484205421525985)
        let r2 = mulberry32(0xffffffff)
        XCTAssertEqual(r2(), 0.8964226141106337)
        XCTAssertEqual(r2(), 0.189478256739676)
        XCTAssertEqual(hash01(0, 7), 0.6164100945461541)
        XCTAssertEqual(hash01(100, 7), 0.10802007629536092)
        XCTAssertEqual(hash01(4095, 7), 0.196096372557804)
        XCTAssertEqual(hash01(123456, 0), 0.2904718732461333)
        XCTAssertEqual(hash01(-5, 3), 0.7685016384348273)
    }

    // MARK: (1) generation

    func testGenerateWorld() {
        let w = World.generate(seed: 4242, name: "Test")
        var land = 0, water = 0, roads = 0
        for i in 0..<N {
            if w.terrain[i] != 0 { water += 1 } else { land += 1 }
            if w.kind[i] == Kind.road.rawValue { roads += 1 }
        }
        XCTAssertGreaterThan(land, 0)
        XCTAssertGreaterThan(water, 0)
        // JS reference for seed 4242: land 2650, water 1446, roads 31.
        XCTAssertLessThanOrEqual(abs(land - 2650), 40, "terrain drifted from the JS generator: land=\(land)")
        XCTAssertGreaterThanOrEqual(roads, 19)
        // the buildable heart always holds the starter cross
        for x in (c - 5)..<(c + 5) { XCTAssertEqual(w.kind[w.idx(x, c)], Kind.road.rawValue) }
        for z in (c - 5)..<(c + 5) { XCTAssertEqual(w.kind[w.idx(c, z)], Kind.road.rawValue) }
        XCTAssertEqual(w.root[w.idx(c, c)], Int32(w.idx(c, c)))
        XCTAssertEqual(w.districts.count, 16)
        XCTAssertEqual(w.districts[0], "Fern Quarter")
        XCTAssertEqual(w.districts[1], "Saltwind Heights")
        XCTAssertEqual(w.funds, 50000)
        XCTAssertEqual(w.dateString(), "Jan 2030")
    }

    // MARK: (2) small town growth

    func testTownGrows() {
        let w = World.generate(seed: 4242, name: "Test")
        let sim = Sim(world: w)
        sim.rng = mulberry32(7)
        buildTown(sim)
        for _ in 0..<1440 { sim.step() }
        XCTAssertEqual(w.day, 1440)
        XCTAssertGreaterThan(sim.stats.pop, 500, "pop=\(sim.stats.pop)")
        XCTAssertGreaterThan(sim.stats.jobs, 0)
        XCTAssertTrue(w.funds.isFinite)
        XCTAssertFalse(w.history.isEmpty)
        XCTAssertFalse(sim.advice.isEmpty)
        XCTAssertNotNil(sim.stats.breakdown)
        XCTAssertGreaterThan(sim.stats.powerSupply, 0)
        XCTAssertNotEqual(sim.milestone().name, "Hamlet")
    }

    // MARK: (3) persistence

    func testSaveLoadRoundTrip() throws {
        let w = World.generate(seed: 4242, name: "Roundtrip")
        let sim = Sim(world: w)
        sim.rng = mulberry32(3)
        buildTown(sim)
        for _ in 0..<120 { sim.step() }
        sim.setPolicy(.watch, on: true)
        XCTAssertTrue(sim.takeLoan(10000).ok)
        w.budget[.police] = 120
        w.achievements.append("founder")

        let data = try w.save()
        let l = try World.load(data)
        XCTAssertEqual(l.kind, w.kind)
        XCTAssertEqual(l.level, w.level)
        XCTAssertEqual(l.terrain, w.terrain)
        XCTAssertEqual(l.svc, w.svc)
        XCTAssertEqual(l.root, w.root)
        XCTAssertEqual(l.tree, w.tree)
        XCTAssertEqual(l.flags, w.flags)
        XCTAssertEqual(l.garbage, w.garbage)
        XCTAssertEqual(l.waterDist, w.waterDist)
        XCTAssertEqual(l.name, "Roundtrip")
        XCTAssertEqual(l.seed, 4242)
        XCTAssertEqual(l.funds, w.funds)
        XCTAssertEqual(l.day, w.day)
        XCTAssertEqual(l.tax, w.tax)
        XCTAssertEqual(l.peakPop, w.peakPop)
        XCTAssertEqual(l.history, w.history)
        XCTAssertEqual(l.policies, [.watch])
        XCTAssertEqual(l.loans, w.loans)
        XCTAssertEqual(l.budget[.police], 120)
        XCTAssertEqual(l.approval, w.approval)
        XCTAssertEqual(l.approvalMods, w.approvalMods)
        XCTAssertEqual(l.petitions, w.petitions)
        XCTAssertEqual(l.achievements, w.achievements)
        XCTAssertEqual(l.counters, w.counters)
        XCTAssertEqual(l.districts, w.districts)
        XCTAssertEqual(l.news, w.news)

        // derived state is recomputed after load
        let sim2 = Sim(world: l)
        sim2.refreshAll()
        sim.refreshAll()
        XCTAssertEqual(sim2.stats.pop, sim.stats.pop)
        XCTAssertEqual(sim2.stats.jobs, sim.stats.jobs)
    }

    // MARK: (4) traffic

    func testTrafficCongestion() {
        let w = World.generate(seed: 4242, name: "Traffic")
        let sim = Sim(world: w)
        // homes west of the vertical street, offices east of it, all fronting the main street
        XCTAssertTrue(sim.zone(TileRect(x0: c - 5, x1: c - 1, z0: c + 1, z1: c + 1), kind: .res).ok)
        XCTAssertTrue(sim.zone(TileRect(x0: c + 1, x1: c + 4, z0: c + 1, z1: c + 1), kind: .com).ok)
        XCTAssertTrue(sim.placeService(c + 2, c - 1, .wind).ok)
        XCTAssertTrue(sim.placeService(c - 2, c - 1, .wind).ok)
        for x in (c - 5)...(c + 4) where x != c { w.level[w.idx(x, c + 1)] = 3 }
        sim.refreshAll()
        var maxTraffic = 0
        for i in 0..<N where w.kind[i] == Kind.road.rawValue { maxTraffic = max(maxTraffic, Int(w.traffic[i])) }
        XCTAssertGreaterThan(maxTraffic, 100, "the shared stretch should be over capacity")
        XCTAssertGreaterThan(sim.stats.congestion, 0)
        XCTAssertGreaterThan(sim.stats.trips, 0)
        XCTAssertGreaterThan(sim.stats.jammed, 0)
        XCTAssertGreaterThan(sim.stats.avgCommute, 0)
        let home = w.idx(c - 3, c + 1)
        XCTAssertNotEqual(w.commute[home], 255)
        XCTAssertGreaterThan(w.commute[home], 0)
    }

    // MARK: (5) action failures

    func testActionFailures() {
        let w = World.generate(seed: 4242, name: "Fail")
        let sim = Sim(world: w)
        let empty = TileRect(x0: c + 2, x1: c + 2, z0: c + 2, z1: c + 2)

        var r = sim.bulldoze(empty)
        XCTAssertFalse(r.ok); XCTAssertEqual(r.msg, "Nothing to bulldoze")

        r = sim.placeService(c, c, .wind)
        XCTAssertFalse(r.ok); XCTAssertEqual(r.msg, "Space is occupied")

        r = sim.placeService(c + 2, c + 2, .solar)
        XCTAssertFalse(r.ok); XCTAssertEqual(r.msg, "Unlocks at 1,200 population")

        r = sim.placeService(MAP - 1, MAP - 1, .gas)
        XCTAssertFalse(r.ok)

        if let wi = (0..<N).first(where: { w.terrain[$0] != 0 }) {
            let (x, z) = w.xz(wi)
            r = sim.placeService(x, z, .wind)
            XCTAssertFalse(r.ok); XCTAssertEqual(r.msg, "Cannot build on water")
        }

        r = sim.buildRoads([(c, c)], cls: 0)
        XCTAssertFalse(r.ok); XCTAssertEqual(r.msg, "Nothing to build here")

        // broke
        w.funds = 0
        r = sim.zone(empty, kind: .res)
        XCTAssertFalse(r.ok); XCTAssertEqual(r.msg, "Not enough funds")
        r = sim.placeService(c + 2, c + 2, .wind)
        XCTAssertFalse(r.ok); XCTAssertEqual(r.msg, "Not enough funds")
        r = sim.buildRoads([(c + 2, c + 2)], cls: 0)
        XCTAssertFalse(r.ok); XCTAssertEqual(r.msg, "Not enough funds")
        r = sim.bulldoze(TileRect(x0: c, x1: c, z0: c, z1: c))
        XCTAssertFalse(r.ok); XCTAssertEqual(r.msg, "Not enough funds")
        XCTAssertEqual(w.funds, 0)
        XCTAssertEqual(w.kind[w.idx(c + 2, c + 2)], Kind.empty.rawValue)

        // affordable again
        w.funds = 5000
        r = sim.placeService(c + 2, c + 2, .wind)
        XCTAssertTrue(r.ok); XCTAssertEqual(r.cost, 800)
        XCTAssertEqual(w.funds, 4200)
        XCTAssertEqual(w.kind[w.idx(c + 2, c + 2)], Kind.service.rawValue)
        XCTAssertEqual(svcId(w.svc[w.idx(c + 2, c + 2)]), .wind)
        r = sim.placeService(c + 2, c + 2, .wind)
        XCTAssertFalse(r.ok); XCTAssertEqual(r.msg, "Space is occupied")
        r = sim.zone(empty, kind: .res)
        XCTAssertFalse(r.ok); XCTAssertEqual(r.msg, "No free land to zone")
        r = sim.bulldoze(empty)
        XCTAssertTrue(r.ok); XCTAssertEqual(r.cost, Cost.bulldoze)
        XCTAssertEqual(w.kind[w.idx(c + 2, c + 2)], Kind.empty.rawValue)

        // loans
        r = sim.takeLoan(10000)
        XCTAssertTrue(r.ok); XCTAssertEqual(r.cost, 109)
        XCTAssertTrue(sim.takeLoan(10000).ok)
        XCTAssertTrue(sim.takeLoan(10000).ok)
        r = sim.takeLoan(10000)
        XCTAssertFalse(r.ok)
        XCTAssertEqual(w.loans.count, 3)
        w.funds = 0
        r = sim.repayLoan(0)
        XCTAssertFalse(r.ok); XCTAssertEqual(r.msg, "Need $10,044 to repay")
        w.funds = 20000
        r = sim.repayLoan(0)
        XCTAssertTrue(r.ok); XCTAssertEqual(r.cost, 10044)
        XCTAssertEqual(w.loans.count, 2)
        XCTAssertFalse(sim.repayLoan(9).ok)
    }

    // MARK: misc API surface

    func testConfigTables() {
        XCTAssertEqual(ServiceID.allCases.count, 16)
        XCTAssertEqual(svcIndex(.wind), 1)
        XCTAssertEqual(svcIndex(.stadium), 16)
        XCTAssertEqual(svcId(3), .gas)
        XCTAssertNil(svcId(0))
        XCTAssertEqual(SERVICES[.clinic]?.strength, 0.6)
        XCTAssertEqual(SERVICES[.school]?.dept, .edu)
        XCTAssertEqual(Tool.gas.label, "Gas Power Plant")
        XCTAssertEqual(Tool.gas.cost, 6000)
        XCTAssertEqual(Tool.road.drag, .line)
        XCTAssertEqual(Tool.res.zone, .res)
        XCTAssertEqual(Tool.park.service, .park)
        XCTAssertEqual(Overlay.lv.label, "Land value")
        XCTAssertEqual(zoneInfo(.ind).pollution, [0, 16, 26, 38])
        XCTAssertEqual(formatThousands(1234567), "1,234,567")
        XCTAssertEqual(formatThousands(-999), "-999")
        XCTAssertEqual(ProceduralWriter.fill("{city} has {pop} {missing}!", ["city": "A", "pop": "3"]), "A has 3 !")
        XCTAssertEqual(Events.ACHIEVEMENTS.count, 14)
    }

    func testProceduralWriter() async {
        let wr = ProceduralWriter(seed: 1)
        let h = await wr.headline(fact: Fact(type: "built", fields: ["building": "Park", "district": "Oak Hill"]),
                                  city: "X", stats: [:])
        XCTAssertFalse(h.ai)
        XCTAssertTrue(h.title.contains("Park") || h.title.contains("Oak Hill"))
        let ch = await wr.chirp(mood: "commute", district: "Oak Hill", city: "X", minutes: 40)
        XCTAssertTrue(ch.who.hasPrefix("@"))
        XCTAssertFalse(ch.text.contains("{"))
    }
}
