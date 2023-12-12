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
    rootDirectoryUrl: new URL("./node_client/", import.meta.url),
    githubCheck: false,
    ...params,
  });
  logFileSnapshot.compare();
};

await test("node_one.txt", {
  testPlan: {
    "./a.spec.js": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
  },
});
await test("node_console.txt", {
  testPlan: {
    "./console.spec.js": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
  },
});
await test("node_error_in_test.txt", {
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
await test("node_error_in_test_indirect.txt", {
  testPlan: {
    "./error_in_test_indirect.spec.js": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
  },
});
await test("node_error_in_source.txt", {
  testPlan: {
    "./error_in_source.spec.js": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
  },
});
await test("node_error_in_timeout.txt", {
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
await test("node_unhandled_rejection_in_test.txt", {
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
await test("node_error_jsenv_assert.txt", {
  testPlan: {
    "./error_jsenv_assert.spec.js": {
      node: {
        runtime: nodeWorkerThread(),
      },
    },
  },
});
await test("node_many.txt", {
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
