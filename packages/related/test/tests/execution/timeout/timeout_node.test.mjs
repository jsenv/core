import { assert } from "@jsenv/assert";

import { execute, nodeChildProcess, nodeWorkerThread } from "@jsenv/test";

const test = async (params) => {
  const startMs = Date.now();
  const result = await execute({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./node_client/", import.meta.url),
    fileRelativeUrl: `./main.js`,
    mirrorConsole: false,
    collectConsole: true,
    allocatedMs: 2_000,
    ...params,
  });
  const endMs = Date.now();
  const duration = endMs - startMs;
  const actual = {
    status: result.status,
    duration,
  };
  const expect = {
    status: "timedout",
    duration: assert.between(2_000, 5_000),
  };
  assert({ actual, expect });
};

await test({
  runtime: nodeChildProcess(),
});
await test({
  runtime: nodeWorkerThread(),
});
