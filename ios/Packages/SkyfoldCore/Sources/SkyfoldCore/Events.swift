// Petitions (quests), achievements, mayor approval and the city feed
// (port of game/src/events.js).
import Foundation

// MARK: - Helpers

private func near(_ w: World, _ x: Int, _ z: Int, _ r: Int, _ fn: (Int) -> Bool) -> Bool {
    for zz in (z - r)...(z + r) {
        for xx in (x - r)...(x + r) {
            if !w.inb(xx, zz) || (xx - x) * (xx - x) + (zz - z) * (zz - z) > r * r { continue }
            if fn(w.idx(xx, zz)) { return true }
        }
    }
    return false
}

private func isSvc(_ w: World, _ i: Int, _ ids: [ServiceID]) -> Bool {
    guard w.kind[i] == K.service else { return false }
    let r = Int(w.root[i])
    guard r >= 0 && r < N, let id = svcId(w.svc[r]) else { return false }
    return ids.contains(id)
}

/// Finds a developed residential tile matching a predicate (random sample), or -1.
private func findRes(_ sim: Sim, _ pred: (Int) -> Bool) -> Int {
    let w = sim.world
    var c: [Int] = []
    for i in 0..<N where w.kind[i] == K.res && w.level[i] != 0 && (w.flags[i] & F.abandoned) == 0 && pred(i) {
        c.append(i)
    }
    if c.isEmpty { return -1 }
    return c[min(c.count - 1, Int(sim.rng() * Double(c.count)))]
}

private func countOfficeTowers(_ w: World) -> Int {
    var n = 0
    for i in 0..<N where w.kind[i] == K.com && w.level[i] == 3 { n += 1 }
    return n
}

struct PetitionType {
    let key: String
    let goal: String
    let text: String
    let appr: Double
    let cash: Int
    let make: (Sim) -> Int
    let check: (Sim, Petition) -> Bool
    let base: ((Sim) -> Int)?
}

public struct Achievement {
    public let id: String
    public let name: String
    public let desc: String
    let check: (Stats, Sim) -> Bool
}

// MARK: - Events

public final class Events: @unchecked Sendable {
    weak var sim: Sim?
    public internal(set) var facts: [Fact] = []

    init() {}

