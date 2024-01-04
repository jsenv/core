import { writeFileSync } from "@jsenv/filesystem";
import {
  renderTerminalSvg,
  startTerminalVideoRecording,
} from "@jsenv/terminal-snapshot";
import { takeFileSnapshot } from "@jsenv/snapshot";

import { UNICODE, ANSI } from "@jsenv/log";

import {
  executeTestPlan,
  nodeWorkerThread,
  nodeChildProcess,
  reporterList,
} from "@jsenv/test";

const isDev = process.execArgv.includes("--conditions=development");

// force unicode and color support on windows
// to make snapshot predictible on windows (otherwise "✔" would be "√" for instance)
UNICODE.supported = true;
ANSI.supported = true;

const test = async (filename, params) => {
  await executeTestPlan({
    listReporter: false,
    fileReporter: false,
    reporters: [
      reporterList({
        dynamic: false,
        mockFluctuatingValues: true,
        spy: () => {
          const terminalSnapshotFileUrl = new URL(
            `./snapshots/node/${filename}.svg`,
            import.meta.url,
          );
          const terminalFileSnapshot = takeFileSnapshot(
            terminalSnapshotFileUrl,
          );
          let stdout = "";
          return {
            write: (log) => {
              stdout += log;
            },
            end: async () => {
              const svg = await renderTerminalSvg(stdout);
              writeFileSync(terminalSnapshotFileUrl, svg);
              terminalFileSnapshot.compare();
            },
          };
        },
      }),
      ...(isDev
        ? [
            reporterList({
              dynamic: true,
              spy: async () => {
                const terminalVideoRecorder = await startTerminalVideoRecording(
                  {
                    rows: 30,
                  },
                );
                return {
                  write: (log) => {
                    terminalVideoRecorder.write(log);
                  },
                  end: async () => {
                    const terminalVideo = await terminalVideoRecorder.stop();
                    const terminalVideoMp4 = await terminalVideo.mp4();
                    writeFileSync(
                      new URL(
                        `./snapshots/node/${filename}.mp4`,
                        import.meta.url,
                      ),
                      terminalVideoMp4,
                    );
                  },
                };
              },
            }),
          ]
        : []),
    ],
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
};

await test("console.spec.js");
await test("empty.spec.js");
await test("error_in_source_function.spec.js");
await test("error_in_test_function.spec.js");
await test("error_in_test_jsenv_assert.spec.js");
await test("error_in_test.spec.js");
await test("error_in_timeout.spec.js");
await test("unhandled_rejection_in_test.spec.js");
