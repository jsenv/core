import { snapshotTests } from "@jsenv/snapshot";

export const snapshotFileExecutionSideEffects = async (
  testFileUrl,
  fnRegisteringTests,
  options = {},
) =>
  snapshotTests(testFileUrl, fnRegisteringTests, {
    filesystemActions: {
      "**": "compare",
      "**/.jsenv/": "undo",
    },
    ...options,
  });

export const snapshotTestPlanSideEffects = async (
  testFileUrl,
  fnRegisteringTests,
  options = {},
) =>
  snapshotTests(testFileUrl, fnRegisteringTests, {
    filesystemActions: {
      "**": "compare",
      "**/.jsenv/": "undo",
      "**/*.png": process.env.CI ? "compare_presence_only" : "compare",
      "**/*.gif": process.env.CI ? "ignore" : "compare",
      "**/.coverage/": "ignore",
    },
    ...options,
  });
