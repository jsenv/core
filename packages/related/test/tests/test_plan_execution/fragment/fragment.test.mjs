import { writeFileSync } from "@jsenv/filesystem";
import { startTerminalRecording } from "@jsenv/terminal-recorder";
import { takeDirectorySnapshot, takeFileSnapshot } from "@jsenv/snapshot";
import { UNICODE, ANSI } from "@jsenv/humanize";

import {
  executeTestPlan,
  nodeWorkerThread,
  reporterList,
  reportAsJunitXml,
  reportAsJson,
} from "@jsenv/test";

const terminalAnimatedRecording =
  process.execArgv.includes("--conditions=development") &&
  !process.env.CI &&
  !process.env.JSENV;
// force unicode and color support on windows
// to make snapshot predictible on windows (otherwise "✔" would be "√" for instance)
UNICODE.supported = true;
ANSI.supported = true;

const snapshotDirectoryUrl = new URL("./snapshots/", import.meta.url);

const results = [];
const test = async ({ fragment }) => {
  const filename = fragment.replace("/", "_");
  const terminalSnapshotFileUrl = new URL(
    `./snapshots/${filename}.svg`,
    import.meta.url,
  );
  const jsonFileUrl = new URL(`./snapshots/${filename}.json`, import.meta.url);
  const junitXmlFileUrl = new URL(
    `./snapshots/${filename}.xml`,
    import.meta.url,
  );
  const gifFileUrl = new URL(
    `./recording/node/${filename}.gif`,
    import.meta.url,
  );

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
  results.push(testPlanResult);
  reportAsJson(testPlanResult, jsonFileUrl, {
    mockFluctuatingValues: true,
  });
  await reportAsJunitXml(testPlanResult, junitXmlFileUrl, {
    mockFluctuatingValues: true,
  });
  return testPlanResult;
};

const directorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
await test({ fragment: "1/3" });
await test({ fragment: "2/3" });
await test({ fragment: "3/3" });
directorySnapshot.compare();
