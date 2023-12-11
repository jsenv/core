import { takeDirectorySnapshot } from "@jsenv/snapshot";

import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";

// disable on windows because unicode symbols like
// "✔" are "√" because unicode is supported returns false
if (process.platform === "win32") {
  process.exit(0);
}

const snapshotDirectoryUrl = new URL("./snapshots/node/", import.meta.url);
const test = async ({ name, ...params }) => {
  const logFileUrl = new URL(
    `./snapshots/node/jsenv_tests_output_${name}.txt`,
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
  rootDirectoryUrl: new URL("./node_client/", import.meta.url),
  testPlan: {
    "./a.js": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
  },
});
await test({
  name: "many",
  rootDirectoryUrl: new URL("./node_client/", import.meta.url),
  testPlan: {
    "./a.js": {
      node: {
        runtime: nodeWorkerThread(),
      },
      node2: {
        runtime: nodeWorkerThread({
          env: {
            foo: "foo",
          },
        }),
      },
    },
  },
});
await test({
  name: "console",
  rootDirectoryUrl: new URL("./node_client/", import.meta.url),
  testPlan: {
    "./console.js": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
  },
});
await test({
  name: "error",
  rootDirectoryUrl: new URL("./node_client/", import.meta.url),
  testPlan: {
    "./error.js": {
      node: {
        runtime: nodeWorkerThread(),
        allocatedMs: Infinity,
      },
    },
  },
});
directorySnapshot.compare();
