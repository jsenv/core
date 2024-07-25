import { snapshotFunctionSideEffects } from "@jsenv/snapshot";
import { urlToBasename } from "@jsenv/urls";

export const snapshotBuildSideEffects = async (
  fn,
  fnFileUrl,
  sideEffectFileRelativeUrl,
  options = {},
) => {
  const sideEffectFileUrl = new URL(sideEffectFileRelativeUrl, fnFileUrl);
  const sideEffectBasename = urlToBasename(sideEffectFileUrl);
  await snapshotFunctionSideEffects(fn, fnFileUrl, sideEffectFileRelativeUrl, {
    filesystemEffects: {
      include: {
        "**/*": true,
        "**/.jsenv/": false,
      },
      outDirectory: sideEffectBasename,
      ...options.filesystemEffects,
    },
    ...options,
  });
};