    static let TYPES: [PetitionType] = [
        PetitionType(
            key: "park", goal: "Build a park within 5 tiles", text: "Families in {d} want somewhere green for the kids to play.",
            appr: 5, cash: 0,
            make: { sim in
                let w = sim.world
                return findRes(sim, { i in
                    let (x, z) = w.xz(i)
                    return w.lv[i] < 60 && !near(w, x, z, 5, { j in isSvc(w, j, [.park, .stadium]) })
                })
            },
            check: { sim, p in near(sim.world, p.x, p.z, 5, { j in isSvc(sim.world, j, [.park, .stadium]) }) },
            base: nil),
        PetitionType(
            key: "transit", goal: "Bring transit within reach", text: "Commuters in {d} are tired of sitting in traffic and want a bus line.",
            appr: 5, cash: 0,
            make: { sim in
                let w = sim.world
                return findRes(sim, { i in w.commute[i] > 22 && w.commute[i] < 255 && w.cov.transit[i] < 30 })
            },
            check: { sim, p in sim.world.cov.transit[sim.world.idx(p.x, p.z)] > 40 },
            base: nil),
        PetitionType(
            key: "safety", goal: "Cut crime here below 12", text: "A string of break-ins has {d} on edge. Residents demand action.",
            appr: 6, cash: 0,
            make: { sim in
                let w = sim.world
                return findRes(sim, { i in w.crime[i] > 24 })
            },
            check: { sim, p in sim.world.crime[sim.world.idx(p.x, p.z)] < 12 },
            base: nil),
        PetitionType(
            key: "school", goal: "Provide schooling nearby", text: "Parents in {d} are driving across town for school. They want one close by.",
            appr: 5, cash: 0,
            make: { sim in
                let w = sim.world
                return w.peakPop >= 300 ? findRes(sim, { i in w.cov.edu[i] < 25 }) : -1
            },
            check: { sim, p in sim.world.cov.edu[sim.world.idx(p.x, p.z)] > 70 },
            base: nil),
        PetitionType(
            key: "health", goal: "Healthcare coverage nearby", text: "The nearest doctor is too far from {d}. Seniors are asking for a clinic.",
            appr: 5, cash: 0,
            make: { sim in
                let w = sim.world
                return findRes(sim, { i in w.cov.health[i] < 20 && w.level[i] >= 2 })
            },
            check: { sim, p in sim.world.cov.health[sim.world.idx(p.x, p.z)] > 70 },
            base: nil),
        PetitionType(
            key: "clean", goal: "Get pollution here under 8", text: "A haze hangs over {d}. Residents want clean air.",
            appr: 6, cash: 0,
            make: { sim in
                let w = sim.world
                return findRes(sim, { i in w.pollution[i] > 22 })
            },
            check: { sim, p in sim.world.pollution[sim.world.idx(p.x, p.z)] < 8 },
            base: nil),
        PetitionType(
            key: "garbage", goal: "Clear the garbage here", text: "Bags are piling up on the curbs of {d}.",
            appr: 4, cash: 0,
            make: { sim in
                let w = sim.world
                return findRes(sim, { i in w.garbage[i] > 40 })
            },
            check: { sim, p in sim.world.garbage[sim.world.idx(p.x, p.z)] < 10 },
            base: nil),
        PetitionType(
            key: "traffic", goal: "Bring this road under 85% congestion", text: "Drivers say this stretch in {d} is a daily parking lot.",
            appr: 5, cash: 0,
            make: { sim in
                let w = sim.world
                var c: [Int] = []
                for i in 0..<N where w.kind[i] == K.road && w.traffic[i] > 120 { c.append(i) }
                if c.isEmpty { return -1 }
                return c[min(c.count - 1, Int(sim.rng() * Double(c.count)))]
            },
            check: { sim, p in sim.world.traffic[sim.world.idx(p.x, p.z)] < 85 },
            base: nil),
        PetitionType(
            key: "jobs", goal: "Get unemployment under 4%", text: "Job seekers rallied outside City Hall demanding work.",
            appr: 7, cash: 0,
            make: { sim in
                sim.stats.unemployment > 0.08 && sim.stats.pop > 300 ? findRes(sim, { _ in true }) : -1
            },
            check: { sim, _ in sim.stats.unemployment < 0.04 },
            base: nil),
        PetitionType(
            key: "power", goal: "End the brownouts", text: "Rolling blackouts are hitting homes. Fix the grid!",
            appr: 6, cash: 0,
            make: { sim in
                sim.stats.powerDemand > sim.stats.powerSupply ? findRes(sim, { _ in true }) : -1
            },
            check: { sim, _ in sim.stats.powerSupply >= sim.stats.powerDemand },
            base: nil),
        PetitionType(
            key: "investor", goal: "Grow 2 more office towers", text: "A tech firm will invest if {city} can offer more Class-A office space.",
            appr: 2, cash: 15000,
            make: { sim in
                sim.world.peakPop >= 1500 ? findRes(sim, { _ in true }) : -1
            },
            check: { sim, p in countOfficeTowers(sim.world) >= (p.base ?? 0) + 2 },
            base: { sim in countOfficeTowers(sim.world) }),
    ]

    static func petitionType(_ key: String) -> PetitionType? { TYPES.first { $0.key == key } }

