// dev
// export const startDevServer = async (...args) => {
//   const namespace = await import("./dev/start_dev_server.js");
//   return namespace.startDevServer(...args);
// };

// build
// export const build = async (...args) => {
//   const namespace = await import("./build/build.js");
//   return namespace.build(...args);
// };
export const startBuildServer = async (...args) => {
  const namespace = await import("./build/start_build_server.js");
  return namespace.startBuildServer(...args);
};

// others
export { INJECTIONS } from "./plugins/injections/jsenv_plugin_injections.js";
