import { NOISE_CHUNK } from "./noise";

export const MAX_LIGHTS = 6;
export const MAX_OCCLUDERS = 12;

/** Keep in step with the BodyClass values the shader branches on. */
export const CLASS_INDEX: Record<string, number> = {
  rocky: 0,
  ocean: 1,
  desert: 2,
  ice: 3,
  lava: 4,
  "gas-giant": 5,
  "ringed-giant": 5,
  "black-hole": 6,
};

export const planetVertexShader = /* glsl */ `
  varying vec3 vObjectPos;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  void main() {
    vObjectPos = normalize(position);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/**
 * Procedural surface plus analytic eclipses.
 *
 * The shadowing is worth explaining. Rather than shadow maps, which would
 * need a cube map per star and would resolve badly across these scale
 * ratios, occlusion is solved directly: a star and a blocking body each
 * subtend a disc in the sky as seen from the point being shaded, and the
 * fraction of the star covered is the overlap area of two circles. That is a
 * closed-form expression, it is exact for spheres, and it gives a true umbra
 * and a soft penumbra for free. The practical payoff is that when three
 * bodies line up you get a real eclipse.
 */
export const planetFragmentShader = /* glsl */ `
  #define MAX_LIGHTS ${MAX_LIGHTS}
  #define MAX_OCCLUDERS ${MAX_OCCLUDERS}

  uniform vec3 uColor;
  uniform int uClass;
  uniform float uSeed;
  uniform int uOctaves;
  uniform float uNightLights;
  uniform float uAmbient;

  uniform int uLightCount;
  uniform vec3 uLightPos[MAX_LIGHTS];
  uniform vec3 uLightColor[MAX_LIGHTS];
  uniform float uLightRadius[MAX_LIGHTS];
  uniform float uLightPower[MAX_LIGHTS];

  uniform int uOccluderCount;
  uniform vec3 uOccluderPos[MAX_OCCLUDERS];
  uniform float uOccluderRadius[MAX_OCCLUDERS];

  varying vec3 vObjectPos;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  ${NOISE_CHUNK}

  /* Height field in [-1, 1]. Gas giants band by latitude; everything else
     gets warped fractal terrain. */
  float surfaceHeight(vec3 p) {
    if (uClass == 5) {
      float bands = sin(p.y * 9.0 + uSeed);
      float swirl = warpedFbm(p * vec3(1.6, 3.4, 1.6) + uSeed, uOctaves, 1.6);
      return bands * 0.55 + swirl * 0.75;
    }
    return warpedFbm(p * 2.1 + uSeed, uOctaves, 0.9);
  }

  vec3 surfaceColor(float h) {
    if (uClass == 1) {
      // Ocean world: water, shallows, coast, land, snow caps.
      vec3 deep = vec3(0.016, 0.07, 0.22);
      vec3 shallow = vec3(0.05, 0.26, 0.45);
      vec3 sand = vec3(0.62, 0.56, 0.38);
      vec3 land = vec3(0.13, 0.32, 0.13);
      vec3 snow = vec3(0.92, 0.94, 0.96);
      vec3 c = mix(deep, shallow, smoothstep(-0.5, 0.02, h));
      c = mix(c, sand, smoothstep(0.02, 0.07, h));
      c = mix(c, land, smoothstep(0.07, 0.22, h));
      c = mix(c, snow, smoothstep(0.46, 0.62, h));
      return c;
    }
    if (uClass == 3) {
      return mix(vec3(0.55, 0.68, 0.78), vec3(0.95, 0.98, 1.0),
                 smoothstep(-0.3, 0.5, h));
    }
    if (uClass == 4) {
      // Lava: dark crust split by glowing cracks.
      vec3 crust = vec3(0.09, 0.05, 0.05);
      vec3 hot = vec3(1.7, 0.42, 0.06);
      return mix(crust, hot, smoothstep(0.12, 0.42, h));
    }
    if (uClass == 5) {
      return mix(uColor * 0.55, uColor * 1.35, smoothstep(-0.6, 0.6, h));
    }
    // Rocky and desert: the body's own tint, darkened in the lows.
    return mix(uColor * 0.55, uColor * 1.2, smoothstep(-0.5, 0.5, h));
  }

  /* Fraction of a light still visible, 1 unblocked and 0 fully eclipsed. */
  float eclipse(vec3 P, vec3 L, float lightRadius) {
    float vis = 1.0;
    vec3 toL = L - P;
    float dL = length(toL);
    vec3 dirL = toL / dL;
    float aL = asin(clamp(lightRadius / dL, 0.0, 0.999));

    for (int i = 0; i < MAX_OCCLUDERS; i++) {
      if (i >= uOccluderCount) break;

      vec3 toC = uOccluderPos[i] - P;
      float dC = length(toC);
      // Past the light, or this is the very body being shaded: the fragment
      // sits exactly on its own surface, so its own sphere would otherwise
      // eclipse every point on it.
      if (dC >= dL || dC <= uOccluderRadius[i] * 1.02) continue;

      float aC = asin(clamp(uOccluderRadius[i] / dC, 0.0, 0.999));
      float sep = acos(clamp(dot(dirL, toC / dC), -1.0, 1.0));

      if (sep >= aL + aC) continue;              // nothing covered
      if (sep <= aC - aL) return 0.0;            // total eclipse
      if (sep <= aL - aC) {                      // annular: disc inside disc
        vis *= 1.0 - (aC * aC) / (aL * aL);
        continue;
      }

      // Partial: area shared by two overlapping circles.
      float x = (sep * sep + aL * aL - aC * aC) / (2.0 * sep);
      float y = sqrt(max(aL * aL - x * x, 0.0));
      float area = aL * aL * acos(clamp(x / aL, -1.0, 1.0))
                 + aC * aC * acos(clamp((sep - x) / aC, -1.0, 1.0))
                 - sep * y;
      vis *= clamp(1.0 - area / (3.14159265 * aL * aL), 0.0, 1.0);
    }

    return vis;
  }

  void main() {
    if (uClass == 6) {
      // Black hole: no surface to light.
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    float h = surfaceHeight(vObjectPos);
    vec3 albedo = surfaceColor(h);

    // Relief from the height gradient, sampled along a tangent basis.
    vec3 n = normalize(vWorldNormal);
    vec3 tangent = normalize(cross(abs(vObjectPos.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), vObjectPos));
    vec3 bitangent = cross(vObjectPos, tangent);
    float e = 0.012;
    float hx = surfaceHeight(normalize(vObjectPos + tangent * e));
    float hy = surfaceHeight(normalize(vObjectPos + bitangent * e));
    float relief = uClass == 5 ? 0.25 : 0.9;
    vec3 bump = normalize(n - (tangent * (hx - h) + bitangent * (hy - h)) * relief * 6.0);

    // Oceans are smooth and shiny; land is rough.
    float water = (uClass == 1) ? smoothstep(0.02, -0.08, h) : 0.0;
    float shininess = mix(8.0, 90.0, water);
    float specStrength = mix(0.04, 0.55, water);

    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 lit = albedo * uAmbient;
    float totalLight = 0.0;

    for (int i = 0; i < MAX_LIGHTS; i++) {
      if (i >= uLightCount) break;

      vec3 toL = uLightPos[i] - vWorldPos;
      float dist = length(toL);
      vec3 dirL = toL / dist;

      float ndl = dot(bump, dirL);
      if (ndl <= 0.0) continue;

      float shade = eclipse(vWorldPos, uLightPos[i], uLightRadius[i]);
      if (shade <= 0.0) continue;

      float falloff = uLightPower[i] / (dist * dist);
      float energy = ndl * shade * falloff;
      totalLight += energy;

      vec3 half3 = normalize(dirL + viewDir);
      float spec = pow(max(dot(bump, half3), 0.0), shininess) * specStrength;

      lit += uLightColor[i] * albedo * energy;
      lit += uLightColor[i] * spec * shade * falloff;
    }

    // City lights on the night side of an inhabited world.
    if (uNightLights > 0.0 && totalLight < 0.08) {
      float land = smoothstep(0.07, 0.2, h);
      float cities = pow(max(fbm(vObjectPos * 42.0 + uSeed, 3, 2.0, 0.5), 0.0), 3.0);
      float night = (1.0 - smoothstep(0.0, 0.08, totalLight));
      lit += vec3(1.0, 0.82, 0.48) * cities * land * night * uNightLights * 2.2;
    }

    gl_FragColor = vec4(lit, 1.0);
  }
`;

/**
 * Atmospheric shell.
 *
 * A slightly larger sphere drawn with a Fresnel rim, biased toward the star
 * so the limb above the day side glows and the night side stays dark. That
 * sunward bias is what sells the terminator.
 */
export const atmosphereVertexShader = planetVertexShader;

export const atmosphereFragmentShader = /* glsl */ `
  #define MAX_LIGHTS ${MAX_LIGHTS}

  uniform vec3 uColor;
  uniform float uStrength;
  uniform int uLightCount;
  uniform vec3 uLightPos[MAX_LIGHTS];
  uniform vec3 uLightColor[MAX_LIGHTS];
  uniform float uLightPower[MAX_LIGHTS];

  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);

    float fresnel = pow(1.0 - clamp(dot(n, viewDir), 0.0, 1.0), 3.0);

    vec3 glow = vec3(0.0);
    for (int i = 0; i < MAX_LIGHTS; i++) {
      if (i >= uLightCount) break;
      vec3 toL = uLightPos[i] - vWorldPos;
      float dist = length(toL);
      float ndl = max(dot(n, toL / dist), 0.0);
      float falloff = uLightPower[i] / (dist * dist);
      glow += uLightColor[i] * pow(ndl, 0.7) * falloff;
    }

    float a = fresnel * uStrength * clamp(length(glow), 0.0, 2.0);
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`;
