import { takeFileSnapshot } from "@jsenv/snapshot";

import {
  executeTestPlan,
  nodeWorkerThread,
  nodeChildProcess,
} from "@jsenv/test";

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
  name: "error_in_test",
  rootDirectoryUrl: new URL("./node_client/", import.meta.url),
  testPlan: {
    "./error_in_test.spec.js": {
      node: {
        runtime: nodeWorkerThread(),
      },
      node_2: {
        runtime: nodeChildProcess(),
      },
    },
  },
});
await test({
  name: "error_in_test_indirect",
  rootDirectoryUrl: new URL("./node_client/", import.meta.url),
  testPlan: {
    "./error_in_test_indirect.spec.js": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
  },
});
await test({
  name: "error_in_source",
  rootDirectoryUrl: new URL("./node_client/", import.meta.url),
  testPlan: {
    "./error_in_source.spec.js": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
  },
});
await test({
  name: "error_in_timeout",
  rootDirectoryUrl: new URL("./node_client/", import.meta.url),
  testPlan: {
    "./error_in_timeout.spec.js": {
      node: {
        runtime: nodeWorkerThread(),
      },
      node_2: {
        runtime: nodeChildProcess(),
      },
    },
  },
});
await test({
  name: "unhandled_rejection_in_test",
  rootDirectoryUrl: new URL("./node_client/", import.meta.url),
  testPlan: {
    "./unhandled_rejection_in_test.spec.js": {
      node: {
        runtime: nodeWorkerThread(),
      },
      node_2: {
        runtime: nodeChildProcess(),
      },
    },
  },
});
await test({
  name: "error_jsenv_assert",
  rootDirectoryUrl: new URL("./node_client/", import.meta.url),
  testPlan: {
    "./error_jsenv_assert.spec.js": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
  },
});
