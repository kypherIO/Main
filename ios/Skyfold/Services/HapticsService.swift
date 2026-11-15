import CoreHaptics

/// Core Haptics patterns tuned for building, demolition, fires and milestones.
final class HapticsService {
    enum Effect { case tap, tick, select, build, rumble, success, error }

    var enabled = true
    private var engine: CHHapticEngine?

    init() {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }
        engine = try? CHHapticEngine()
        engine?.isAutoShutdownEnabled = true
        engine?.resetHandler = { [weak self] in try? self?.engine?.start() }
        try? engine?.start()
    }

    private func transient(_ i: Float, _ s: Float, _ t: TimeInterval = 0) -> CHHapticEvent {
        CHHapticEvent(eventType: .hapticTransient, parameters: [
            CHHapticEventParameter(parameterID: .hapticIntensity, value: i),
            CHHapticEventParameter(parameterID: .hapticSharpness, value: s),
        ], relativeTime: t)
    }

    private func continuous(_ i: Float, _ s: Float, _ t: TimeInterval, _ d: TimeInterval) -> CHHapticEvent {
        CHHapticEvent(eventType: .hapticContinuous, parameters: [
            CHHapticEventParameter(parameterID: .hapticIntensity, value: i),
            CHHapticEventParameter(parameterID: .hapticSharpness, value: s),
        ], relativeTime: t, duration: d)
    }

    func play(_ e: Effect) {
        guard enabled, let engine else { return }
        let events: [CHHapticEvent]
        switch e {
        case .tick: events = [transient(0.35, 0.9)]
        case .tap: events = [transient(0.55, 0.6)]
        case .select: events = [transient(0.5, 0.8), transient(0.35, 0.9, 0.06)]
        case .build: events = [transient(0.9, 0.35), continuous(0.4, 0.2, 0.02, 0.12)]
        case .rumble: events = [continuous(0.8, 0.1, 0, 0.35), transient(1, 0.2, 0.05)]
        case .success: events = [transient(0.6, 0.5), transient(0.8, 0.6, 0.1), transient(1, 0.7, 0.2)]
        case .error: events = [transient(0.8, 0.2), transient(0.8, 0.2, 0.12)]
        }
        do {
            let player = try engine.makePlayer(with: CHHapticPattern(events: events, parameters: []))
            try player.start(atTime: CHHapticTimeImmediate)
        } catch {}
    }
}
