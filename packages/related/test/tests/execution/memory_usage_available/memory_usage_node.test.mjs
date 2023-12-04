import { assert } from "@jsenv/assert";

import { execute, nodeChildProcess, nodeWorkerThread } from "@jsenv/test";

const test = async (params) => {
  let memoryUsageAfter3s;
  await execute({
    // logLevel: "debug",
    rootDirectoryUrl: new URL("./node_client/", import.meta.url),
    fileRelativeUrl: `./main.js`,
    onMeasureMemoryAvailable: async (takeMemoryUsage) => {
      const atStart = await takeMemoryUsage();
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      const after3s = await takeMemoryUsage();
      memoryUsageAfter3s = after3s - atStart;
    },
    ...params,
  });
  const actual = memoryUsageAfter3s;
  const expected = assert.between(7_000_000, 10_000_000); // around 7MB
  assert({ actual, expected });
};

// await test({
//   runtime: nodeChildProcess(),
// });
await test({
  runtime: nodeWorkerThread(),
});
