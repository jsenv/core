import { takeFileSnapshot } from "../filesystem_snapshot.js";
import { createCaptureSideEffects } from "./create_capture_side_effects.js";
import { renderSideEffects } from "./render_side_effects.js";

export const snapshotSideEffects = (fn, sideEffectFileUrl, options) => {
  const captureSideEffects = createCaptureSideEffects({
    ...options,
    sideEffectFileUrl,
  });
  const sideEffectFileSnapshot = takeFileSnapshot(sideEffectFileUrl);
  const onSideEffects = (sideEffects) => {
    const sideEffectFileContent = renderSideEffects(sideEffects);
    sideEffectFileSnapshot.update(sideEffectFileContent, {
      mockFluctuatingValues: false,
    });
  };
  const returnValue = captureSideEffects(fn);
  if (returnValue && typeof returnValue.then === "function") {
    return returnValue.then((sideEffects) => {
      onSideEffects(sideEffects);
    });
  }
  onSideEffects(returnValue);
  return undefined;
};
