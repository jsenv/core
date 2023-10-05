import { executeTestPlan, nodeChildProcess } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./**/*.test.mjs": {
      node: {
        runtime: nodeChildProcess(),
      },
    },
  },
});
