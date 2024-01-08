import { assert } from "@jsenv/assert";

import { execute, nodeChildProcess, nodeWorkerThread } from "@jsenv/test";

const test = async (params) => {
  const { status, timings } = await execute({
    // logLevel: "debug",
    rootDirectoryUrl: new URL("./node_client/", import.meta.url),
    fileRelativeUrl: `./main.js`,
    ...params,
  });
  {
    const actual = {
      status,
      timings,
    };
    const expected = {
      status: "completed",
      timings: {
        origin: assert.any(Number),
        start: assert.any(Number),
        runtimeStart: assert.any(Number),
        executionStart: assert.any(Number),
        executionEnd: assert.any(Number),
        runtimeEnd: assert.any(Number),
        end: assert.any(Number),
      },
    };
    assert({ actual, expected });
  }
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
      executionDuration: assert.between(2_000, 3_000),
      // the overall run duration and runtime alive duration is between 2/5s
      runDuration: assert.between(2_000, 5_000),
      runtimeDuration: assert.between(2_000, 5_000),
      // it does not take more than 500ms to start the file
      timeBetweenRuntimeStartAndExecutionStart: assert.between(0, 500),
    };
    assert({ actual, expected });
  }
};

await test({
  runtime: nodeChildProcess(),
});
await test({
  runtime: nodeWorkerThread(),
});
