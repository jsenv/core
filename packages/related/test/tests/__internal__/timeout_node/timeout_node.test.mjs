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
  const durationIsAroundAllocatedMs = duration > 3_000 && duration < 10_000;
  const actual = {
    status: result.status,
    durationIsAroundAllocatedMs,
  };
  const expected = {
    status: "timedout",
    durationIsAroundAllocatedMs: true,
  };
  assert({ actual, expected });
};

await test({
  runtime: nodeChildProcess(),
  allocatedMs: 5_000,
});
await test({
  runtime: nodeWorkerThread(),
  allocatedMs: 5_000,
});