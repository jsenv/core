import { execute, nodeChildProcess, nodeWorkerThread } from "@jsenv/test";
import { snapshotFileExecutionSideEffects } from "@jsenv/test/tests/snapshot_execution_side_effects.js";

await snapshotFileExecutionSideEffects(import.meta.url, async ({ test }) => {
  const run = async ({ runtime }) => {
    const { performance } = await execute({
      rootDirectoryUrl: new URL("./node_client/", import.meta.url),
      fileRelativeUrl: `./main.js`,
      collectPerformance: true,
      keepRunning: true, // node will naturally exit
      runtime,
    });
    return { performance };
  };
  test("0_worker_thread", () =>
    run({
      runtime: nodeWorkerThread(),
    }));
  test("1_child_process", () =>
    run({
      runtime: nodeChildProcess(),
    }));
});
