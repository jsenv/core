import { snapshotTests } from "@jsenv/snapshot";

export const snapshotBuildTests = async (
  fn,
  sideEffectFileUrl,
  options = {},
) => {
  await snapshotTests(fn, sideEffectFileUrl, {
    ...options,
    filesystemEffects: {
      include: {
        "**/*": true,
        "**/.jsenv/": false,
      },
      ...options.filesystemEffects,
    },
  });
};
