// Skyfold — Metal shaders. Everything procedural: no texture assets.
#include <metal_stdlib>
#include "ShaderTypes.h"
using namespace metal;

// ------------------------------------------------------------------ helpers
static float hash21(float2 p) {
    p = fract(p * float2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

static float vnoise(float2 p) {
    float2 i = floor(p), f = fract(p);
    float a = hash21(i), b = hash21(i + float2(1, 0)), c = hash21(i + float2(0, 1)), d = hash21(i + float2(1, 1));
    float2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static float3 applyFog(float3 col, float3 world, constant FrameUniforms& F) {
    float dist = length(F.cameraPos.xyz - world);
    float f = smoothstep(F.fogParams.x, F.fogParams.y, dist);
    return mix(col, F.fogColor.rgb, f);
}

static float shadowFactor(depth2d<float> sm, float4 lp) {
    float3 p = lp.xyz / lp.w;
    float2 uv = p.xy * float2(0.5, -0.5) + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || p.z > 1.0) return 1.0;
    constexpr sampler cmp(coord::normalized, filter::linear, address::clamp_to_edge, compare_func::less_equal);
    float texel = 1.0 / float(sm.get_width());
    float s = 0.0;
    for (int j = -1; j <= 1; j++)
        for (int i = -1; i <= 1; i++)
            s += sm.sample_compare(cmp, uv + float2(i, j) * texel, p.z - 0.0015);
    return s / 9.0;
}

// ------------------------------------------------------------------ mesh vertex
struct VOut {
    float4 position [[position]];
    float3 world;
    float3 normal;
    float2 uv;
    float3 color;
    float4 tint;
    float4 extra;
    float  mat [[flat]];
    float4 lightPos;
};

vertex VOut meshVertex(uint vid [[vertex_id]], uint iid [[instance_id]],
                       const device MeshVertex* verts [[buffer(BufVertices)]],
                       const device InstanceData* inst [[buffer(BufInstances)]],
                       constant FrameUniforms& F [[buffer(BufFrame)]]) {
    MeshVertex v = verts[vid];
    InstanceData I = inst[iid];
    float4 wp = I.model * float4(v.px, v.py, v.pz, 1.0);
    VOut o;
    o.position = F.viewProj * wp;
    o.world = wp.xyz;
    o.normal = normalize((I.model * float4(v.nx, v.ny, v.nz, 0.0)).xyz);
    o.uv = float2(v.u, v.v);
    o.color = float3(v.r, v.g, v.b);
    o.tint = I.tint;
    o.extra = I.extra;
    o.mat = v.mat;
    o.lightPos = F.lightViewProj * wp;
    return o;
}

struct SOut { float4 position [[position]]; };

vertex SOut shadowVertex(uint vid [[vertex_id]], uint iid [[instance_id]],
                         const device MeshVertex* verts [[buffer(BufVertices)]],
                         const device InstanceData* inst [[buffer(BufInstances)]],
                         constant FrameUniforms& F [[buffer(BufFrame)]]) {
    MeshVertex v = verts[vid];
    SOut o;
    o.position = F.lightViewProj * (inst[iid].model * float4(v.px, v.py, v.pz, 1.0));
    return o;
}

// ------------------------------------------------------------------ procedural roads
static float3 roadColor(float2 p, int mask, int cls, float3 world) {
    float sw = cls > 0 ? 0.086 : 0.18;
    bool n = (mask & 1) != 0, e = (mask & 2) != 0, s = (mask & 4) != 0, w = (mask & 8) != 0;
    int count = int(n) + int(e) + int(s) + int(w);
    bool inX = p.x > sw && p.x < 1.0 - sw;
    bool inY = p.y > sw && p.y < 1.0 - sw;
    bool asphalt = (inX && inY) || (n && inX && p.y <= sw) || (s && inX && p.y >= 1.0 - sw) ||
                   (e && inY && p.x >= 1.0 - sw) || (w && inY && p.x <= sw);
    if (mask == 0) asphalt = length(p - 0.5) < 0.52 - sw;
    float nz = vnoise(world.xz * 40.0);
    if (!asphalt) {
        float3 c = float3(0.72, 0.70, 0.66) * (0.94 + 0.06 * nz);
        float2 j = fract(p * 11.0);
        if (j.x < 0.05 || j.y < 0.05) c *= 0.92;
        return c;
    }
    float3 c = float3(0.20, 0.21, 0.23) * (0.9 + 0.14 * nz);
    const float3 yellow = float3(0.95, 0.76, 0.25), white = float3(0.92, 0.92, 0.9), green = float3(0.32, 0.52, 0.24);
    const float lw = 0.012;
    if (count <= 2 && mask != 0) {
        if (cls == 0) {
            if (abs(p.x - 0.5) < lw && ((n && p.y <= 0.5) || (s && p.y >= 0.5)) && fract(p.y * 4.0) < 0.55) c = yellow;
            if (abs(p.y - 0.5) < lw && ((w && p.x <= 0.5) || (e && p.x >= 0.5)) && fract(p.x * 4.0) < 0.55) c = yellow;
        } else {
            bool ns = n && s && !e && !w, ew = e && w && !n && !s;
            if (ns && abs(p.x - 0.5) < 0.035) c = abs(p.x - 0.5) < 0.024 ? green : float3(0.78, 0.76, 0.7);
            else if (ew && abs(p.y - 0.5) < 0.035) c = abs(p.y - 0.5) < 0.024 ? green : float3(0.78, 0.76, 0.7);
            else {
                if (abs(abs(p.x - 0.5) - 0.012) < 0.006 && ((n && p.y <= 0.5) || (s && p.y >= 0.5))) c = yellow;
                if (abs(abs(p.y - 0.5) - 0.012) < 0.006 && ((w && p.x <= 0.5) || (e && p.x >= 0.5))) c = yellow;
            }
            if ((n || s) && abs(abs(p.x - 0.5) - 0.21) < 0.007 && fract(p.y * 4.0) < 0.5 && ((n && p.y <= 0.5) || (s && p.y >= 0.5))) c = white;
            if ((e || w) && abs(abs(p.y - 0.5) - 0.21) < 0.007 && fract(p.x * 4.0) < 0.5 && ((w && p.x <= 0.5) || (e && p.x >= 0.5))) c = white;
        }
    } else if (count >= 3) {
        float zw = cls > 0 ? 0.07 : 0.085;
        bool zx = fract(p.x * 16.0) < 0.5, zy = fract(p.y * 16.0) < 0.5;
        if (n && inX && p.y > sw - zw && p.y < sw - 0.005 && zx) c = white;
        if (s && inX && p.y < 1.0 - sw + zw && p.y > 1.0 - sw + 0.005 && zx) c = white;
        if (w && inY && p.x > sw - zw && p.x < sw - 0.005 && zy) c = white;
        if (e && inY && p.x < 1.0 - sw + zw && p.x > 1.0 - sw + 0.005 && zy) c = white;
    }
    return c;
}

// ------------------------------------------------------------------ opaque fragment
fragment float4 meshFragment(VOut in [[stage_in]],
                             constant FrameUniforms& F [[buffer(BufFrame)]],
                             depth2d<float> shadowMap [[texture(TexShadow)]]) {
    int mat = int(in.mat + 0.5);
    float3 N = normalize(in.normal);
    float3 V = normalize(F.cameraPos.xyz - in.world);
    float night = F.fogParams.z;
    float lum = max(in.tint.r, max(in.tint.g, in.tint.b));
    float alive = smoothstep(0.35, 0.6, lum);
    float3 albedo = in.color * in.tint.rgb;
    float rough = 0.85, specK = 0.04;
    float3 emissive = float3(0.0);

    if (mat == MatNeon) {
        float3 c = in.color * mix(0.12, 1.0, alive) * (0.85 + night * 2.6);
        return float4(applyFog(c, in.world, F), 1.0);
    } else if (mat == MatWindowsRes || mat == MatWindowsOffice || mat == MatWindowsInd) {
        float2 g = in.uv * 8.0;
        float2 cell = fract(g), id = floor(g);
        float win = 0.0, litP = 0.5;
        float3 glass = float3(0.14, 0.2, 0.28);
        if (mat == MatWindowsRes) {
            win = step(0.22, cell.x) * step(cell.x, 0.78) * step(0.2, cell.y) * step(cell.y, 0.76);
            float frame = step(0.18, cell.x) * step(cell.x, 0.82) * step(0.16, cell.y) * step(cell.y, 0.8) * (1.0 - win);
            albedo *= 1.0 - frame * 0.35;
        } else if (mat == MatWindowsOffice) {
            win = step(0.03, cell.x) * step(cell.x, 0.97) * step(0.12, cell.y) * step(cell.y, 0.985);
            glass = float3(0.26, 0.37, 0.52) * (0.8 + 0.4 * hash21(id + 7.0));
            albedo = mix(albedo, in.color * float3(0.82, 0.85, 0.88), 0.5);
            litP = 0.42;
        } else {
            float row = step(0.5, fract(id.y * 0.5)) < 0.5 ? 1.0 : 0.0;
            win = row * step(0.25, hash21(id)) * step(0.1, cell.x) * step(cell.x, 0.9) * step(0.18, cell.y) * step(cell.y, 0.62);
            glass = float3(0.22, 0.27, 0.32);
            float corr = step(0.5, fract(in.uv.x * 40.0));
            albedo *= 0.94 + 0.06 * corr;
        }
        float3 glassTint = glass * mix(float3(1.0), in.tint.rgb, 0.3);
        float fres = pow(1.0 - saturate(dot(N, V)), 4.0);
        glassTint += mix(F.skyHorizon.rgb, F.skyTop.rgb, 0.4) * fres * 0.5 * (1.0 - night * 0.8);
        albedo = mix(albedo, glassTint, win);
        rough = mix(0.82, 0.1, win);
        specK = mix(0.04, mat == MatWindowsOffice ? 1.0 : 0.5, win);
        float lit = step(hash21(id + in.tint.w * 17.0), litP);
        float3 warm = mix(float3(1.0, 0.76, 0.46), float3(0.72, 0.86, 1.0), step(0.82, hash21(id + 3.1)));
        emissive = win * lit * warm * night * 1.9 * alive;
    } else if (mat == MatTerrain) {
        albedo *= 0.86 + 0.26 * vnoise(in.world.xz * 6.0) + 0.06 * vnoise(in.world.xz * 31.0);
        specK = 0.02;
    } else if (mat == MatRoad) {
        albedo = roadColor(in.uv, int(in.extra.x + 0.5), int(in.extra.y + 0.5), in.world);
        rough = 0.9;
    }

    float sh = shadowFactor(shadowMap, in.lightPos);
    float3 L = F.sunDir.xyz;
    float ndl = max(dot(N, L), 0.0);
    float3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), mix(8.0, 160.0, 1.0 - rough)) * specK * (1.0 - rough) * 3.0;
    float3 hemi = mix(F.hemiGround.rgb, F.hemiSky.rgb, N.y * 0.5 + 0.5) * F.hemiSky.w;
    float3 col = albedo * (F.sunColor.rgb * F.sunDir.w * ndl * sh + hemi) + F.sunColor.rgb * F.sunDir.w * spec * sh;
    for (int k = 0; k < 2; k++) {
        float4 lt = F.lights[k];
        if (lt.w <= 0.0) continue;
        float3 d = lt.xyz - in.world;
        float dist = length(d);
        float att = lt.w / (1.0 + dist * dist * 1.5) * max(dot(N, d / max(dist, 1e-3)), 0.0);
        col += albedo * float3(1.0, 0.45, 0.15) * att;
    }
    col += emissive;
    return float4(applyFog(col, in.world, F), 1.0);
}

