const startDevServer = async () => {
  await import("./start_dev_server/start_dev_server.js");
};

const build = async () => {
  await import("./build/build.js");
};

export { build, startDevServer };