    public static let ACHIEVEMENTS: [Achievement] = [
        Achievement(id: "founder", name: "Groundbreaking", desc: "Reach 100 residents.", check: { s, _ in s.pop >= 100 }),
        Achievement(id: "pop1k", name: "Thousand Strong", desc: "Reach 1,000 residents.", check: { s, _ in s.pop >= 1000 }),
        Achievement(id: "pop5k", name: "Big City", desc: "Reach 5,000 residents.", check: { s, _ in s.pop >= 5000 }),
        Achievement(id: "pop15k", name: "Metropolis", desc: "Reach 15,000 residents.", check: { s, _ in s.pop >= 15000 }),
        Achievement(id: "skyline", name: "Skyline", desc: "Grow a high-density office tower.",
                    check: { _, sim in countOfficeTowers(sim.world) > 0 }),
        Achievement(id: "green", name: "Green Grid", desc: "Power 1,500+ residents with zero gas plants.",
                    check: { s, sim in
                        if s.pop < 1500 || s.powerSupply < s.powerDemand { return false }
                        let w = sim.world, gas = svcIndex(.gas)
                        for i in 0..<N where w.kind[i] == K.service && w.svc[i] == gas { return false }
                        return true
                    }),
        Achievement(id: "fullemp", name: "Full Employment", desc: "Unemployment under 3% with 1,000+ residents.",
                    check: { s, _ in s.pop >= 1000 && s.unemployment < 0.03 }),
        Achievement(id: "flow", name: "Free Flowing", desc: "Congestion under 50% with 3,000+ residents.",
                    check: { s, _ in s.pop >= 3000 && s.congestion < 50 }),
        Achievement(id: "firefighter", name: "Heroes in Helmets", desc: "Put out 10 fires.",
                    check: { _, sim in sim.world.counters.firesOut >= 10 }),
        Achievement(id: "books", name: "Balanced Books", desc: "12 months in a row without a deficit.",
                    check: { _, sim in sim.world.counters.surplusMonths >= 12 }),
        Achievement(id: "beloved", name: "Beloved Mayor", desc: "Approval of 80%+ with 1,000+ residents.",
                    check: { s, sim in s.pop >= 1000 && sim.world.approval >= 80 }),
        Achievement(id: "scholar", name: "City of Scholars", desc: "Education 70%+ with 2,000+ residents.",
                    check: { s, _ in s.pop >= 2000 && s.education >= 70 }),
        Achievement(id: "civic", name: "Civic Hero", desc: "Complete 5 petitions.",
                    check: { _, sim in sim.world.counters.petitionsDone >= 5 }),
        Achievement(id: "tourist", name: "Tourist Magnet", desc: "Attract 1,500 tourists a month.",
                    check: { s, _ in s.tourists >= 1500 }),
    ]

    // MARK: feed

    func fact(_ f: Fact) {
        facts.append(f)
        if facts.count > 12 { facts.removeFirst() }
    }

    func ctx() -> (city: String, stats: [String: String]) {
        guard let sim = sim else { return ("", [:]) }
        let s = sim.stats
        let stats: [String: String] = [
            "pop": formatThousands(s.pop),
            "unemp": String(Int(jsRound(s.unemployment * 100))),
            "cong": String(s.congestion),
            "commute": String(s.avgCommute),
            "happiness": String(s.happiness),
        ]
        return (sim.world.name, stats)
    }

    /// Runs `block` on the sim's callback queue (or inline if none).
    private func deliver(_ block: @escaping @Sendable () -> Void) {
        if let q = sim?.callbackQueue { q.async(execute: block) } else { block() }
    }

    public func post(_ item: FeedItem) {
        guard let sim = sim else { return }
        let w = sim.world
        var it = item
        it.day = w.day
        it.date = w.dateString()
        w.news.append(it)
        if w.news.count > 60 { w.news.removeFirst() }
        sim.delegate?.simFeed(it)
    }

    func headlineFor(_ f: Fact) {
        guard let sim = sim else { return }
        var fact = f
        if f.type == "policy", let raw = f.fields["id"], let id = PolicyID(rawValue: raw) { fact.fields["policy"] = id.def.name }
        if f.type == "built", let raw = f.fields["id"], let id = ServiceID(rawValue: raw) { fact.fields["building"] = id.def.name }
        let c = ctx()
        let writer = sim.writer
        let factCopy = fact
        Task {
            let h = await writer.headline(fact: factCopy, city: c.city, stats: c.stats)
            let title = String(h.title.prefix(90)), body = String(h.body.prefix(220)), ai = h.ai
            self.deliver { self.post(FeedItem(kind: "news", title: title, body: body, ai: ai)) }
        }
    }

    func chirp() {
        guard let sim = sim else { return }
        let w = sim.world
        let i = findRes(sim, { _ in true })
        if i < 0 { return }
        let (x, z) = w.xz(i)
        let s = sim.stats
        var mood = "love"
        if w.commute[i] == 255 { mood = "noRoute" }
        else if w.power[i] == 0 { mood = "power" }
        else if w.water[i] == 0 { mood = "water" }
        else if w.garbage[i] > 45 { mood = "garbage" }
        else if w.crime[i] > 25 { mood = "crime" }
        else if w.pollution[i] > 25 { mood = "pollution" }
        else if w.commute[i] > 26 { mood = "commute" }
        else if s.unemployment > 0.1 { mood = "jobs" }
        else if w.tax.r > 13 { mood = "taxes" }
        let moodValue = mood
        let district = w.district(x, z), city = w.name, minutes = Int(w.commute[i])
        let writer = sim.writer
        Task {
            let c = await writer.chirp(mood: moodValue, district: district, city: city, minutes: minutes)
            let who = String(c.who.prefix(24)), text = String(c.text.prefix(200)), ai = c.ai
            self.deliver { self.post(FeedItem(kind: "chirp", who: who, body: text, ai: ai, at: i)) }
        }
    }

