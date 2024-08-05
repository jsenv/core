import { startDevServer } from "@jsenv/core";
import { writeFileSync } from "@jsenv/filesystem";
import { ANSI, UNICODE } from "@jsenv/humanize";
import { startTerminalRecording } from "@jsenv/terminal-recorder";
import {
  chromium,
  executeTestPlan,
  firefox,
  reportAsJunitXml,
  reporterList,
  webkit,
} from "@jsenv/test";
import { snapshotTestPlanSideEffects } from "@jsenv/test/tests/snapshot_execution_side_effects.js";

if (process.platform === "win32") {
  // to fix once got a windows OS to reproduce
  process.exit(0);
}

const terminalAnimatedRecording =
  process.execArgv.includes("--conditions=development") &&
  !process.env.CI &&
  !process.env.JSENV;
// force unicode and color support on windows
// to make snapshot predictible on windows (otherwise "✔" would be "√" for instance)
UNICODE.supported = true;
ANSI.supported = true;

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
});

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
          const terminalRecorder = await startTerminalRecording({
            svg: true,
          });
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
                  columns: 120,
                  rows: 30,
                  gif: {
                    repeat: true,
                    msAddedAtTheEnd: 3_500,
                  },
                });
                return {
                  write: async (log) => {
                    await terminalRecorder.write(log);
                  },
                  end: async () => {
                    const terminalRecords = await terminalRecorder.stop();
                    const terminalGif = await terminalRecords.gif();
                    writeFileSync(
                      new URL(`./output/terminal.gif`, import.meta.url),
                      terminalGif,
                    );
                  },
                };
              },
            }),
          ]
        : []),
    ],
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    testPlan: {
      [filename]: {
        chromium: {
          runtime: chromium(),
        },
        firefox: {
          runtime: firefox({
            disableOnWindowsBecauseFlaky: false,
          }),
        },
        webkit: {
          runtime: webkit(),
        },
      },
    },
    githubCheck: false,
    webServer: {
      origin: devServer.origin,
    },
  });
  const junitXmlFileUrl = new URL(`./output/report.xml`, import.meta.url);
  await reportAsJunitXml(testPlanResult, junitXmlFileUrl);
};

await snapshotTestPlanSideEffects(import.meta.url, ({ test }) => {
  test("0_console", () =>
    run({
      filename: "console.spec.html",
    }));
  test("1_empty", () =>
    run({
      filename: "empty.spec.html",
    }));
  test("2_error_in_script", () =>
    run({
      filename: "error_in_script.spec.html",
    }));
  test("3_error_in_script_module", () =>
    run({
      filename: "error_in_script_module.spec.html",
    }));
  test("4_error_in_js_module", () =>
    run({
      filename: "error_in_js_module.spec.html",
    }));
  test("5_error_in_js_classic", () =>
    run({
      filename: "error_in_js_classic.spec.html",
    }));
  test("6_error_jsenv_assert_in_script_module", () =>
    run({
      filename: "error_jsenv_assert_in_script_module.spec.html",
    }));
});
