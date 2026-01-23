import { snapshotTests } from "@jsenv/snapshot";

export const snapshotBuildTests = async (
  testFileUrl,
  fnRegisteringTests,
  options = {},
) =>
  snapshotTests(testFileUrl, fnRegisteringTests, {
    ...options,
    filesystemActions: {
      "**": "compare",
      "**/.jsenv/": "undo",
      "**/.jsenv_b/": "undo",
      ...options.filesystemActions,
    },
    logEffects:
      options.logEffects === false
        ? false
        : {
            prevent: true,
            level: "warn",
            ...(options.logEffects === true ? {} : options.logEffects),
          },
    executionEffects: {
      catch: false,
      ...options.executionEffects,
    },
  });
