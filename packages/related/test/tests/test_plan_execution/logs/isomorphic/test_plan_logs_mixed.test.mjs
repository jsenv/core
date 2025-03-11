import { startDevServer } from "@jsenv/core";
import { writeFileSync } from "@jsenv/filesystem";
import { ANSI, UNICODE } from "@jsenv/humanize";
import { takeFileSnapshot } from "@jsenv/snapshot";
import { startTerminalRecording } from "@jsenv/terminal-recorder";
import {
  chromium,
  executeTestPlan,
  firefox,
  nodeChildProcess,
  nodeWorkerThread,
  reportAsJunitXml,
  reporterList,
  webkit,
} from "@jsenv/test";
import { snapshotTestPlanSideEffects } from "@jsenv/test/tests/snapshot_execution_side_effects.js";

process.exit(0); // currently fails in CI with GroupMarkerNotSet(crbug.com/242999

if (process.platform === "win32") {
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
const run = async ({ testPlan }) => {
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
    rootDirectoryUrl: new URL("./", import.meta.url),
    webServer: {
      origin: devServer.origin,
    },
    githubCheck: false,
    testPlan,
  });
  const junitXmlFileUrl = new URL(`./output/report.xml`, import.meta.url);
  await reportAsJunitXml(testPlanResult, junitXmlFileUrl);
};

await snapshotTestPlanSideEffects(import.meta.url, ({ test }) => {
  test("0_empty", () =>
    run({
      testPlan: {
        "./client/empty.spec.js": {
          node: {
            runtime: nodeWorkerThread(),
          },
          node_2: {
            runtime: nodeChildProcess(),
          },
        },
        "./client/empty.spec.html": {
          chrome: {
            runtime: chromium(),
          },
          firefox: {
            runtime: firefox(),
          },
          webkit: {
            runtime: webkit(),
          },
        },
      },
    }));
});