    // MARK: approval

    func updateApproval() {
        guard let sim = sim else { return }
        let w = sim.world, s = sim.stats
        var mods: [ApprovalMod] = []
        for var m in w.approvalMods {
            m.left -= 1
            if m.left > 0 { mods.append(m) }
        }
        w.approvalMods = mods
        var modSum = 0.0
        for m in mods { modSum += m.v * (Double(m.left) / 12) }
        var civic = 100 - s.unemployment * 300
        civic -= max(0, Double(s.congestion) - 60) * 0.3
        civic -= s.income < s.expense ? 8 : 0
        civic -= Double(s.burning) * 3
        let target = clamp(Double(s.happiness) * 0.65 + civic * 0.35 + modSum, 0, 100)
        w.approval = clamp(w.approval * 0.7 + target * 0.3, 0, 100)
    }

    // MARK: petitions

    func checkPetitions() {
        guard let sim = sim else { return }
        let w = sim.world
        for p in w.petitions.active {
            guard let T = Events.petitionType(p.type) else {
                w.petitions.active.removeAll { $0.id == p.id }
                continue
            }
            if T.check(sim, p) {
                w.petitions.active.removeAll { $0.id == p.id }
                w.counters.petitionsDone += 1
                sim.addApproval(p.rewardApproval, p.goal)
                if p.rewardCash != 0 { w.funds += Double(p.rewardCash) }
                let cash = p.rewardCash != 0 ? " · +$\(formatThousands(p.rewardCash))" : ""
                sim.toast("✅ Petition complete: \(p.goal)\(cash)", .milestone)
                fact(Fact(type: "petitionDone", fields: ["district": p.district, "title": p.goal]))
            } else if let dl = p.deadline, w.day > dl {
                w.petitions.active.removeAll { $0.id == p.id }
                w.counters.petitionsFailed += 1
                sim.addApproval(-p.rewardApproval * 0.8, "Broken promise")
                sim.toast("❌ Petition failed: \(p.goal)", .bad)
                fact(Fact(type: "petitionFailed", fields: ["district": p.district, "title": p.goal]))
            }
        }
        if let offer = w.petitions.offer, w.day > offer.expires {
            w.petitions.offer = nil
            sim.delegate?.simPetition(nil)
        }
        let P = w.petitions
        if P.offer == nil && P.active.count < 3 && w.day >= P.nextDay && sim.stats.pop >= 60 { offerPetition() }
    }

    func offerPetition() {
        guard let sim = sim else { return }
        let w = sim.world
        // JS shuffles with a random comparator; a Fisher–Yates shuffle on the sim rng is the faithful intent.
        var keys = Array(Events.TYPES.indices)
        var a = keys.count - 1
        while a > 0 {
            let b = min(a, Int(sim.rng() * Double(a + 1)))
            keys.swapAt(a, b)
            a -= 1
        }
        for k in keys {
            let T = Events.TYPES[k]
            if w.petitions.active.contains(where: { $0.type == T.key }) { continue }
            let at = T.make(sim)
            if at < 0 { continue }
            let (x, z) = w.xz(at)
            let d = w.district(x, z)
            let text = T.text.replacingOccurrences(of: "{d}", with: d).replacingOccurrences(of: "{city}", with: w.name)
            var p = Petition(type: T.key, x: x, z: z, district: d, goal: T.goal, text: text,
                             rewardApproval: T.appr, rewardCash: T.cash, months: 6, expires: w.day + 60)
            if let base = T.base { p.base = base(sim) }
            w.petitions.offer = p
            w.petitions.nextDay = w.day + 90 + Int(jsRound(sim.rng() * 90))
            let offered = p, city = w.name, writer = sim.writer
            Task {
                let t = await writer.petition(offered, city: city)
                let finalText = String(t.prefix(240))
                self.deliver { self.applyPetitionText(offered.id, finalText) }
            }
            return
        }
        w.petitions.nextDay = w.day + 60
    }

