export const startDevServer = async () => {
  await import("./dev/start_dev_server.js");
};

export const build = async () => {
  await import("./build/build.js");
};
