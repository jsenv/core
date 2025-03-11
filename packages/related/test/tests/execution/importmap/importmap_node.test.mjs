import { execute, nodeChildProcess, nodeWorkerThread } from "@jsenv/test";
import { snapshotFileExecutionSideEffects } from "@jsenv/test/tests/snapshot_execution_side_effects.js";
import { fileURLToPath } from "node:url";

await snapshotFileExecutionSideEffects(import.meta.url, async ({ test }) => {
  const run = async ({ runtime }) => {
    const result = await execute({
      rootDirectoryUrl: new URL("./node_client/", import.meta.url),
      fileRelativeUrl: `./main.js`,
      allocatedMs: Infinity,
      runtime,
    });
    return result;
  };

  test("0_child_process", () =>
    run({
      runtime: nodeChildProcess({
        commandLineOptions: [
          `--require=${fileURLToPath(new URL("./required.cjs", import.meta.url))}`,
        ],
      }),
    }));
  test("1_child_process_importmap", () =>
    run({
      runtime: nodeChildProcess({
        commandLineOptions: [
          `--require=${fileURLToPath(new URL("./required.cjs", import.meta.url))}`,
        ],
        importmap: {
          imports: {
            "./answer.js": "./answer_2.js",
          },
        },
      }),
    }));
  test("2_worker_thread", () =>
    run({
      runtime: nodeWorkerThread({
        commandLineOptions: [
          `--require=${fileURLToPath(new URL("./required.cjs", import.meta.url))}`,
        ],
      }),
    }));
  test("3_worker_thread_importmap", () =>
    run({
      runtime: nodeWorkerThread({
        commandLineOptions: [
          `--require=${fileURLToPath(new URL("./required.cjs", import.meta.url))}`,
        ],
        importmap: {
          imports: {
            "./answer.js": "./answer_2.js",
          },
        },
      }),
    }));
});
