import { assert } from "@jsenv/assert";

import { execute, nodeChildProcess, nodeWorkerThread } from "@jsenv/test";

const test = async (params) => {
  const { namespace, performance } = await execute({
    // logLevel: "debug",
    rootDirectoryUrl: new URL("./node_client/", import.meta.url),
    fileRelativeUrl: `./main.js`,
    mirrorConsole: false,
    collectPerformance: true,
    keepRunning: true, // node will naturally exit
    ...params,
  });
  const actual = {
    namespace,
    performance,
  };
  const expected = {
    namespace: { answer: 42 },
    performance: {
      nodeTiming: assert.any(Number),
      timeOrigin: assert.any(Number),
      eventLoopUtilization: assert.any(Number),
      measures: {
        "a to b": assert.any(Number),
      },
    },
  };
  assert({ actual, expected });
};

await test({
  runtime: nodeChildProcess(),
});
await test({
  runtime: nodeWorkerThread(),
});
