export const startDevServer = async (...args) => {
  const namespace = await import("./dev.js");
  return namespace.startDevServer(...args);
};

export const build = async (...args) => {
  const namespace = await import("./build.js");
  return namespace.build(...args);
};
