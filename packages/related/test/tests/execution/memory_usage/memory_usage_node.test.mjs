import { assert } from "@jsenv/assert";
import { execute, nodeChildProcess, nodeWorkerThread } from "@jsenv/test";

const run = async ({ runtime }) => {
  const { memoryUsage } = await execute({
    rootDirectoryUrl: new URL("./node_client/", import.meta.url),
    fileRelativeUrl: `./main.js`,
    measureMemoryUsage: true,
    runtime,
  });
  return memoryUsage;
};

assert({
  actual: {
    nodeWorkerThread: await run({
      runtime: nodeWorkerThread(),
    }),
    nodeChildProcess: await run({
      runtime: nodeChildProcess(),
    }),
  },
  expect: {
    nodeWorkerThread: assert.between(5_000_000, 9_000_000), // around 7MB
    nodeChildProcess: assert.between(5_000_000, 9_000_000), // around 7MB
  },
});
