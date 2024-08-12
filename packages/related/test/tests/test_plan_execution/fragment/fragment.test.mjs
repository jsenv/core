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

const terminalAnimatedRecording =
  process.execArgv.includes("--conditions=development") &&
  !process.env.CI &&
  !process.env.JSENV;
// force unicode and color support on windows
// to make snapshot predictible on windows (otherwise "✔" would be "√" for instance)
UNICODE.supported = true;
ANSI.supported = true;

const run = async ({ fragment }) => {
  const filename = fragment.replace("/", "_");
  const terminalSnapshotFileUrl = new URL(
    `./output/${filename}.svg`,
    import.meta.url,
  );
  const jsonFileUrl = new URL(`./output/${filename}.json`, import.meta.url);
  const junitXmlFileUrl = new URL(`./output/${filename}.xml`, import.meta.url);
  const gifFileUrl = new URL(`./output/${filename}.gif`, import.meta.url);
  if (terminalAnimatedRecording) {
    console.log(`snapshoting ${filename}`);
  }
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
    rootDirectoryUrl: new URL("./node_client/", import.meta.url),
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
