import { getCallerLocation, snapshotTests } from "@jsenv/snapshot";

export const snapshotBuildTests = async (
  fn,
  sideEffectFileUrl,
  options = {},
) => {
  await snapshotTests(fn, sideEffectFileUrl, {
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
            include: {
              "**/*": true,
              "**/.jsenv/": false,
            },
            ...(options.filesystemEffects === true
              ? {}
              : options.filesystemEffects),
          },
    sourceFileUrl: getCallerLocation(2).url,
  });
};
