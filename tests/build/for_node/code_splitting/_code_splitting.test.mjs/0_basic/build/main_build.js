const answer = 42;

const startDevServer = async (...args) => {
  const namespace = await import("./dev/dev.js");
  return namespace.startDevServer(...args);
};

const build = async (...args) => {
  const namespace = await import("./build/build.js");
  return namespace.build(...args);
};

export { answer, build, startDevServer };
