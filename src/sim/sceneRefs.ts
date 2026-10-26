import type { BufferGeometry, Mesh, Object3D, ShaderMaterial } from "three";

/** Minimal shape of drei's OrbitControls that the frame loop needs. */
export interface ControlsHandle {
  target: { set: (x: number, y: number, z: number) => void };
  update: () => void;
}

export interface BodyVisual {
  /** Drawn radius in AU, which is not the physical radius. */
  displayRadius: number;
  luminous: boolean;
  /** Relative to the Sun, from radius and temperature. */
  luminosity: number;
  /** Linear RGB, already converted from temperature for stars. */
  color: [number, number, number];
}

/**
 * Where the scene hands its mutable objects to the frame loop.
 *
 * There is exactly one useFrame callback in this app, in PhysicsDriver, and
 * it updates everything: stepping the engine, writing trail points, moving
 * meshes, and pushing light and occluder positions into the body shaders.
 * Splitting that across several callbacks would either need
 * react-three-fiber's priority system, which takes over rendering entirely,
 * or depend on component mount order, which is not safe to rely on.
 */
export const sceneRefs = {
  bodies: [] as (Object3D | null)[],
  /** Inner group holding the drawn geometry, scaled to keep a minimum size. */
  scalers: [] as (Object3D | null)[],
  trailGeometries: [] as (BufferGeometry | null)[],
  trailMaterials: [] as (ShaderMaterial | null)[],
  starMaterials: [] as (ShaderMaterial | null)[],
  planetMaterials: [] as (ShaderMaterial | null)[],
  atmosphereMaterials: [] as (ShaderMaterial | null)[],
  glowMeshes: [] as (Mesh | null)[],
  markers: [] as (Mesh | null)[],
  glowMaterials: [] as (ShaderMaterial | null)[],
  visuals: [] as (BodyVisual | null)[],
  controls: null as ControlsHandle | null,
  starfield: null as Object3D | null,
};

export function resetSceneRefs(count: number): void {
  sceneRefs.bodies = new Array(count).fill(null);
  sceneRefs.scalers = new Array(count).fill(null);
  sceneRefs.trailGeometries = new Array(count).fill(null);
  sceneRefs.trailMaterials = new Array(count).fill(null);
  sceneRefs.starMaterials = new Array(count).fill(null);
  sceneRefs.planetMaterials = new Array(count).fill(null);
  sceneRefs.atmosphereMaterials = new Array(count).fill(null);
  sceneRefs.glowMeshes = new Array(count).fill(null);
  sceneRefs.markers = new Array(count).fill(null);
  sceneRefs.glowMaterials = new Array(count).fill(null);
  sceneRefs.visuals = new Array(count).fill(null);
}
