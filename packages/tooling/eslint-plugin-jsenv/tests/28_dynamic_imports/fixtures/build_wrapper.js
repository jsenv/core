// build_wrapper.js - simulates dynamic import forwarding
export const build = async (params) => {
  const namespace = await import("./build.js");
  return namespace.build(params);
};
