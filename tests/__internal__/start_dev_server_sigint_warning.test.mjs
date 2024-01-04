import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";

const numberOfListenersAtStart = process.listeners("SIGINT").length;
const countListeners = () => {
  return process.listeners("SIGINT").length - numberOfListenersAtStart;
};

const beforeDevServerStarts = countListeners();
const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./", import.meta.url),
});
const whileDevServerIsRunning = countListeners();
devServer.stop();
const afterDevServerStop = countListeners();
const actual = {
  beforeDevServerStarts,
  whileDevServerIsRunning,
  afterDevServerStop,
};
const expected = {
  beforeDevServerStarts: 0,
  whileDevServerIsRunning: 1,
  afterDevServerStop: 0,
};
assert({ actual, expected });
