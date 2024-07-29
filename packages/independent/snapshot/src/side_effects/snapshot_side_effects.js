import { takeFileSnapshot } from "../filesystem_snapshot.js";
import { createReplaceFilesystemWellKnownValues } from "../filesystem_well_known_values.js";
import { captureSideEffects } from "./capture_side_effects.js";
import { filesystemSideEffects } from "./filesystem/filesystem_side_effects.js";
import { logSideEffects } from "./log/log_side_effects.js";
import { renderSideEffects } from "./render_side_effects.js";

export const snapshotSideEffects = (
  fn,
  sideEffectFileUrl,
  { logEffects = true, filesystemEffects = true, rootDirectoryUrl } = {},
) => {
  const replaceFilesystemWellKnownValues =
    createReplaceFilesystemWellKnownValues({ rootDirectoryUrl });
  const sideEffectDetectors = [
    ...(logEffects
      ? [logSideEffects(logEffects === true ? {} : logEffects)]
      : []),
    ...(filesystemEffects
      ? [
          filesystemSideEffects(
            filesystemEffects === true ? {} : filesystemEffects,
            {
              replaceFilesystemWellKnownValues,
              sideEffectFileUrl,
            },
          ),
        ]
      : []),
  ];
  const sideEffectFileSnapshot = takeFileSnapshot(sideEffectFileUrl);
  const onSideEffects = (sideEffects) => {
    const sideEffectFileContent = renderSideEffects(sideEffects, {
      rootDirectoryUrl,
      replaceFilesystemWellKnownValues,
    });
    sideEffectFileSnapshot.update(sideEffectFileContent, {
      mockFluctuatingValues: false,
    });
  };
  const returnValue = captureSideEffects(fn, {
    sideEffectDetectors,
  });
  if (returnValue && typeof returnValue.then === "function") {
    return returnValue.then((sideEffects) => {
      onSideEffects(sideEffects);
    });
  }
  onSideEffects(returnValue);
  return undefined;
};
