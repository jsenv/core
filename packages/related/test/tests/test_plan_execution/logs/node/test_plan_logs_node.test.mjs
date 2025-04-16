import { writeFileSync } from "@jsenv/filesystem";
import { ANSI, UNICODE } from "@jsenv/humanize";
import { startTerminalRecording } from "@jsenv/terminal-recorder";
// https://github.com/un-ts/eslint-plugin-import-x/issues/305
// eslint-disable-next-line import-x/no-extraneous-dependencies
import {
  executeTestPlan,
  nodeChildProcess,
  nodeWorkerThread,
  reportAsJunitXml,
  reporterList,
} from "@jsenv/test";
// https://github.com/un-ts/eslint-plugin-import-x/issues/305
// eslint-disable-next-line import-x/no-extraneous-dependencies
import { snapshotTestPlanSideEffects } from "@jsenv/test/tests/snapshot_execution_side_effects.js";

if (process.env.CI) {
  process.exit(0); // currently fails in CI with GroupMarkerNotSet(crbug.com/242999
}

if (process.platform === "win32") {
  // TODO: fix on windows
  process.exit(0);
}

const terminalAnimatedRecording =
  !process.env.CI &&
  !process.env.JSENV &&
  process.execArgv.some(
    (arg) =>
      arg.includes("--conditions=development") ||
      arg.includes("--conditions=dev:"),
  );
// force unicode and color support on windows
// to make snapshot predictible on windows (otherwise "✔" would be "√" for instance)
UNICODE.supported = true;
ANSI.supported = true;

const run = async ({ filename }) => {
  const testPlanResult = await executeTestPlan({
    logs: {
      type: null,
    },
    reporters: [
      reporterList({
        animated: false,
        mockFluctuatingValues: true,
        spy: async () => {
          const terminalSnapshotFileUrl = new URL(
            `./output/terminal.svg`,
            import.meta.url,
          );
          const terminalRecorder = await startTerminalRecording({ svg: true });
          return {
            write: (log) => {
              terminalRecorder.write(log);
            },
            end: async () => {
              const terminalRecords = await terminalRecorder.stop();
              const terminalSvg = await terminalRecords.svg();
              writeFileSync(terminalSnapshotFileUrl, terminalSvg);
            },
          };
        },
      }),
      ...(terminalAnimatedRecording
        ? [
            reporterList({
              animated: true,
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
                      new URL(`./output/${filename}.gif`, import.meta.url),
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
  });
  const junitXmlFileUrl = new URL(`./output/report.xml`, import.meta.url);
  await reportAsJunitXml(testPlanResult, junitXmlFileUrl);
};

await snapshotTestPlanSideEffects(import.meta.url, ({ test }) => {
  test("0_not_found", () =>
    run({
      filename: "not_found.js",
    }));
  test("1_console", () =>
    run({
      filename: "console.spec.js",
    }));
  test("2_empty", () =>
    run({
      filename: "empty.spec.js",
    }));
  test("3_error_in_source_function", () =>
    run({
      filename: "error_in_source_function.spec.js",
    }));
  test("4_error_in_test_function", () =>
    run({
      filename: "error_in_test_function.spec.js",
    }));
  test("5_error_in_test_jsenv_assert", () =>
    run({
      filename: "error_in_test_jsenv_assert.spec.js",
    }));
  test("6_error_in_test", () =>
    run({
      filename: "error_in_test.spec.js",
    }));
  test("8_error_in_timeout", () =>
    run({
      filename: "error_in_timeout.spec.js",
    }));
  test("9_unhandled_rejection_in_test", () =>
    run({
      filename: "unhandled_rejection_in_test.spec.js",
    }));
});