// ------------------------------------------------------------------ transparent fragment (premultiplied)
fragment float4 transparentFragment(VOut in [[stage_in]],
                                    constant FrameUniforms& F [[buffer(BufFrame)]],
                                    texture2d<float> overlay [[texture(TexOverlay)]]) {
    int mat = int(in.mat + 0.5);
    float night = F.fogParams.z;
    if (in.tint.w < 0.0) { // build ghost
        float3 N = normalize(in.normal);
        float l = 0.55 + 0.45 * max(dot(N, F.sunDir.xyz), 0.0);
        float a = 0.5;
        return float4(in.tint.rgb * l * a, a);
    }
    if (mat == MatZonePlate) {
        float2 p = in.uv;
        float d = min(min(p.x, 1.0 - p.x), min(p.y, 1.0 - p.y));
        float along = abs(p.x - 0.5) > abs(p.y - 0.5) ? p.y : p.x;
        float border = step(0.025, d) * step(d, 0.06) * step(0.35, fract(along * 7.0));
        float a = 0.16 + border * 0.7;
        return float4(in.tint.rgb * a, a);
    }
    if (mat == MatWater) {
        float t = F.cameraPos.w;
        float2 q = in.world.xz;
        float2 grad = float2(0.0);
        const float2 dirs[4] = { float2(1.0, 0.3), float2(-0.4, 1.0), float2(0.7, -0.8), float2(-1.0, -0.2) };
        const float freqs[4] = { 2.1, 3.3, 5.7, 9.1 };
        for (int k = 0; k < 4; k++) {
            float2 dk = normalize(dirs[k]);
            float ph = dot(dk, q) * freqs[k] + t * (1.2 + k * 0.4);
            grad += dk * cos(ph) * (0.06 / (1.0 + k));
        }
        float3 N = normalize(float3(-grad.x, 1.0, -grad.y));
        float3 V = normalize(F.cameraPos.xyz - in.world);
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        float3 R = reflect(-V, N);
        float3 refl = mix(F.skyHorizon.rgb, F.skyTop.rgb, saturate(R.y * 2.0));
        float3 base = float3(0.05, 0.3, 0.38) * (F.hemiSky.w * 0.9 + F.sunDir.w * 0.25 * max(F.sunDir.y, 0.0));
        float3 H = normalize(F.sunDir.xyz + V);
        float spec = pow(max(dot(N, H), 0.0), 220.0) * F.sunDir.w * 2.5;
        float3 col = mix(base, refl, fres) + F.sunColor.rgb * spec;
        col = applyFog(col, in.world, F);
        float a = mix(0.78, 0.96, fres);
        return float4(col * a, a);
    }
    if (mat == MatOverlay) {
        constexpr sampler nearestS(filter::nearest, address::clamp_to_edge);
        constexpr sampler linearS(filter::linear, address::clamp_to_edge);
        float4 o = in.extra.x > 0.5 ? overlay.sample(nearestS, in.uv) : overlay.sample(linearS, in.uv);
        float a = o.a * 0.85;
        return float4(o.rgb * a, a);
    }
    if (mat == MatContactShadow) {
        float2 u = abs(in.uv - 0.5) * 2.0;
        float d = pow(pow(u.x, 6.0) + pow(u.y, 6.0), 1.0 / 6.0);
        float a = saturate((1.0 - d) / 0.28);
        a = a * a * 0.5;
        return float4(0.0, 0.0, 0.0, a);
    }
    if (mat == MatLightPool) {
        float r = length(in.uv - 0.5) * 2.0;
        float a = (1.0 - smoothstep(0.0, 1.0, r)) * night * 0.8;
        return float4(float3(1.0, 0.74, 0.42) * a, 0.0);  // additive
    }
    if (mat == MatCursor) {
        float2 p = in.uv;
        float d = min(min(p.x, 1.0 - p.x), min(p.y, 1.0 - p.y));
        float corner = (min(p.x, 1.0 - p.x) < 0.28 && min(p.y, 1.0 - p.y) < 0.28) ? 1.0 : 0.0;
        float a = step(d, 0.07) * corner * (0.75 + 0.25 * sin(F.cameraPos.w * 6.0)) + 0.1;
        return float4(in.tint.rgb * a, a);
    }
    // MatPreview and default
    float a = 0.5;
    return float4(in.tint.rgb * a, a);
}

