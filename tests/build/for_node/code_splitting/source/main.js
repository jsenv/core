export const startDevServer = async (...args) => {
  const namespace = await import("./dev_server.js");
  return namespace.startDevServer(...args);
};

export const startBuildServer = async (...args) => {
  const namespace = await import("./build_server.js");
  return namespace.startBuildServer(...args);
};

export { answer } from "./shared.js";
