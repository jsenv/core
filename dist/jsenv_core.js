import "@jsenv/ast";
import "@jsenv/sourcemap";

const injectionSymbol = Symbol.for("jsenv_injection");
const INJECTIONS = {
  global: (value) => {
    return { [injectionSymbol]: "global", value };
  },
  optional: (value) => {
    return { [injectionSymbol]: "optional", value };
  },
};

// dev
const startDevServer = async (...args) => {
  const namespace = await import("./start_dev_server/start_dev_server.js");
  return namespace.startDevServer(...args);
};

// build
const build = async (...args) => {
  const namespace = await import("./build/build.js");
  return namespace.build(...args);
};
const startBuildServer = async (...args) => {
  const namespace = await import("./start_build_server/start_build_server.js");
  return namespace.startBuildServer(...args);
};

export { INJECTIONS, build, startBuildServer, startDevServer };
