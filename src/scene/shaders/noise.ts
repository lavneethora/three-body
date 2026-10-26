/**
 * Gradient noise and fractal Brownian motion, shared by the body shaders.
 *
 * Procedural rather than texture-mapped, for three reasons: a user-invented
 * planet has no texture to download, the whole page has to load fast on a
 * phone from a single tap, and variety costs nothing this way.
 */
export const NOISE_CHUNK = /* glsl */ `
  vec3 hash3(vec3 p) {
    p = vec3(
      dot(p, vec3(127.1, 311.7, 74.7)),
      dot(p, vec3(269.5, 183.3, 246.1)),
      dot(p, vec3(113.5, 271.9, 124.6))
    );
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  float gnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(
        mix(dot(hash3(i + vec3(0.0, 0.0, 0.0)), f - vec3(0.0, 0.0, 0.0)),
            dot(hash3(i + vec3(1.0, 0.0, 0.0)), f - vec3(1.0, 0.0, 0.0)), u.x),
        mix(dot(hash3(i + vec3(0.0, 1.0, 0.0)), f - vec3(0.0, 1.0, 0.0)),
            dot(hash3(i + vec3(1.0, 1.0, 0.0)), f - vec3(1.0, 1.0, 0.0)), u.x),
        u.y),
      mix(
        mix(dot(hash3(i + vec3(0.0, 0.0, 1.0)), f - vec3(0.0, 0.0, 1.0)),
            dot(hash3(i + vec3(1.0, 0.0, 1.0)), f - vec3(1.0, 0.0, 1.0)), u.x),
        mix(dot(hash3(i + vec3(0.0, 1.0, 1.0)), f - vec3(0.0, 1.0, 1.0)),
            dot(hash3(i + vec3(1.0, 1.0, 1.0)), f - vec3(1.0, 1.0, 1.0)), u.x),
        u.y),
      u.z);
  }

  float fbm(vec3 p, int octaves, float lacunarity, float gain) {
    float sum = 0.0;
    float amp = 0.5;
    float norm = 0.0;
    for (int i = 0; i < 8; i++) {
      if (i >= octaves) break;
      sum += amp * gnoise(p);
      norm += amp;
      p *= lacunarity;
      amp *= gain;
    }
    return sum / max(norm, 0.0001);
  }

  /* Warping the sample point by more noise is what turns bland blobs into
     something with structure: swirls on a gas giant, cells on a star. */
  float warpedFbm(vec3 p, int octaves, float strength) {
    vec3 q = vec3(fbm(p, octaves, 2.0, 0.5),
                  fbm(p + vec3(5.2, 1.3, 2.7), octaves, 2.0, 0.5),
                  fbm(p + vec3(1.7, 9.2, 4.4), octaves, 2.0, 0.5));
    return fbm(p + strength * q, octaves, 2.0, 0.5);
  }
`;
