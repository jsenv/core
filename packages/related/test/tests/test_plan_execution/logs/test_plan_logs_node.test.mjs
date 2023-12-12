import { takeFileSnapshot } from "@jsenv/snapshot";

import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";

// disable on windows because unicode symbols like
// "✔" are "√" because unicode is supported returns false
if (process.platform === "win32") {
  process.exit(0);
}

const test = async ({ name, ...params }) => {
  const logFileUrl = new URL(
    `./snapshots/node/jsenv_tests_output_${name}.txt`,
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

await test({
  name: "one",
  rootDirectoryUrl: new URL("./node_client/", import.meta.url),
  testPlan: {
    "./a.spec.js": {
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
    "./a.spec.js": {
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
    "./console.spec.js": {
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
    "./error.spec.js": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
  },
});