    private func applyPetitionText(_ id: UUID, _ text: String) {
        guard let sim = sim else { return }
        let w = sim.world
        if w.petitions.offer?.id == id {
            if !text.isEmpty { w.petitions.offer?.text = text }
            sim.delegate?.simPetition(w.petitions.offer)
        } else if let k = w.petitions.active.firstIndex(where: { $0.id == id }), !text.isEmpty {
            w.petitions.active[k].text = text
        }
    }

    /// Accepts the current petition offer.
    public func accept() {
        guard let sim = sim else { return }
        let w = sim.world
        guard var p = w.petitions.offer else { return }
        p.deadline = w.day + p.months * 30
        w.petitions.active.append(p)
        w.petitions.offer = nil
        post(FeedItem(kind: "petition", title: "Accepted: \(p.goal)", body: p.text))
    }

    /// Declines the current petition offer (small approval hit).
    public func decline() {
        guard let sim = sim else { return }
        if sim.world.petitions.offer == nil { return }
        sim.addApproval(-1.5, "Ignored a petition")
        sim.world.petitions.offer = nil
    }

    /// Short progress label for an active petition.
    public func progress(_ p: Petition) -> String {
        guard let sim = sim else { return "" }
        let w = sim.world, s = sim.stats
        guard w.inb(p.x, p.z) else { return "" }
        let i = w.idx(p.x, p.z)
        switch p.type {
        case "safety": return "Crime \(w.crime[i]) → 12"
        case "clean": return "Pollution \(w.pollution[i]) → 8"
        case "garbage": return "Garbage \(w.garbage[i]) → 10"
        case "traffic": return "Congestion \(w.traffic[i])% → 85%"
        case "jobs": return "Unemployment \(Int(jsRound(s.unemployment * 100)))% → 4%"
        case "power": return "\(s.powerSupply)/\(s.powerDemand) MW"
        case "transit": return "Transit \(Int(jsRound(Double(w.cov.transit[i]) / 2.55)))%"
        case "school": return "Education \(Int(jsRound(Double(w.cov.edu[i]) / 2.55)))%"
        case "health": return "Health \(Int(jsRound(Double(w.cov.health[i]) / 2.55)))%"
        default: return ""
        }
    }

    // MARK: achievements

    func checkAchievements() {
        guard let sim = sim else { return }
        let w = sim.world, s = sim.stats
        for a in Events.ACHIEVEMENTS {
            if w.achievements.contains(a.id) || !a.check(s, sim) { continue }
            w.achievements.append(a.id)
            sim.addApproval(2, a.name)
            sim.toast("🏆 \(a.name) — \(a.desc)", .milestone)
            fact(Fact(type: "achievement", fields: ["name": a.name, "desc": a.desc]))
            sim.delegate?.simAchievement(a.id)
        }
    }

    func monthly() {
        guard let sim = sim else { return }
        let s = sim.stats
        updateApproval()
        checkPetitions()
        checkAchievements()
        // feed: up to 2 headlines + a citizen voice
        let pending = facts
        facts.removeAll()
        let pri: [String: Int] = ["fire": 5, "milestone": 6, "achievement": 5, "petitionDone": 4, "petitionFailed": 4,
                                  "policy": 3, "tower": 2, "built": 1, "loan": 3]
        let sorted = pending.enumerated().sorted { a, b in
            let pa = pri[a.element.type] ?? 0
            let pb = pri[b.element.type] ?? 0
            return pa != pb ? pa > pb : a.offset < b.offset
        }.map { $0.element }
        var chosen = Array(sorted.prefix(2))
        if chosen.isEmpty && sim.world.day % 60 == 0 {
            if s.congestion > 90 { chosen.append(Fact(type: "traffic")) }
            else if s.unemployment > 0.1 { chosen.append(Fact(type: "jobs")) }
            else if s.pop > 0 { chosen.append(Fact(type: sim.rng() < 0.6 ? "boom" : "quiet")) }
        }
        for f in chosen { headlineFor(f) }
        if s.pop > 30 && sim.rng() < 0.75 { chirp() }
    }
}
