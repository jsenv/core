import { takeDirectorySnapshot } from "@jsenv/snapshot";
import { startDevServer } from "@jsenv/core";

import { executeTestPlan, chromium, firefox } from "@jsenv/test";

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
const snapshotDirectoryUrl = new URL("./snapshots/browser/", import.meta.url);
const test = async ({ name, ...params }) => {
  const logFileUrl = new URL(
    `./snapshots/browser/jsenv_tests_output_${name}.txt`,
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
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  testPlan: {
    "./main.html": {
      chrome: {
        runtime: chromium(),
        collectConsole: true,
      },
    },
  },
  webServer: {
    origin: devServer.origin,
  },
});
await test({
  name: "many",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  testPlan: {
    "./b.html": {
      chromium: {
        runtime: chromium(),
        collectConsole: true,
      },
      firefox: {
        runtime: firefox(),
      },
    },
  },
  webServer: {
    origin: devServer.origin,
  },
});
directorySnapshot.compare();
