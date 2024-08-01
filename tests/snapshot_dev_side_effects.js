import { snapshotTests } from "@jsenv/snapshot";

export const snapshotDevSideEffects = async (
  testFileUrl,
  fnRegisteringTests,
  options = {},
) =>
  snapshotTests(testFileUrl, fnRegisteringTests, {
    ...options,
    logEffects:
      options.logEffects === false
        ? false
        : {
            group: true,
            ...(options.logEffects === true ? {} : options.logEffects),
          },
    filesystemEffects:
      options.filesystemEffects === false
        ? false
        : {
            textualFilesIntoDirectory: true,
            include: {
              "**/*": true,
              "**/.jsenv/**/@fs/**": false,
              "**/.jsenv/**/*.html@*": false,
            },
            ...(options.filesystemEffects === true
              ? {}
              : options.filesystemEffects),
          },
  });
