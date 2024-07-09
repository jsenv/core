import { executeTestPlan, nodeWorkerThread } from "@jsenv/test";

const test = async ({ fragment }) => {
  const testPlanResult = await executeTestPlan({
    logs: {},
    rootDirectoryUrl: new URL("./node_client/", import.meta.url),
    testPlan: {
      "**/*.spec.js": {
        worker_thread: {
          runtime: nodeWorkerThread(),
        },
      },
    },
    githubCheck: false,
    fragment,
  });

  return testPlanResult;
};

await test({ fragment: "1/3" });
await test({ fragment: "2/3" });
await test({ fragment: "3/3" });
