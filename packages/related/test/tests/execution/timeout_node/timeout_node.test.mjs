import { assert } from "@jsenv/assert";

import { execute, nodeChildProcess, nodeWorkerThread } from "@jsenv/test";

const test = async (params) => {
  const startMs = Date.now();
  const result = await execute({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./", import.meta.url),
    fileRelativeUrl: `./main.js`,
    mirrorConsole: false,
    collectConsole: true,
    ...params,
  });
  const endMs = Date.now();
  const duration = endMs - startMs;
  const actual = {
    status: result.status,
    duration,
  };
  const expected = {
    status: "timedout",
    duration: assert.between(2_000, 5_000),
  };
  assert({ actual, expected });
};

await test({
  runtime: nodeChildProcess(),
  allocatedMs: 2_000,
});
await test({
  runtime: nodeWorkerThread(),
  allocatedMs: 2_000,
});
