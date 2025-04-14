const answer = 42;

const startDevServer = async (...args) => {
  const namespace = await import("./dev_server/dev_server.js");
  return namespace.startDevServer(...args);
};

const startBuildServer = async (...args) => {
  const namespace = await import("./build_server/build_server.js");
  return namespace.startBuildServer(...args);
};

export { answer, startBuildServer, startDevServer };
