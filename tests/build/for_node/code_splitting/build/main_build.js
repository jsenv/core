const answer = 42;

const startDevServer = async (...args) => {
  const namespace = await import("./js/dev.js?dynamic_import_id=dev");
  return namespace.startDevServer(...args);
};

const build = async (...args) => {
  const namespace = await import("./js/build.js?dynamic_import_id=build");
  return namespace.build(...args);
};

export { answer, build, startDevServer };
