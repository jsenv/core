import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";

import { execute, chromium, firefox, webkit } from "@jsenv/test";

const test = async (params) => {
  const startMs = Date.now();
  const devServer = await startDevServer({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
  });
  const result = await execute({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    webServer: {
      origin: devServer.origin,
      rootDirectoryUrl: new URL("./client/", import.meta.url),
    },
    fileRelativeUrl: `./main.html`,
    allocatedMs: 4_000,
    mirrorConsole: false,
    collectConsole: true,
    ...params,
  });
  const endMs = Date.now();
  const duration = endMs - startMs;
  devServer.stop();
  const actual = {
    status: result.status,
    consoleCalls: result.consoleCalls,
    duration,
  };
  const expect = {
    status: "timedout",
    consoleCalls: [
      {
        type: "log",
        text: `foo\n`,
      },
    ],
    duration: assert.between(2_000, 6_000),
  };
  assert({ actual, expect });
};

await test({ runtime: chromium() });
if (!process.env.CI) {
  if (process.platform !== "win32") {
    await test({ runtime: firefox() });
  }
  await test({ runtime: webkit() });
}
