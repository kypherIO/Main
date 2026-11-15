import AVFAudio
import simd

/// Synthesized sound effects rendered through AVAudioEnvironmentNode, so
/// construction, demolition and fires are positioned in 3D (spatial audio /
/// HRTF on headphones). A city ambience bed scales with population.
final class AudioService {
    enum Sound: CaseIterable { case click, select, build, road, zone, bulldoze, error, cash, milestone, grow, alarm }

    var muted = false { didSet { engine.mainMixerNode.outputVolume = muted ? 0 : 0.8 } }
    private let engine = AVAudioEngine()
    private let env = AVAudioEnvironmentNode()
    private var players: [AVAudioPlayerNode] = []
    private let ambient = AVAudioPlayerNode()
    private let crackle = AVAudioPlayerNode()
    private var buffers: [Sound: AVAudioPCMBuffer] = [:]
    private var nextPlayer = 0
    private var started = false
    private let sampleRate: Double = 44100
    private lazy var mono = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!

    func start() {
        guard !started else { return }
        try? AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        engine.attach(env)
        engine.connect(env, to: engine.mainMixerNode, format: nil)
        env.distanceAttenuationParameters.referenceDistance = 6
        env.distanceAttenuationParameters.maximumDistance = 140
        env.distanceAttenuationParameters.rolloffFactor = 0.8
        for _ in 0..<8 {
            let p = AVAudioPlayerNode()
            engine.attach(p)
            engine.connect(p, to: env, format: mono)
            p.renderingAlgorithm = .HRTFHQ
            players.append(p)
        }
        engine.attach(ambient); engine.connect(ambient, to: engine.mainMixerNode, format: mono)
        engine.attach(crackle); engine.connect(crackle, to: env, format: mono)
        crackle.renderingAlgorithm = .HRTFHQ
        synthesize()
        do { try engine.start() } catch { return }
        players.forEach { $0.play() }
        if let amb = ambienceBuffer() { ambient.scheduleBuffer(amb, at: nil, options: .loops); ambient.volume = 0; ambient.play() }
        if let fire = noise(seconds: 2, volume: 0.5, cutoff: 2600, crackles: true) { crackle.scheduleBuffer(fire, at: nil, options: .loops); crackle.volume = 0; crackle.play() }
        engine.mainMixerNode.outputVolume = muted ? 0 : 0.8
        started = true
    }

    func play(_ s: Sound, at pos: SIMD3<Float>? = nil, volume: Float = 1) {
        guard started, !muted, let buf = buffers[s] else { return }
        let p = players[nextPlayer]
        nextPlayer = (nextPlayer + 1) % players.count
        let lp = env.listenerPosition
        if let pos { p.position = AVAudio3DPoint(x: pos.x, y: pos.y, z: pos.z) } else { p.position = lp }
        p.volume = volume
        p.scheduleBuffer(buf, at: nil, options: .interrupts)
        if !p.isPlaying { p.play() }
    }

    func update(listener: SIMD3<Float>, target: SIMD3<Float>, pop: Int, fires: [SIMD3<Float>]) {
        guard started else { return }
        env.listenerPosition = AVAudio3DPoint(x: listener.x, y: listener.y, z: listener.z)
        let f = simd_normalize(target - listener)
        env.listenerVectorOrientation = AVAudio3DVectorOrientation(forward: AVAudio3DVector(x: f.x, y: f.y, z: f.z), up: AVAudio3DVector(x: 0, y: 1, z: 0))
        ambient.volume = muted ? 0 : min(0.35, 0.04 + Float(log10(1 + Double(pop))) * 0.07)
        if let fire = fires.first {
            crackle.position = AVAudio3DPoint(x: fire.x, y: 0.5, z: fire.y)
            crackle.volume = 0.8
        } else { crackle.volume = 0 }
    }

    // MARK: synthesis
    private func buffer(_ samples: [Float]) -> AVAudioPCMBuffer? {
        guard let b = AVAudioPCMBuffer(pcmFormat: mono, frameCapacity: AVAudioFrameCount(samples.count)) else { return nil }
        b.frameLength = AVAudioFrameCount(samples.count)
        let ch = b.floatChannelData![0]
        for i in 0..<samples.count { ch[i] = samples[i] }
        return b
    }

