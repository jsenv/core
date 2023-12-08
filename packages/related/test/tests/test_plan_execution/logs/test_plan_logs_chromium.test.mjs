import { takeFileSnapshot } from "@jsenv/snapshot";
import { startDevServer } from "@jsenv/core";

import { executeTestPlan, chromium } from "@jsenv/test";

// disable on windows because unicode symbols like
// "✔" are "√" because unicode is supported returns false
if (process.platform === "win32") {
  process.exit(0);
}

const test = async ({ name, ...params }) => {
  const logFileUrl = new URL(
    `./snapshots/jsenv_tests_output_${name}.txt`,
    import.meta.url,
  );
  const logFileSnapshot = takeFileSnapshot(logFileUrl);
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
  logFileSnapshot.compare();
};

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
});
await test({
  name: "chromium",
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
