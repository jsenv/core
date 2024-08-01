import { execute, nodeChildProcess, nodeWorkerThread } from "@jsenv/test";
import { snapshotFileExecutionSideEffects } from "@jsenv/test/tests/snapshot_execution_side_effects.js";

await snapshotFileExecutionSideEffects(import.meta.url, async ({ test }) => {
  const run = async ({ runtime }) => {
    await execute({
      rootDirectoryUrl: new URL("./client/", import.meta.url),
      fileRelativeUrl: `./main.js`,
      mirrorConsole: false,
      collectConsole: true,
      runtime,
    });
  };
  test("0_worker_thread", () =>
    run({
      runtime: nodeWorkerThread(),
    }));
  test("0_child_process", () =>
    run({
      runtime: nodeChildProcess(),
    }));
});
