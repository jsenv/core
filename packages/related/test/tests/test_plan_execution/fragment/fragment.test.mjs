import { writeFileSync } from "@jsenv/filesystem";
import { ANSI, UNICODE } from "@jsenv/humanize";
import { takeFileSnapshot } from "@jsenv/snapshot";
import { startTerminalRecording } from "@jsenv/terminal-recorder";
import {
  executeTestPlan,
  nodeWorkerThread,
  reportAsJson,
  reportAsJunitXml,
  reporterList,
} from "@jsenv/test";
import { snapshotTestPlanSideEffects } from "@jsenv/test/tests/snapshot_execution_side_effects.js";

if (process.env.CI) {
  process.exit(0); // currently fails in CI with GroupMarkerNotSet(crbug.com/242999
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

const run = async ({ fragment }) => {
  const filename = fragment.replace("/", "_");
  const terminalSnapshotFileUrl = import.meta.resolve(
    `./output/${filename}.svg`,
  );
  const jsonFileUrl = import.meta.resolve(`./output/${filename}.json`);
  const junitXmlFileUrl = import.meta.resolve(`./output/${filename}.xml`);
  const gifFileUrl = import.meta.resolve(`./output/${filename}.gif`);
  const testPlanResult = await executeTestPlan({
    logs: {
      type: null,
    },
    reporters: [
      reporterList({
        animated: false,
        mockFluctuatingValues: true,
        spy: async () => {
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
                    writeFileSync(gifFileUrl, terminalGif);
                  },
                };
              },
            }),
          ]
        : []),
    ],
    rootDirectoryUrl: import.meta.resolve("./node_client/"),
    testPlan: {
      "**/*.spec.js": {
        group_name: {
          runtime: nodeWorkerThread(),
        },
      },
    },
    githubCheck: false,
    fragment,
  });
  reportAsJson(testPlanResult, jsonFileUrl);
  await reportAsJunitXml(testPlanResult, junitXmlFileUrl);
  return testPlanResult;
};

await snapshotTestPlanSideEffects(import.meta.url, ({ test }) => {
  test("1/3", () => run({ fragment: "1/3" }));
  test("2/3", () => run({ fragment: "2/3" }));
  test("3/3", () => run({ fragment: "3/3" }));
});
