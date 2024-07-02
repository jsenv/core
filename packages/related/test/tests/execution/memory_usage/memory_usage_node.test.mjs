import { assert } from "@jsenv/assert";

import { execute, nodeChildProcess, nodeWorkerThread } from "@jsenv/test";

const test = async (params) => {
  const { memoryUsage } = await execute({
    // logLevel: "debug",
    rootDirectoryUrl: new URL("./node_client/", import.meta.url),
    fileRelativeUrl: `./main.js`,
    measureMemoryUsage: true,
    ...params,
  });
  const actual = memoryUsage;
  const expect = assert.between(5_000_000, 9_000_000); // around 7MB
  assert({ actual, expect });
};

await test({
  runtime: nodeChildProcess(),
});
await test({
  runtime: nodeWorkerThread(),
});
