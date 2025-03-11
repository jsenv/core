import { assert } from "@jsenv/assert";
import { execute, nodeChildProcess, nodeWorkerThread } from "@jsenv/test";

const run = async ({ runtime }) => {
  const startMs = Date.now();
  const { status } = await execute({
    rootDirectoryUrl: new URL("./node_client/", import.meta.url),
    fileRelativeUrl: `./main.js`,
    mirrorConsole: false,
    allocatedMs: 2_000,
    runtime,
  });
  const endMs = Date.now();
  const duration = endMs - startMs;
  return { status, duration };
};

const actual = {
  nodeWorkerThread: await run({
    runtime: nodeWorkerThread(),
  }),
  nodeChildProcess: await run({
    runtime: nodeChildProcess(),
  }),
};
const expect = {
  nodeWorkerThread: {
    status: "timedout",
    duration: assert.between(2_000, 5_000),
  },
  nodeChildProcess: {
    status: "timedout",
    duration: assert.between(2_000, 5_000),
  },
};
assert({ actual, expect });
