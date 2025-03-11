import { execute, nodeChildProcess, nodeWorkerThread } from "@jsenv/test";
import { snapshotFileExecutionSideEffects } from "@jsenv/test/tests/snapshot_execution_side_effects.js";
import { fileURLToPath } from "node:url";

await snapshotFileExecutionSideEffects(import.meta.url, async ({ test }) => {
  const run = async ({ runtime }) => {
    const { namespace } = await execute({
      rootDirectoryUrl: new URL("./node_client/", import.meta.url),
      fileRelativeUrl: `./main.js`,
      allocatedMs: Infinity,
      mirrorConsole: true,
      collectConsole: true,
      runtime,
    });
    return { namespace };
  };
  test("0_worker_thread", () =>
    run({
      runtime: nodeWorkerThread(),
    }));
  test("1_worker_thread_require", () =>
    run({
      runtime: nodeWorkerThread({
        commandLineOptions: [
          // worker thread needs absolute path, see https://github.com/nodejs/node/issues/41673
          `--require=${fileURLToPath(new URL("./required.cjs", import.meta.url))}`,
        ],
      }),
    }));
  test("2_child_process", () =>
    run({
      runtime: nodeChildProcess(),
    }));
  test("3_child_process_require", () =>
    run({
      runtime: nodeChildProcess({
        commandLineOptions: [
          `--require=${fileURLToPath(new URL("./required.cjs", import.meta.url))}`,
        ],
      }),
    }));
});
