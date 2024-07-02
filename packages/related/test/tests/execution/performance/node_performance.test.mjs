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
  const expect = {
    namespace: { answer: 42 },
    performance: {
      nodeTiming: assert.any(Object),
      timeOrigin: assert.any(Number),
      eventLoopUtilization: assert.any(Object),
      measures: {
        "a to b": assert.any(Number),
      },
    },
  };
  assert({ actual, expect });
};

await test({
  runtime: nodeChildProcess(),
});
await test({
  runtime: nodeWorkerThread(),
});