// ------------------------------------------------------------------ sky
struct FSOut { float4 position [[position]]; float2 uv; float2 ndc; };

vertex FSOut fullscreenVertex(uint vid [[vertex_id]]) {
    float2 p = float2(vid == 1 ? 3.0 : -1.0, vid == 2 ? 3.0 : -1.0);
    FSOut o;
    o.position = float4(p, 1.0, 1.0);
    o.ndc = p;
    o.uv = float2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
    return o;
}

fragment float4 skyFragment(FSOut in [[stage_in]], constant FrameUniforms& F [[buffer(BufFrame)]]) {
    float4 wp = F.invViewProj * float4(in.ndc, 1.0, 1.0);
    float3 dir = normalize(wp.xyz / wp.w - F.cameraPos.xyz);
    float y = dir.y;
    float3 col = mix(F.skyHorizon.rgb, F.skyTop.rgb, pow(saturate(y), 0.55));
    col = mix(col, F.skyHorizon.rgb * 0.55, saturate(-y * 3.0));
    float s = max(dot(dir, F.sunDir.xyz), 0.0);
    col += F.sunColor.rgb * (pow(s, 600.0) * 6.0 + pow(s, 12.0) * 0.3) * (1.0 - F.fogParams.z * 0.85);
    float stars = F.fogParams.w;
    if (stars > 0.0 && y > 0.0) {
        float3 q = floor(dir * 380.0);
        float r = fract(sin(dot(q, float3(12.9898, 78.233, 37.719))) * 43758.5453);
        float tw = 0.6 + 0.4 * sin(F.cameraPos.w * 2.0 + r * 50.0);
        col += float3(step(0.9975, r)) * stars * tw * smoothstep(0.0, 0.25, y) * 1.6;
    }
    return float4(col, 1.0);
}

