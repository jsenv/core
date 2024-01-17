import { writeFileSync } from "@jsenv/filesystem";
import { startTerminalRecording } from "@jsenv/terminal-recorder";
import { takeFileSnapshot } from "@jsenv/snapshot";
import { UNICODE, ANSI } from "@jsenv/humanize";
import { startDevServer } from "@jsenv/core";

import {
  executeTestPlan,
  nodeWorkerThread,
  nodeChildProcess,
  chromium,
  firefox,
  webkit,
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

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
});
const test = async (filename, params) => {
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
            `./snapshots/mixed/${filename}.svg`,
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
    rootDirectoryUrl: new URL("./", import.meta.url),
    webServer: {
      origin: devServer.origin,
    },
    githubCheck: false,
    ...params,
  });
  const junitXmlFileUrl = new URL(
    `./snapshots/mixed/${filename}.xml`,
    import.meta.url,
  );
  const junitXmlFileSnapshot = takeFileSnapshot(junitXmlFileUrl);
  await reportAsJunitXml(testPlanResult, junitXmlFileUrl, {
    mockFluctuatingValues: true,
  });
  junitXmlFileSnapshot.compare();
};

await test("empty.txt", {
  testPlan: {
    "./node_client/empty.spec.js": {
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
});
