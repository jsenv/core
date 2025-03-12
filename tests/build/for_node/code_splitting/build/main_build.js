const answer = 42;

const startDevServer = async (...args) => {
  const namespace = await import("./js/dev.js");
  return namespace.startDevServer(...args);
};

const build = async (...args) => {
  const namespace = await import("./js/build.js");
  return namespace.build(...args);
};

export { answer, build, startDevServer };
