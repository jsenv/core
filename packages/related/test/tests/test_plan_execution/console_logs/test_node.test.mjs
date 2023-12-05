import { takeFileSnapshot } from "@jsenv/snapshot";

import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";

const logFileUrl = new URL(
  "./snapshots/jsenv_tests_output.txt",
  import.meta.url,
);
const logFileSnapshot = takeFileSnapshot(logFileUrl);
await executeTestPlan({
  logLevel: "warn",
  logFileUrl,
  rootDirectoryUrl: new URL("./node_client/", import.meta.url),
  testPlan: {
    "./main.js": {
      node: {
        runtime: nodeWorkerThread(),
        collectConsole: true,
      },
    },
  },
  githubCheckEnabled: false,
});
logFileSnapshot.compare();
