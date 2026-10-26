import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Strict mode is off deliberately.
   *
   * It double-invokes mount effects, which for ordinary React is a useful way
   * to surface missing cleanup. For a WebGL scene it means the renderer, the
   * effect composer and every GPU resource are created, torn down and created
   * again. The effect composer does not fully detach on that teardown, so a
   * second one stays subscribed to the frame loop and renders an empty target
   * over the real frame. The visible result is the scene blinking on and off
   * every other frame.
   *
   * It also made the opening preset load twice, rebuilding the whole
   * simulation for nothing.
   */
  reactStrictMode: false,
};

export default nextConfig;
