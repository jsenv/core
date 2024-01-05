import { writeFileSync } from "@jsenv/filesystem";
import {
  renderTerminalSvg,
  startTerminalVideoRecording,
} from "@jsenv/terminal-snapshot";
import { takeFileSnapshot } from "@jsenv/snapshot";
import { UNICODE, ANSI } from "@jsenv/log";
import { startDevServer } from "@jsenv/core";

import {
  executeTestPlan,
  nodeWorkerThread,
  nodeChildProcess,
  chromium,
  firefox,
  webkit,
  reporterList,
} from "@jsenv/test";

const terminalVideoRecording =
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
  await executeTestPlan({
    listReporter: false,
    reporters: [
      reporterList({
        dynamic: false,
        mockFluctuatingValues: true,
        spy: () => {
          const terminalSnapshotFileUrl = new URL(
            `./snapshots/mixed/${filename}.svg`,
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
      ...(terminalVideoRecording
        ? [
            reporterList({
              dynamic: true,
              spy: async () => {
                const terminalVideoRecorder = await startTerminalVideoRecording(
                  {
                    columns: 120,
                    rows: 30,
                  },
                );
                return {
                  write: async (log) => {
                    await terminalVideoRecorder.write(log);
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
    rootDirectoryUrl: new URL("./", import.meta.url),
    webServer: {
      origin: devServer.origin,
    },
    githubCheck: false,
    ...params,
  });
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
