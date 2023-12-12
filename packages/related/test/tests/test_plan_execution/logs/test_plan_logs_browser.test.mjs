import { takeFileSnapshot } from "@jsenv/snapshot";
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
const test = async (name, params) => {
  const logFileUrl = new URL(`./snapshots/${name}`, import.meta.url);
  const logFileSnapshot = takeFileSnapshot(logFileUrl);
  await executeTestPlan({
    logs: {
      level: "warn",
      dynamic: false,
      mockFluctuatingValues: true,
      fileUrl: logFileUrl,
    },
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    githubCheck: false,
    webServer: {
      origin: devServer.origin,
    },
    ...params,
  });
  logFileSnapshot.compare();
};

await test("browser_chromium.txt", {
  testPlan: {
    "./a.spec.html": {
      chrome: {
        runtime: chromium(),
      },
    },
  },
});
await test("browser_console.txt", {
  testPlan: {
    "./console.spec.html": {
      chromium: {
        runtime: chromium(),
      },
    },
  },
});
await test("browser_many.txt", {
  testPlan: {
    "./a.spec.html": {
      chromium: {
        runtime: chromium(),
      },
      firefox: {
        runtime: firefox(),
      },
    },
  },
});
