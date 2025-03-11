import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";
import {
  chromiumIsolatedTab,
  execute,
  firefoxIsolatedTab,
  webkitIsolatedTab,
} from "@jsenv/test";

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
  const expect = {
    origin: assert.any(Number),
    start: assert.any(Number),
    runtimeStart: assert.any(Number),
    executionStart: assert.any(Number),
    executionEnd: assert.any(Number),
    runtimeEnd: assert.any(Number),
    end: assert.any(Number),
  };
  assert({ actual, expect });
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
    const expect = {
      // execution must take around 2s (due to the timeout)
      executionDuration: assert.between(2_000, 6_000),
      // the overall run duration and runtime alive duration is between 2/10s
      runDuration: assert.between(2_000, 20_000),
      runtimeDuration: assert.between(2_000, 10_000),
      // it does not take more than 5s to start the file
      timeBetweenRuntimeStartAndExecutionStart: assert.between(0, 5_000),
    };
    assert({ actual, expect });
  }
};

await test({ runtime: chromiumIsolatedTab() });
if (!process.env.CI) {
  if (process.platform !== "win32") {
    await test({ runtime: firefoxIsolatedTab() });
  }
  await test({ runtime: webkitIsolatedTab() });
}
