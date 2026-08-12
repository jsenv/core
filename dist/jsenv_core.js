import "@jsenv/ast";
import "@jsenv/sourcemap";

const injectionSymbol = Symbol.for("jsenv_injection");
const INJECTIONS = {
  /**
   * Inject `Object.assign(window, { [key]: value })` at the top of the file
   * (into a script for html, into the module itself for js) instead of
   * replacing a placeholder: the value is read at runtime as a global.
   */
  global: (value) => {
    return { [injectionSymbol]: "global", value };
  },
  /**
   * Replace the placeholder when the file contains it, stay silent when it does not
   * (without this a missing placeholder is reported as a warning).
   */
  optional: (value) => {
    if (value && value[injectionSymbol]) {
      // a global injection is not a placeholder, it can't be missing from the file
      return value;
    }
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
