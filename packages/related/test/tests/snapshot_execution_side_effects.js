import { snapshotTests } from "@jsenv/snapshot";

export const snapshotFileExecutionSideEffects = async (
  testFileUrl,
  fnRegisteringTests,
  options = {},
) =>
  snapshotTests(testFileUrl, fnRegisteringTests, {
    ...options,
    filesystemActions: {
      "**": "compare",
      "**/.jsenv/": "undo",
    },
    executionEffects: {
      catch: false,
      ...options.executionEffects,
    },
  });

export const snapshotTestPlanSideEffects = async (
  testFileUrl,
  fnRegisteringTests,
  options = {},
) =>
  snapshotTests(testFileUrl, fnRegisteringTests, {
    ...options,
    filesystemActions: {
      "**": "compare",
      "**/.jsenv/": "undo",
      "**/*.png": process.env.CI ? "compare_presence_only" : "compare",
      "**/*.gif": "ignore",
      "**/.coverage/": "ignore",
    },
    executionEffects: {
      catch: false,
      ...options.executionEffects,
    },
  });
