const answer = 42;

const startDevServer = async (...args) => {
  const namespace = await import("./dev_server/dev_server.js?dynamic_import_id=dev_server");
  return namespace.startDevServer(...args);
};

const startBuildServer = async (...args) => {
  const namespace = await import("./build_server/build_server.js?dynamic_import_id=build_server");
  return namespace.startBuildServer(...args);
};

export { answer, startBuildServer, startDevServer };
