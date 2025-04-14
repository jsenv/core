const answer = 42;

const startDevServer = async (...args) => {
  const namespace = await import("./dev/dev.js?dynamic_import_id=dev");
  return namespace.startDevServer(...args);
};

const build = async (...args) => {
  const namespace = await import("./build/build.js?dynamic_import_id=build");
  return namespace.build(...args);
};

export { answer, build, startDevServer };
