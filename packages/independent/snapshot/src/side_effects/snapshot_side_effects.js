import { urlToBasename } from "@jsenv/urls";
import {
  takeDirectorySnapshot,
  takeFileSnapshot,
} from "../filesystem_snapshot.js";
import { createCaptureSideEffects } from "./create_capture_side_effects.js";
import { renderSideEffects } from "./render_side_effects.js";

export const snapshotSideEffects = (
  sourceFileUrl,
  fn,
  {
    sideEffectFileUrl,
    sideEffectFilePattern = "./side_effects/[basename].md",
    outFilePattern = "./side_effects/[basename]/[filename]",
    errorStackHidden,
    ...captureOptions
  } = {},
) => {
  const name = urlToBasename(sourceFileUrl, true);
  const basename = urlToBasename(sourceFileUrl);
  if (sideEffectFileUrl === undefined) {
    const sideEffectFileRelativeUrl = sideEffectFilePattern
      .replaceAll("[name]", name)
      .replaceAll("[basename]", basename);
    sideEffectFileUrl = new URL(sideEffectFileRelativeUrl, sourceFileUrl);
  } else {
    sideEffectFileUrl = new URL(sideEffectFileUrl, sourceFileUrl);
  }

  const captureSideEffects = createCaptureSideEffects(captureOptions);
  const generateOutFileUrl = (filename) => {
    const outRelativeUrl = outFilePattern
      .replaceAll("[name]", name)
      .replaceAll("[basename]", basename)
      .replaceAll("[filename]", filename);
    const outFileUrl = new URL(outRelativeUrl, new URL("./", sourceFileUrl))
      .href;
    return outFileUrl;
  };
  const outDirectoryUrl = generateOutFileUrl("");
  const sideEffectFileSnapshot = takeFileSnapshot(sideEffectFileUrl);
  const outDirectorySnapshot = takeDirectorySnapshot(outDirectoryUrl);
  const onSideEffects = (sideEffects) => {
    const sideEffectFileContent = renderSideEffects(sideEffects, {
      sideEffectFileUrl,
      generateOutFileUrl,
      errorStackHidden,
    });
    sideEffectFileSnapshot.update(sideEffectFileContent, {
      mockFluctuatingValues: false,
    });
    outDirectorySnapshot.compare();
  };
  const returnValue = captureSideEffects(fn);
  if (returnValue && typeof returnValue.then === "function") {
    return returnValue.then((sideEffects) => {
      onSideEffects(sideEffects);
      return sideEffects;
    });
  }
  onSideEffects(returnValue);
  return returnValue;
};