    private enum Wave { case sine, square, triangle, saw }

    private func tone(_ freq: Double, _ dur: Double, _ wave: Wave, _ vol: Float, slide: Double = 1, delay: Double = 0, into out: inout [Float]) {
        let start = Int(delay * sampleRate), n = Int(dur * sampleRate)
        if out.count < start + n { out += [Float](repeating: 0, count: start + n - out.count) }
        var phase = 0.0
        for i in 0..<n {
            let t = Double(i) / Double(n)
            let f = freq * pow(slide, t)
            phase += f / sampleRate
            let p = phase - floor(phase)
            var s: Double
            switch wave {
            case .sine: s = sin(p * 2 * .pi)
            case .square: s = p < 0.5 ? 1 : -1
            case .triangle: s = 4 * abs(p - 0.5) - 1
            case .saw: s = 2 * p - 1
            }
            let env = min(1, Double(i) / (0.008 * sampleRate)) * pow(1 - t, 2)
            out[start + i] += Float(s * env) * vol
        }
    }

    private func noise(seconds: Double, volume: Float, cutoff: Double, crackles: Bool = false) -> AVAudioPCMBuffer? {
        var out = [Float](repeating: 0, count: Int(seconds * sampleRate))
        var lp: Float = 0
        let a = Float(min(1, 2 * .pi * cutoff / sampleRate))
        for i in 0..<out.count {
            let t = Float(i) / Float(out.count)
            var x = Float.random(in: -1...1)
            if crackles && Float.random(in: 0..<1) < 0.002 { x *= 8 }
            lp += a * (x - lp)
            out[i] = lp * volume * (crackles ? 1 : pow(1 - t, 2))
        }
        return buffer(out)
    }

    private func ambienceBuffer() -> AVAudioPCMBuffer? {
        var out = [Float](repeating: 0, count: Int(2 * sampleRate))
        var last: Float = 0
        for i in 0..<out.count { last = last * 0.985 + Float.random(in: -1...1) * 0.015; out[i] = last * 5 }
        return buffer(out)
    }

    private func synthesize() {
        func make(_ build: (inout [Float]) -> Void) -> AVAudioPCMBuffer? { var o: [Float] = []; build(&o); return buffer(o) }
        buffers[.click] = make { tone(1400, 0.04, .triangle, 0.1, into: &$0) }
        buffers[.select] = make { tone(660, 0.06, .triangle, 0.12, into: &$0); tone(990, 0.08, .triangle, 0.1, delay: 0.04, into: &$0) }
        buffers[.build] = make { tone(180, 0.14, .square, 0.07, slide: 0.6, into: &$0); tone(90, 0.2, .sine, 0.2, slide: 0.7, into: &$0) }
        buffers[.road] = make { tone(240, 0.06, .triangle, 0.08, into: &$0); tone(120, 0.08, .sine, 0.15, into: &$0) }
        buffers[.zone] = make { tone(520, 0.05, .sine, 0.12, into: &$0); tone(780, 0.07, .sine, 0.1, delay: 0.05, into: &$0) }
        buffers[.bulldoze] = noise(seconds: 0.4, volume: 0.5, cutoff: 500)
        buffers[.error] = make { tone(220, 0.12, .square, 0.07, into: &$0); tone(165, 0.16, .square, 0.07, delay: 0.1, into: &$0) }
        buffers[.cash] = make { tone(1318, 0.08, .triangle, 0.09, into: &$0); tone(1760, 0.14, .triangle, 0.09, delay: 0.07, into: &$0) }
        buffers[.milestone] = make { for (k, f) in [523.0, 659, 784, 1046].enumerated() { tone(f, 0.3, .triangle, 0.11, delay: Double(k) * 0.1, into: &$0) } }
        buffers[.grow] = make { tone(880, 0.05, .sine, 0.06, into: &$0) }
        buffers[.alarm] = make { for k in 0..<3 { tone(740, 0.12, .saw, 0.06, slide: 1.3, delay: Double(k) * 0.16, into: &$0) } }
    }
}
