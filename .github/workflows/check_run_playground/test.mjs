import { executeTestPlan, nodeChildProcess } from "@jsenv/test";

await executeTestPlan({
  rootDirectoryUrl: new URL("../../../", import.meta.url),
  testPlan: {
    "./.github/workflows/check_run_playground/**/*.test.mjs": {
      node: {
        runtime: nodeChildProcess(),
      },
    },
  },
  githubCheckLogLevel: "debug",
  updateProcessExitCode: false,
});
