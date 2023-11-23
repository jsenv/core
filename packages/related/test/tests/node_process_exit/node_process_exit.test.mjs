import { assert } from "@jsenv/assert";
import { execute, nodeChildProcess, nodeWorkerThread } from "@jsenv/test";

const test = async (params) => {
  const { status } = await execute({
    // logLevel: "debug"
    rootDirectoryUrl: new URL("./", import.meta.url),
    fileRelativeUrl: `./node_process_exit.js`,
    // keepRunning: true,
    mirrorConsole: false,
    collectConsole: true,
    ignoreError: true,
    ...params,
  });
  const actual = status;
  const expected = "completed";
  assert({ actual, expected });
};

await test({
  runtime: nodeChildProcess(),
});
await test({
  runtime: nodeWorkerThread(),
});
