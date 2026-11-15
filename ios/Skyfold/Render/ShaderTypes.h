// Types shared by Swift and Metal Shading Language.
#ifndef ShaderTypes_h
#define ShaderTypes_h

#include <simd/simd.h>

// Material ids carried per vertex (MeshVertex.mat)
typedef enum {
    MatPlain = 0, MatWindowsRes = 1, MatWindowsOffice = 2, MatWindowsInd = 3, MatNeon = 4,
    MatTerrain = 5, MatRoad = 6, MatZonePlate = 7, MatWater = 8, MatOverlay = 9,
    MatContactShadow = 10, MatLightPool = 11, MatPreview = 12, MatSeabed = 13, MatCursor = 14
} MaterialID;

typedef enum {
    BufVertices = 0, BufInstances = 1, BufFrame = 2
} BufferIndex;

typedef enum {
    TexShadow = 0, TexOverlay = 1, TexHDR = 2, TexBloom = 3
} TextureIndex;

// 48 bytes, tightly packed floats
typedef struct {
    float px, py, pz;
    float nx, ny, nz;
    float u, v;
    float r, g, b;
    float mat;
} MeshVertex;

typedef struct {
    simd_float4x4 model;
    simd_float4 tint;      // rgb tint, w = per-instance seed (<0 → ghost)
    simd_float4 extra;     // road: x = mask, y = class, z = traffic; generic payload
} InstanceData;

typedef struct {
    simd_float4 posSize;   // xyz world, w = size
    simd_float4 color;     // premultiplied-ready rgb (may exceed 1 for bloom), a
} ParticleData;

typedef struct {
    simd_float4x4 viewProj;
    simd_float4x4 invViewProj;
    simd_float4x4 lightViewProj;
    simd_float4 cameraPos;     // xyz, w = time
    simd_float4 sunDir;        // xyz (towards light), w = intensity
    simd_float4 sunColor;
    simd_float4 skyTop;
    simd_float4 skyHorizon;
    simd_float4 hemiSky;       // w = hemisphere intensity
    simd_float4 hemiGround;
    simd_float4 fogColor;
    simd_float4 fogParams;     // near, far, night (0..1), stars
    simd_float4 viewport;      // width, height, 1/width, 1/height (render target)
    simd_float4 post;          // bloomStrength, exposure, tiltShift, vignette
    simd_float4 lights[2];     // fire point lights: xyz, w = intensity
} FrameUniforms;

#endif
