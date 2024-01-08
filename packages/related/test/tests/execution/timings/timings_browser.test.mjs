import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";

import { execute, chromium, firefox, webkit } from "@jsenv/test";

const test = async (params) => {
  const devServer = await startDevServer({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
  });
  const { timings } = await execute({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    webServer: {
      origin: devServer.origin,
      rootDirectoryUrl: new URL("./client/", import.meta.url),
    },
    fileRelativeUrl: `./main.html`,
    mirrorConsole: false,
    collectConsole: true,
    ...params,
  });
  devServer.stop();
  const actual = timings;
  const expected = {
    origin: assert.any(Number),
    start: assert.any(Number),
    runtimeStart: assert.any(Number),
    executionStart: assert.any(Number),
    executionEnd: assert.any(Number),
    runtimeEnd: assert.any(Number),
    end: assert.any(Number),
  };
  assert({ actual, expected });
  {
    const runDuration = timings.end - timings.start;
    const executionDuration = timings.executionEnd - timings.executionStart;
    const runtimeDuration = timings.runtimeEnd - timings.runtimeStart;
    const timeBetweenRuntimeStartAndExecutionStart =
      timings.executionStart - timings.runtimeStart;
    const actual = {
      executionDuration,
      runDuration,
      runtimeDuration,
      timeBetweenRuntimeStartAndExecutionStart,
    };
    const expected = {
      // execution must take around 2s (due to the timeout)
      executionDuration: assert.between(2_000, 4_000),
      // the overall run duration and runtime alive duration is between 2/7s
      runDuration: assert.between(2_000, 7_000),
      runtimeDuration: assert.between(2_000, 7_000),
      // it does not take more than 500ms to start the file
      timeBetweenRuntimeStartAndExecutionStart: assert.between(0, 500),
    };
    assert({ actual, expected });
  }
};

await test({ runtime: chromium() });
if (!process.env.CI) {
  if (process.platform !== "win32") {
    await test({ runtime: firefox() });
  }
  await test({ runtime: webkit() });
}
