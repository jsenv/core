import { writeFileSync } from "@jsenv/filesystem";
import { urlToBasename, urlToFilename } from "@jsenv/urls";
import { takeDirectorySnapshot } from "../filesystem_snapshot.js";
import { createCaptureSideEffects } from "./create_capture_side_effects.js";
import { renderSideEffects } from "./render_side_effects.js";

export const snapshotSideEffects = (
  sourceFileUrl,
  fn,
  {
    outFilePattern = "[filename]/[out_filename]",
    errorStackHidden,
    throwWhenDiff,
    ...captureOptions
  } = {},
) => {
  const sourceName = urlToBasename(sourceFileUrl, true);
  const sourceBasename = urlToBasename(sourceFileUrl);
  const sourceFilename = urlToFilename(sourceFileUrl);
  const generateOutFileUrl = (outfilename) => {
    const outRelativeUrl = outFilePattern
      .replaceAll("[name]", sourceName)
      .replaceAll("[basename]", sourceBasename)
      .replaceAll("[filename]", sourceFilename)
      .replaceAll("[out_filename]", outfilename);
    const outFileUrl = new URL(outRelativeUrl, new URL("./", sourceFileUrl))
      .href;
    return outFileUrl;
  };
  const outDirectoryUrl = generateOutFileUrl("");
  const sideEffectMdFileUrl = generateOutFileUrl(`${sourceFilename}.md`);
  const captureSideEffects = createCaptureSideEffects(captureOptions);
  const outDirectorySnapshot = takeDirectorySnapshot(outDirectoryUrl);
  const onSideEffects = (sideEffects) => {
    const sideEffectFileContent = renderSideEffects(sideEffects, {
      sideEffectMdFileUrl,
      generateOutFileUrl,
      errorStackHidden,
    });
    writeFileSync(sideEffectFileContent, sideEffectFileContent);
    outDirectorySnapshot.compare(throwWhenDiff);
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
