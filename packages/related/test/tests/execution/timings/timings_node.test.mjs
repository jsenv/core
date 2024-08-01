import { assert } from "@jsenv/assert";

import { execute, nodeChildProcess, nodeWorkerThread } from "@jsenv/test";

const run = async ({ runtime }) => {
  const { timings } = await execute({
    // logLevel: "debug",
    rootDirectoryUrl: new URL("./node_client/", import.meta.url),
    fileRelativeUrl: `./main.js`,
    runtime,
  });
  const runDuration = timings.end - timings.start;
  const executionDuration = timings.executionEnd - timings.executionStart;
  const runtimeDuration = timings.runtimeEnd - timings.runtimeStart;
  const timeBetweenRuntimeStartAndExecutionStart =
    timings.executionStart - timings.runtimeStart;
  return {
    runDuration,
    executionDuration,
    runtimeDuration,
    timeBetweenRuntimeStartAndExecutionStart,
  };
};

const actual = {
  nodeWorkerThread: await run({
    runtime: nodeChildProcess(),
  }),
  nodeChildProcess: await run({
    runtime: nodeWorkerThread(),
  }),
};
const expect = {
  nodeWorkerThread: {
    // execution must take around 2s (due to the timeout)
    executionDuration: assert.between(2_000, 3_000),
    // the overall run duration and runtime alive duration is between 2/5s
    runDuration: assert.between(2_000, 5_000),
    runtimeDuration: assert.between(2_000, 5_000),
    // it does not take more than 500ms to start the file
    timeBetweenRuntimeStartAndExecutionStart: assert.between(0, 500),
  },
  nodeChildProcess: {
    // execution must take around 2s (due to the timeout)
    executionDuration: assert.between(2_000, 3_000),
    // the overall run duration and runtime alive duration is between 2/5s
    runDuration: assert.between(2_000, 5_000),
    runtimeDuration: assert.between(2_000, 5_000),
    // it does not take more than 500ms to start the file
    timeBetweenRuntimeStartAndExecutionStart: assert.between(0, 500),
  },
};
assert({ actual, expect });