// ------------------------------------------------------------------ particles
struct POut { float4 position [[position]]; float2 uv; float4 color; };

vertex POut particleVertex(uint vid [[vertex_id]], uint iid [[instance_id]],
                           const device ParticleData* P [[buffer(BufInstances)]],
                           constant FrameUniforms& F [[buffer(BufFrame)]]) {
    const float2 corners[6] = { float2(-1, -1), float2(1, -1), float2(1, 1), float2(-1, -1), float2(1, 1), float2(-1, 1) };
    ParticleData p = P[iid];
    float2 c = corners[vid];
    float3 viewDir = normalize(p.posSize.xyz - F.cameraPos.xyz);
    float3 right = normalize(cross(viewDir, float3(0.0, 1.0, 0.0)));
    float3 up = cross(right, viewDir);
    float3 wp = p.posSize.xyz + (right * c.x + up * c.y) * p.posSize.w * 0.5;
    POut o;
    o.position = F.viewProj * float4(wp, 1.0);
    o.uv = c * 0.5 + 0.5;
    o.color = p.color;
    return o;
}

fragment float4 particleFragment(POut in [[stage_in]]) {
    float r = length(in.uv - 0.5) * 2.0;
    float puff = 0.8 + 0.2 * vnoise(in.uv * 5.0 + in.color.a * 13.0);
    float a = (1.0 - smoothstep(0.15, 1.0, r)) * in.color.a * puff;
    return float4(in.color.rgb * a, a);
}

