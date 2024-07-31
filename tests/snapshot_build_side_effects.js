import { snapshotTests } from "@jsenv/snapshot";

export const snapshotBuildTests = async (
  testFileUrl,
  fnRegisteringTests,
  options = {},
) => {
  await snapshotTests(testFileUrl, fnRegisteringTests, {
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
};
