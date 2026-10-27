import { NOISE_CHUNK } from "./noise";

export const MAX_LENSING_STEPS = 160;

export const blackHoleVertexShader = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/**
 * A black hole, drawn by bending light rather than by drawing a black circle.
 *
 * The quad is only a canvas. For each pixel a light ray is traced backwards
 * from the camera and integrated through Schwarzschild spacetime, using the
 * standard orbit equation for a null geodesic:
 *
 *   d2u/dphi2 + u = 3*M*u^2,   u = 1/r
 *
 * in units where the Schwarzschild radius is 1, so M = 0.5. Rays that fall
 * inside r = 1 are captured and the pixel is black; that shadow is not drawn,
 * it is what is left when light cannot get out.
 *
 * Everything else follows from the same integration rather than being faked:
 *
 *  - the accretion disk appears to wrap over the top and under the bottom of
 *    the hole, because rays that pass above it bend back down and cross the
 *    disk plane again on the far side
 *  - the photon ring is the bright edge where rays loop around repeatedly
 *    and cross the disk many times
 *  - one side of the disk is far brighter than the other, from relativistic
 *    beaming: the material there is orbiting at a good fraction of c and
 *    heading towards the viewer
 *  - background stars smear into arcs around the shadow, because that is
 *    where their light ended up
 */
export const blackHoleFragmentShader = /* glsl */ `
  #define MAX_STEPS ${MAX_LENSING_STEPS}

  uniform vec3 uCenter;
  uniform float uRs;
  uniform float uTime;
  uniform int uSteps;
  uniform float uDiskInner;
  uniform float uDiskOuter;

  varying vec3 vWorldPos;
  varying vec2 vUv;

  ${NOISE_CHUNK}

  float hash1(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
  }

  /** Background stars, sampled along whatever direction a ray escaped to. */
  vec3 starField(vec3 dir) {
    vec3 p = dir * 220.0;
    vec3 cell = floor(p);
    vec3 f = fract(p) - 0.5;
    float h = hash1(cell);
    if (h < 0.9915) return vec3(0.0);
    float brightness = (h - 0.9915) / 0.0085;
    float d = length(f);
    float point = smoothstep(0.42, 0.0, d) * brightness;
    // A touch of colour so the lensed sky is not uniformly white.
    vec3 tint = mix(vec3(1.0, 0.92, 0.82), vec3(0.82, 0.88, 1.0), hash1(cell + 7.1));
    return tint * point * 1.4;
  }

  /** Emission from the accretion disk at a point where a ray crossed it. */
  vec3 sampleDisk(vec3 hit, vec3 rayDir) {
    float r = length(hit.xy);
    float span = max(uDiskOuter - uDiskInner, 0.001);
    float t = clamp((r - uDiskInner) / span, 0.0, 1.0);

    // Hotter and whiter on the inside, cooling outward.
    vec3 colour = mix(vec3(1.35, 1.18, 0.95), vec3(1.0, 0.30, 0.05), pow(t, 0.7));

    // Falls off outward, and fades at both edges so the disk has no hard rim.
    float radial = pow(1.0 - t, 1.6);
    float edge = smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.88, t);

    // Turbulent banding, swept around with the orbit.
    float ang = atan(hit.y, hit.x);
    float orbitPhase = uTime * 0.35 / pow(max(r, 1.0), 1.5);
    float band = fbm(
      vec3(cos(ang + orbitPhase) * 2.2, sin(ang + orbitPhase) * 2.2, r * 0.75),
      4, 2.0, 0.5);
    float density = 0.55 + 0.85 * band;

    /*
     * Relativistic beaming.
     *
     * The disk orbits at v/c = sqrt(M/r), which at the innermost stable orbit
     * is over 40% of the speed of light. Emission from the side sweeping
     * towards the viewer is boosted hard, which is why a real image of a
     * black hole is so lopsided.
     */
    vec3 radialDir = normalize(vec3(hit.xy, 0.0));
    vec3 orbitDir = normalize(cross(vec3(0.0, 0.0, 1.0), radialDir));
    float beta = sqrt(0.5 / max(r, 1.0));
    float doppler = 1.0 / max(1.0 - beta * dot(orbitDir, -rayDir), 0.08);
    float beaming = pow(clamp(doppler, 0.25, 4.0), 3.0);

    // Approaching material also shifts blue, receding material red.
    vec3 shift = mix(vec3(1.0, 0.55, 0.35), vec3(0.75, 0.9, 1.25),
                     clamp((doppler - 0.7) / 1.6, 0.0, 1.0));

    return colour * shift * radial * edge * density * beaming;
  }

  void main() {
    // Everything below is in units of the Schwarzschild radius.
    vec3 origin = (cameraPosition - uCenter) / uRs;
    vec3 rayDir = normalize(vWorldPos - cameraPosition);

    float r0 = length(origin);
    if (r0 < 1.001) {
      // Inside the horizon there is nothing to show.
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    // The ray stays in the plane containing the camera and its direction.
    vec3 e1 = origin / r0;
    vec3 perp = rayDir - e1 * dot(rayDir, e1);
    float perpLen = length(perp);
    if (perpLen < 1e-6) {
      // Aimed straight at the centre: no bending to compute.
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }
    vec3 e2 = perp / perpLen;

    float u = 1.0 / r0;
    float du = -dot(rayDir, e1) / (r0 * perpLen);

    // Enough angle to let a ray loop the hole a couple of times.
    float dphi = (3.4 * 3.14159265) / float(uSteps);

    vec3 pos = origin;
    vec3 accum = vec3(0.0);
    float phi = 0.0;
    bool captured = false;
    bool escaped = false;
    float closest = r0;

    for (int i = 0; i < MAX_STEPS; i++) {
      if (i >= uSteps) break;

      // Leapfrog on d2u/dphi2 = 1.5*u^2 - u.
      float accel = 1.5 * u * u - u;
      du += accel * dphi;
      u += du * dphi;
      phi += dphi;

      if (u <= 1e-5) { escaped = true; break; }
      float r = 1.0 / u;
      if (r < 1.0) { captured = true; break; }
      closest = min(closest, r);

      vec3 next = r * (cos(phi) * e1 + sin(phi) * e2);

      // Crossing the disk plane: accumulate, so the far side seen over the
      // top of the hole adds to the near side seen in front of it.
      if (next.z * pos.z < 0.0) {
        float f = pos.z / (pos.z - next.z);
        vec3 hit = mix(pos, next, f);
        float hr = length(hit.xy);
        if (hr > uDiskInner && hr < uDiskOuter) {
          accum += sampleDisk(hit, normalize(next - pos));
        }
      }

      pos = next;
      if (r > 70.0) { escaped = true; break; }
    }

    if (escaped) {
      accum += starField(normalize(pos));
    }

    /*
     * The photon ring: light that orbited near r = 1.5 before escaping. The
     * integration already brightens this edge by crossing the disk several
     * times; this sharpens it into the thin bright line that marks the edge
     * of the shadow.
     */
    if (!captured) {
      float ring = smoothstep(0.62, 0.0, abs(closest - 1.5));
      accum += vec3(1.25, 1.0, 0.78) * ring * 0.55;
    }

    float alpha = captured ? 1.0 : clamp(max(max(accum.r, accum.g), accum.b), 0.0, 1.0);

    // Fade the quad's own edge so it does not end in a visible square.
    float edge = smoothstep(1.0, 0.82, length(vUv - 0.5) * 2.0);
    alpha *= edge;
    if (alpha < 0.004) discard;

    gl_FragColor = vec4(captured ? vec3(0.0) : accum, alpha);
  }
`;
