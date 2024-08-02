import { snapshotTests } from "@jsenv/snapshot";

export const snapshotDevSideEffects = async (
  testFileUrl,
  fnRegisteringTests,
  options = {},
) =>
  snapshotTests(testFileUrl, fnRegisteringTests, {
    filesystemActions: {
      "**": "compare",
      "**/.jsenv/**/@fs/**": "ignore",
      "**/.jsenv/**/*.html@*": "ignore",
    },
    ...options,
  });
