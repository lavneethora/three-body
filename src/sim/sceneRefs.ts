import type { BufferGeometry, Object3D, ShaderMaterial } from "three";

/**
 * Where the scene hands its mutable objects to the frame loop.
 *
 * There is exactly one useFrame callback in this app, in PhysicsDriver, and
 * it updates everything: stepping the engine, writing trail points, moving
 * meshes. Splitting those across several callbacks would either need
 * react-three-fiber's priority system, which takes over rendering entirely,
 * or rely on component mount order, which is not something to depend on.
 */
export const sceneRefs = {
  bodies: [] as (Object3D | null)[],
  trailGeometries: [] as (BufferGeometry | null)[],
  trailMaterials: [] as (ShaderMaterial | null)[],
};

export function resetSceneRefs(count: number): void {
  sceneRefs.bodies = new Array(count).fill(null);
  sceneRefs.trailGeometries = new Array(count).fill(null);
  sceneRefs.trailMaterials = new Array(count).fill(null);
}
