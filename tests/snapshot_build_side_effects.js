import { snapshotTests } from "@jsenv/snapshot";

export const snapshotBuildTests = async (
  testFileUrl,
  fnRegisteringTests,
  options = {},
) =>
  snapshotTests(testFileUrl, fnRegisteringTests, {
    ...options,
    filesystemEffects:
      options.filesystemEffects === false
        ? false
        : {
            textualFilesIntoDirectory: true,
            include: {
              "**": true,
              "**/.jsenv/": false,
            },
            ...(options.filesystemEffects === true
              ? {}
              : options.filesystemEffects),
          },
  });
