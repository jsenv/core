import { assert } from "@jsenv/assert";

import { execute, nodeChildProcess, nodeWorkerThread } from "@jsenv/test";

const test = async (params) => {
  let usageAtStart;
  const { memoryUsage } = await execute({
    // logLevel: "debug",
    rootDirectoryUrl: new URL("./node_client/", import.meta.url),
    fileRelativeUrl: `./main.js`,
    measureMemoryUsage: true,
    onMeasureMemoryAvailable: async (takeMemoryUsage) => {
      usageAtStart = await takeMemoryUsage();
    },
    ...params,
  });
  // we compare usage end - usage start to prevent
  // node or os specificities to influence the measures
  const actual = memoryUsage - usageAtStart;
  const expected = assert.between(5_000_000, 9_000_000); // around 7MB
  assert({ actual, expected });
};

await test({
  runtime: nodeChildProcess(),
});
await test({
  runtime: nodeWorkerThread(),
});
