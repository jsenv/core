import { writeFileSync } from "@jsenv/filesystem";
import { renderTerminalSvg } from "@jsenv/terminal-snapshot";
import { takeFileSnapshot } from "@jsenv/snapshot";
import { UNICODE, ANSI } from "@jsenv/log";

import {
  executeTestPlan,
  nodeWorkerThread,
  nodeChildProcess,
} from "@jsenv/test";

// force unicode and color support on windows
// to make snapshot predictible on windows (otherwise "✔" would be "√" for instance)
UNICODE.supported = true;
ANSI.supported = true;

const test = async (filename, params) => {
  const terminalSnapshotFileUrl = new URL(
    `./snapshots/node/${filename}.svg`,
    import.meta.url,
  );
  const terminalFileSnapshot = takeFileSnapshot(terminalSnapshotFileUrl);
  {
    let stdout = "";
    const { write } = process.stdout;
    process.stdout.write = (...args) => {
      stdout += args;
    };
    await executeTestPlan({
      logs: {
        dynamic: false,
        mockFluctuatingValues: true,
      },
      rootDirectoryUrl: new URL("./node_client/", import.meta.url),
      testPlan: {
        [filename]: {
          worker_thread: {
            runtime: nodeWorkerThread(),
          },
          child_process:
            // console output order in not predictible on child_process
            filename === "console.spec.js"
              ? null
              : {
                  runtime: nodeChildProcess(),
                },
        },
      },
      githubCheck: false,
      ...params,
    });
    process.stdout.write = write;
    writeFileSync(terminalSnapshotFileUrl, await renderTerminalSvg(stdout));
  }
  terminalFileSnapshot.compare();
};

await test("console.spec.js");
await test("empty.spec.js");
await test("error_in_source_function.spec.js");
await test("error_in_test_function.spec.js");
await test("error_in_test_jsenv_assert.spec.js");
await test("error_in_test.spec.js");
await test("error_in_timeout.spec.js");
await test("unhandled_rejection_in_test.spec.js");
