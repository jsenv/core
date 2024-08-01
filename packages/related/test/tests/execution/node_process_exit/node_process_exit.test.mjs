import { execute, nodeChildProcess, nodeWorkerThread } from "@jsenv/test";
import { snapshotFileExecutionSideEffects } from "@jsenv/test/tests/snapshot_execution_side_effects.js";

await snapshotFileExecutionSideEffects(import.meta.url, async ({ test }) => {
  const run = async ({ runtime }) => {
    const { status } = await execute({
      rootDirectoryUrl: new URL("./", import.meta.url),
      fileRelativeUrl: `./node_process_exit.js`,
      runtime,
    });
    return { status };
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
