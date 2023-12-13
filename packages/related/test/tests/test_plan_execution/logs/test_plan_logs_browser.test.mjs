import { takeFileSnapshot } from "@jsenv/snapshot";
import { startDevServer } from "@jsenv/core";

import { executeTestPlan, chromium, firefox, webkit } from "@jsenv/test";

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
const test = async (filename, params) => {
  const logFileUrl = new URL(
    `./snapshots/browser/${filename}.txt`,
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
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    testPlan: {
      [filename]: {
        chromium: {
          runtime: chromium(),
        },
        // firefox: {
        //   runtime: firefox(),
        // },
        // webkit: {
        //   runtime: webkit(),
        // },
      },
    },
    githubCheck: false,
    webServer: {
      origin: devServer.origin,
    },
    ...params,
  });
  logFileSnapshot.compare();
};

// await test("console.spec.html");
// await test("empty.spec.html");
await test("error_in_script.spec.html");
