import { snapshotFunctionSideEffects } from "@jsenv/snapshot";
import { urlToBasename } from "@jsenv/urls";

export const snapshotBuildSideEffects = async (
  fn,
  sideEffectFileUrl,
  options = {},
) => {
  const sideEffectBasename = urlToBasename(sideEffectFileUrl);
  await snapshotFunctionSideEffects(fn, sideEffectFileUrl, {
    ...options,
    filesystemEffects: {
      include: {
        "**/*": true,
        "**/.jsenv/": false,
      },
      outDirectory: sideEffectBasename,
      ...options.filesystemEffects,
    },
  });
};
