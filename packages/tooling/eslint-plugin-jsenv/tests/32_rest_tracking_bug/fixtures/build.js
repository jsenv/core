// build_wrapper.js - simulates dynamic import forwarding like @jsenv/core
export const build = async (params) => {
  // Dynamic import to simulate external module pattern
  const namespace = await import("./core_build.js");
  return namespace.build(params);
};
