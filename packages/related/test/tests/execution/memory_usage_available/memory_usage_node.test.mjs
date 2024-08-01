import { assert } from "@jsenv/assert";

import { execute, nodeChildProcess, nodeWorkerThread } from "@jsenv/test";

const run = async ({ runtime }) => {
  let memoryUsageAfter3s;
  await execute({
    rootDirectoryUrl: new URL("./node_client/", import.meta.url),
    fileRelativeUrl: `./main.js`,
    onMeasureMemoryAvailable: async (takeMemoryUsage) => {
      const atStart = await takeMemoryUsage();
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      const after3s = await takeMemoryUsage();
      memoryUsageAfter3s = after3s - atStart;
    },
    runtime,
  });
  return memoryUsageAfter3s;
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
    nodeWorkerThread: assert.between(7_000_000, 10_000_000), // around 7MB
    nodeChildProcess: assert.between(7_000_000, 10_000_000), // around 7MB
  },
});
