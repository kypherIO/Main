import GameController
import simd
import SkyfoldCore

/// Game Controller framework: Xbox / PlayStation / MFi gamepads.
///  • Left stick pans, right stick orbits (x) and zooms (y)
///  • A: use tool at screen centre, B: inspect / cancel
///  • L1 / R1: previous / next tool, Menu: pause
enum GameControllerSupport {
    private static var prev = [String: Bool]()

    static func start() {
        GCController.startWirelessControllerDiscovery(completionHandler: nil)
        GCController.shouldMonitorBackgroundEvents = false
    }

    private static func edge(_ key: String, _ pressed: Bool) -> Bool {
        let was = prev[key] ?? false
        prev[key] = pressed
        return pressed && !was
    }

    static func poll(_ g: GameModel, dt: Float) {
        guard let pad = GCController.current?.extendedGamepad else { return }
        let rig = g.rig
        let lx = pad.leftThumbstick.xAxis.value, ly = pad.leftThumbstick.yAxis.value
        if abs(lx) > 0.08 || abs(ly) > 0.08 {
            let sp = rig.dist * 0.9 * dt
            let f = SIMD2<Float>(-sin(rig.yaw), -cos(rig.yaw)), r = SIMD2<Float>(cos(rig.yaw), -sin(rig.yaw))
            rig.target.x += (f.x * ly + r.x * lx) * sp
            rig.target.z += (f.y * ly + r.y * lx) * sp
            rig.goal = nil
        }
        let rx = pad.rightThumbstick.xAxis.value, ry = pad.rightThumbstick.yAxis.value
        if abs(rx) > 0.08 { rig.yaw -= rx * dt * 2 }
        if abs(ry) > 0.08 { rig.dist *= 1 - ry * dt * 1.5 }
        let half = MAP / 2
        let cx = Int(floor(rig.target.x + Float(half))), cz = Int(floor(rig.target.z + Float(half)))
        if edge("a", pad.buttonA.isPressed), cx >= 0, cz >= 0, cx < MAP, cz < MAP, g.playing { g.tapTile(cx, cz) }
        if edge("b", pad.buttonB.isPressed) { g.select(.inspect) }
        let tools = Tool.allCases
        if let i = tools.firstIndex(of: g.tool) {
            if edge("r1", pad.rightShoulder.isPressed) { g.select(tools[(i + 1) % tools.count]) }
            if edge("l1", pad.leftShoulder.isPressed) { g.select(tools[(i - 1 + tools.count) % tools.count]) }
        }
        if edge("menu", pad.buttonMenu.isPressed) { g.togglePause() }
    }
}
