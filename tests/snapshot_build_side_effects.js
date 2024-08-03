import { snapshotTests } from "@jsenv/snapshot";

export const snapshotBuildTests = async (
  testFileUrl,
  fnRegisteringTests,
  options = {},
) =>
  snapshotTests(testFileUrl, fnRegisteringTests, {
    filesystemActions: {
      "**": "compare",
      "**/.jsenv/": "undo",
      ...options.filesystemActions,
    },
    ...options,
  });
