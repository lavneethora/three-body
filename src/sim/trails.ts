/**
 * Trail geometry buffers.
 *
 * Two things make this cheap enough to run every frame for every body.
 *
 * First, the buffer is preallocated and written in place. Pushing a point is
 * three float writes and an index bump: no allocation, no geometry rebuild,
 * which is the usual source of trail-related GC stutter.
 *
 * Second, each point is written TWICE, at slot h and slot h + capacity. That
 * doubles the memory and buys something valuable: the most recent `count`
 * points are always a single contiguous run ending at h + capacity. A plain
 * ring buffer would wrap, and drawing it as one line strip would stitch the
 * newest point back to the oldest, dragging a stray chord across the screen.
 * With the mirrored copy a single setDrawRange always selects the right span.
 */
export class TrailBuffers {
  readonly capacity: number;
  readonly bodyCount: number;
  /** Per body, length 2 * capacity * 3. */
  readonly positions: Float32Array[];
  /** Static per-slot index, used by the shader to fade by age. */
  readonly slots: Float32Array;

  private head: number[];
  private count: number[];

  constructor(bodyCount: number, capacity: number) {
    this.bodyCount = bodyCount;
    this.capacity = capacity;
    this.positions = Array.from(
      { length: bodyCount },
      () => new Float32Array(capacity * 2 * 3),
    );
    this.slots = new Float32Array(capacity * 2);
    for (let i = 0; i < capacity * 2; i++) this.slots[i] = i;
    this.head = new Array(bodyCount).fill(0);
    this.count = new Array(bodyCount).fill(0);
  }

  push(body: number, x: number, y: number, z: number): void {
    const buf = this.positions[body];
    const h = this.head[body];
    const a = h * 3;
    const b = (h + this.capacity) * 3;

    buf[a] = x;
    buf[a + 1] = y;
    buf[a + 2] = z;
    buf[b] = x;
    buf[b + 1] = y;
    buf[b + 2] = z;

    this.head[body] = (h + 1) % this.capacity;
    if (this.count[body] < this.capacity) this.count[body]++;
  }

  /** Slot index of the newest point, which the fade shader needs. */
  newestSlot(body: number): number {
    // head has already advanced past the newest point.
    return ((this.head[body] - 1 + this.capacity) % this.capacity) + this.capacity;
  }

  drawCount(body: number): number {
    return this.count[body];
  }

  /** First slot of the contiguous run of live points. */
  drawStart(body: number): number {
    return this.newestSlot(body) - this.count[body] + 1;
  }

  clear(): void {
    this.head.fill(0);
    this.count.fill(0);
    for (const p of this.positions) p.fill(0);
  }
}
