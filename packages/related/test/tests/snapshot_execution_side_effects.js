import { snapshotTests } from "@jsenv/snapshot";

export const snapshotFileExecutionSideEffects = async (
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
              "**/.jsenv/": false,
            },
            ...(options.filesystemEffects === true
              ? {}
              : options.filesystemEffects),
          },
  });

export const snapshotTestPlanSideEffects = async (
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
              "**/*.png": process.env.CI ? "presence_only" : true,
              "**/.jsenv/": false,
              "**/.coverage/": false,
            },
            ...(options.filesystemEffects === true
              ? {}
              : options.filesystemEffects),
          },
  });
