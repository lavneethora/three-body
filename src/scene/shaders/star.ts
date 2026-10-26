import { NOISE_CHUNK } from "./noise";

/**
 * A star surface, rather than a glowing ball.
 *
 * Three things do the work. Granulation: warped fractal noise scrolling
 * slowly, which is the convection-cell texture of a real photosphere. Limb
 * darkening: a star's disc genuinely dims toward its edge, because near the
 * limb you see higher, cooler layers, and reproducing it is most of why a
 * sphere stops looking like a billiard ball. And blackbody colour from the
 * star's actual temperature, so Proxima is dim red and Sirius is blue-white
 * instead of everything being the same yellow.
 *
 * Output is deliberately above 1.0 so the bloom pass has something to catch.
 */
export const starVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vObjectPos;
  varying vec3 vWorldPos;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vObjectPos = normalize(position);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const starFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uIntensity;
  uniform int uOctaves;

  varying vec3 vNormal;
  varying vec3 vObjectPos;
  varying vec3 vWorldPos;

  ${NOISE_CHUNK}

  void main() {
    vec3 p = vObjectPos * 3.2;
    float t = uTime * 0.06;

    // Two scales of churn: broad slow cells and finer faster mottling.
    float cells = warpedFbm(p + vec3(0.0, 0.0, t), uOctaves, 1.1);
    float fine = fbm(p * 5.5 + vec3(t * 2.3, 0.0, 0.0), uOctaves, 2.0, 0.5);
    float granulation = 0.62 + 0.46 * cells + 0.16 * fine;

    // Darker lanes between cells, like real granule boundaries.
    float lanes = smoothstep(0.42, 0.0, abs(cells));
    granulation *= 1.0 - 0.22 * lanes;

    // Limb darkening: mu is the cosine of the angle to the viewer.
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float mu = clamp(dot(normalize(vNormal), viewDir), 0.0, 1.0);
    float limb = 1.0 - 0.62 * (1.0 - mu) - 0.10 * (1.0 - mu) * (1.0 - mu);

    // The very edge runs hotter and whiter.
    float rim = pow(1.0 - mu, 3.0);

    vec3 color = uColor * granulation * limb * uIntensity;
    color += vec3(1.0, 0.86, 0.72) * rim * 0.7 * uIntensity;

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * Corona, drawn on a billboard behind the star.
 *
 * The falloff is a sum of a tight core and a wide halo rather than a single
 * exponential, which is what stops it reading as a flat fuzzy circle.
 */
export const glowVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const glowFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;
  uniform float uSeed;

  varying vec2 vUv;

  ${NOISE_CHUNK}

  void main() {
    vec2 d = vUv - 0.5;
    float r = length(d) * 2.0;
    if (r > 1.0) discard;

    float core = pow(max(1.0 - r, 0.0), 6.0);
    float halo = pow(max(1.0 - r, 0.0), 1.7) * 0.42;

    // A slow asymmetric shimmer, so the corona is not a perfect disc.
    float ang = atan(d.y, d.x);
    float flicker = 1.0 + 0.16 * fbm(
      vec3(cos(ang) * 2.0, sin(ang) * 2.0, uTime * 0.25 + uSeed), 3, 2.0, 0.5);

    float a = (core + halo * flicker) * uIntensity;
    gl_FragColor = vec4(uColor * a, a);
  }
`;
