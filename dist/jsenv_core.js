const injectionSymbol = Symbol.for("jsenv_injection");
const INJECTIONS = {
  optional: (value) => {
    return { [injectionSymbol]: "optional", value };
  },
};

// dev
const startDevServer = async (...args) => {
  const namespace = await import("./js/start_dev_server.js");
  return namespace.startDevServer(...args);
};

// build
const build = async (...args) => {
  const namespace = await import("./js/build.js");
  return namespace.build(...args);
};
const startBuildServer = async (...args) => {
  const namespace = await import("./js/start_build_server.js");
  return namespace.startBuildServer(...args);
};

export { INJECTIONS, build, startBuildServer, startDevServer };
