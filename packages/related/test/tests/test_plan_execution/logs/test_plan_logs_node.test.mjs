import { writeFileSync } from "@jsenv/filesystem";
import { startTerminalRecording } from "@jsenv/terminal-recorder";
import { takeFileSnapshot } from "@jsenv/snapshot";

import { UNICODE, ANSI } from "@jsenv/log";

import {
  executeTestPlan,
  nodeWorkerThread,
  nodeChildProcess,
  reporterList,
  reportAsJunitXml,
} from "@jsenv/test";

const terminalAnimatedRecording =
  process.execArgv.includes("--conditions=development") &&
  !process.env.CI &&
  !process.env.JSENV;
// force unicode and color support on windows
// to make snapshot predictible on windows (otherwise "✔" would be "√" for instance)
UNICODE.supported = true;
ANSI.supported = true;

const test = async (filename, params) => {
  if (terminalAnimatedRecording) {
    console.log(`snapshoting ${filename}`);
  }
  const testPlanResult = await executeTestPlan({
    logs: {
      type: null,
    },
    reporters: [
      reporterList({
        dynamic: false,
        mockFluctuatingValues: true,
        spy: async () => {
          const terminalSnapshotFileUrl = new URL(
            `./snapshots/node/${filename}.svg`,
            import.meta.url,
          );
          const terminalRecorder = await startTerminalRecording({
            // logs: true,
            svg: true,
          });
          const terminalFileSnapshot = takeFileSnapshot(
            terminalSnapshotFileUrl,
          );
          return {
            write: (log) => {
              terminalRecorder.write(log);
            },
            end: async () => {
              const terminalRecords = await terminalRecorder.stop();
              const terminalSvg = await terminalRecords.svg();
              writeFileSync(terminalSnapshotFileUrl, terminalSvg);
              terminalFileSnapshot.compare();
            },
          };
        },
      }),
      ...(terminalAnimatedRecording
        ? [
            reporterList({
              dynamic: true,
              spy: async () => {
                const terminalRecorder = await startTerminalRecording({
                  // logs: true,
                  columns: 120,
                  rows: 30,
                  gif: {
                    repeat: true,
                    msAddedAtTheEnd: 3_500,
                  },
                  // debug: true,
                });
                return {
                  write: async (log) => {
                    await terminalRecorder.write(log);
                  },
                  end: async () => {
                    const terminalRecords = await terminalRecorder.stop();
                    const terminalGif = await terminalRecords.gif();
                    writeFileSync(
                      new URL(
                        `./snapshots/node/${filename}.gif`,
                        import.meta.url,
                      ),
                      terminalGif,
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
  const junitXmlFileUrl = new URL(
    `./snapshots/node/${filename}.xml`,
    import.meta.url,
  );
  const junitXmlFileSnapshot = takeFileSnapshot(junitXmlFileUrl);
  await reportAsJunitXml(testPlanResult, junitXmlFileUrl, {
    mockFluctuatingValues: true,
  });
  junitXmlFileSnapshot.compare();
};

await test("console.spec.js");
await test("empty.spec.js");
await test("error_in_source_function.spec.js");
await test("error_in_test_function.spec.js");
await test("error_in_test_jsenv_assert.spec.js");
await test("error_in_test.spec.js");
await test("error_in_timeout.spec.js");
await test("unhandled_rejection_in_test.spec.js");
