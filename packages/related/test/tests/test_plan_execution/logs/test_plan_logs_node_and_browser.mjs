import { takeDirectorySnapshot } from "@jsenv/snapshot";
import { startDevServer } from "@jsenv/core";

import {
  executeTestPlan,
  nodeWorkerThread,
  nodeChildProcess,
  chromium,
  firefox,
  webkit,
} from "@jsenv/test";

// disable on windows because unicode symbols like
// "✔" are "√" because unicode is supported returns false
if (process.platform === "win32") {
  process.exit(0);
}

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
});
const snapshotDirectoryUrl = new URL("./snapshots/node/", import.meta.url);
const test = async ({ name, ...params }) => {
  const logFileUrl = new URL(
    `./snapshots/node_and_browser/jsenv_tests_output_${name}.txt`,
    import.meta.url,
  );
  await executeTestPlan({
    logs: {
      level: "warn",
      dynamic: false,
      mockFluctuatingValues: true,
      fileUrl: logFileUrl,
    },
    githubCheck: false,
    ...params,
  });
};

const directorySnapshot = takeDirectorySnapshot(snapshotDirectoryUrl);
await test({
  name: "one",
  rootDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./node_client/a.js": {
      node: {
        runtime: nodeWorkerThread(),
      },
      node_2: {
        runtime: nodeChildProcess(),
      },
    },
    "./client/a.html": {
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
  webServer: {
    origin: devServer.origin,
  },
});
directorySnapshot.compare();
