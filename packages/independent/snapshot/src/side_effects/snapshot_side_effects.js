import { urlToBasename, urlToFilename } from "@jsenv/urls";
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
    sideEffectFilePattern = "./side_effects/[filename].md",
    outFilePattern = "./side_effects/[filename]/[out_filename]",
    errorStackHidden,
    ...captureOptions
  } = {},
) => {
  const sourceName = urlToBasename(sourceFileUrl, true);
  const sourceBasename = urlToBasename(sourceFileUrl);
  const sourceFilename = urlToFilename(sourceFileUrl);
  if (sideEffectFileUrl === undefined) {
    const sideEffectFileRelativeUrl = sideEffectFilePattern
      .replaceAll("[name]", sourceName)
      .replaceAll("[basename]", sourceBasename)
      .replaceAll("[filename]", sourceFilename);
    sideEffectFileUrl = new URL(sideEffectFileRelativeUrl, sourceFileUrl);
  } else {
    sideEffectFileUrl = new URL(sideEffectFileUrl, sourceFileUrl);
  }

  const captureSideEffects = createCaptureSideEffects(captureOptions);
  const generateOutFileUrl = (filename) => {
    const outRelativeUrl = outFilePattern
      .replaceAll("[name]", sourceName)
      .replaceAll("[basename]", sourceBasename)
      .replaceAll("[filename]", sourceFilename)
      .replaceAll("[out_filename]", filename);
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