// ------------------------------------------------------------------ post
fragment float4 brightPassFragment(FSOut in [[stage_in]], texture2d<float> hdr [[texture(TexHDR)]]) {
    constexpr sampler s(filter::linear, address::clamp_to_edge);
    float3 c = hdr.sample(s, in.uv).rgb;
    float l = max(c.r, max(c.g, c.b));
    return float4(c * smoothstep(0.85, 1.6, l), 1.0);
}

static float3 aces(float3 x) {
    return saturate((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14));
}

fragment float4 compositeFragment(FSOut in [[stage_in]],
                                  constant FrameUniforms& F [[buffer(BufFrame)]],
                                  texture2d<float> hdr [[texture(TexHDR)]],
                                  texture2d<float> bloom [[texture(TexBloom)]]) {
    constexpr sampler s(filter::linear, address::clamp_to_edge);
    float3 c = hdr.sample(s, in.uv).rgb;
    float tilt = F.post.z;
    if (tilt > 0.0) {
        float r = smoothstep(0.16, 0.5, abs(in.uv.y - 0.52)) * tilt;
        if (r > 0.3) {
            float3 acc = c; float tot = 1.0;
            for (int i = 0; i < 12; i++) {
                float a = float(i) * 2.39996;
                float rr = sqrt(float(i) + 0.5) / 3.4641;
                acc += hdr.sample(s, in.uv + float2(cos(a), sin(a)) * rr * r * F.viewport.zw).rgb;
                tot += 1.0;
            }
            c = acc / tot;
        }
    }
    c += bloom.sample(s, in.uv).rgb * F.post.x;
    c = aces(c * F.post.y);
    float2 p = in.uv - 0.5;
    c *= 1.0 - dot(p, p) * F.post.w;
    float l = dot(c, float3(0.2126, 0.7152, 0.0722));
    c = mix(float3(l), c, 1.08);
    return float4(saturate(c), 1.0);
}
