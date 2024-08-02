import { snapshotTests } from "@jsenv/snapshot";

export const snapshotFileExecutionSideEffects = async (
  testFileUrl,
  fnRegisteringTests,
  options = {},
) =>
  snapshotTests(testFileUrl, fnRegisteringTests, {
    filesystemActions: {
      "**": "compare",
      "**/.jsenv/": "ignore",
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
      "**/*.png": process.env.CI ? "compare_presence_only" : "compare",
      "**/.jsenv/": "ignore",
      "**/.coverage/": "ignore",
    },
    ...options,
  });
