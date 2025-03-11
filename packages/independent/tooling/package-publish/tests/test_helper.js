export const loadEnvFile = async (url) => {
  try {
    const data = await import(url);
    Object.assign(process.env, data.default);
    return true;
  } catch (e) {
    if (
      e.code === "MODULE_NOT_FOUND" ||
      // ENOENT is what jsenv throw for dynamic import not found
      // ideally it should be updated (in the case of node.js)
      // to trigger module not found error as node 13.6 does
      e.code === "ENOENT"
    ) {
      throw new Error(`missing env file at ${url}`);
    }

    if (e.code === "ERR_UNKNOWN_FILE_EXTENSION" && url.endsWith(".json")) {
      console.error(`cannot import ${url} because json is not supported.
enabled them with --experimental-json-modules flag.
documentation at https://nodejs.org/docs/latest-v13.x/api/esm.html#esm_experimental_json_modules`);
      return false;
    }
    throw e;
  }
};

export const assertProcessEnvShape = (shape) => {
  Object.keys(shape).forEach((key) => {
    const expectation = shape[key];
    if (expectation === true) {
      if (key in process.env === false) {
        throw new Error(`missing process.env.${key}`);
      }
      return;
    }
    if (expectation === false) {
      if (key in process.env) {
        throw new Error(`unexpected process.env.${key}`);
      }
      return;
    }
  });
};
