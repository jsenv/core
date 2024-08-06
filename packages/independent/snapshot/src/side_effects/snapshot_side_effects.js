import { writeFileSync } from "@jsenv/filesystem";
import { urlToBasename, urlToFilename } from "@jsenv/urls";
import { takeDirectorySnapshot } from "../filesystem_snapshot.js";
import { createCaptureSideEffects } from "./create_capture_side_effects.js";
import { renderSideEffects } from "./render_side_effects.js";
/**
 * Generate a markdown file describing code side effects. When executed in CI throw if there is a diff.
 * @param {URL} sourceFileUrl
 *        Url where the function is located (import.meta.url)
 * @param {Function} fn
 *        Function to snapshot
 * @param {Object} snapshotSideEffectsOptions
 * @param {string|url} snapshotSideEffectsOptions.outFilePattern
 * @param {string|url} snapshotSideEffectsOptions.sideEffectMdFileUrl
 *        Where to write the markdown file. Defaults to ./[]
 * @param {string|url} snapshotSideEffectsOptions.rootDirectoryUrl
 * @param {Object|boolean} [snapshotSideEffectsOptions.filesystemEffects]
 * @param {boolean} [snapshotSideEffectsOptions.filesystemEffects.textualFilesInline=false]
 *        Put textual files content in the markdown (instead of separate files).
 *        Big files will still be put in dedicated files.
 * @param {boolean} [snapshotSideEffectsOptions.filesystemEffects.preserve=false]
 *        Preserve filesystem side effect when function ends. By default
 *        filesystem effects are undone when function ends
 * @param {url} [snapshotSideEffectsOptions.filesystemEffects.baseDirectory]
 *        Urls of filesystem side effects will be relative to this base directory
 *        Default to the directory containing @sourceFileUrl
 * @return {Array.<Object>} sideEffects
 */
export const snapshotSideEffects = (
  sourceFileUrl,
  fn,
  {
    sideEffectMdFileUrl,
    outFilePattern = "_[source_filename]/[filename]",
    errorTransform,
    throwWhenDiff,
    ...captureOptions
  } = {},
) => {
  const sourceName = urlToBasename(sourceFileUrl, true);
  const sourceBasename = urlToBasename(sourceFileUrl);
  const sourceFilename = urlToFilename(sourceFileUrl);
  const generateOutFileUrl = (filename) => {
    const outRelativeUrl = outFilePattern
      .replaceAll("[source_name]", sourceName)
      .replaceAll("[source_basename]", sourceBasename)
      .replaceAll("[source_filename]", sourceFilename)
      .replaceAll("[filename]", filename);
    const outFileUrl = new URL(outRelativeUrl, new URL("./", sourceFileUrl))
      .href;
    return outFileUrl;
  };
  const outDirectoryUrl = generateOutFileUrl("");
  sideEffectMdFileUrl =
    sideEffectMdFileUrl || generateOutFileUrl(`${sourceFilename}.md`);
  const captureSideEffects = createCaptureSideEffects({
    ...captureOptions,
    sourceFileUrl,
  });
  const outDirectorySnapshot = takeDirectorySnapshot(outDirectoryUrl);
  const onSideEffects = (sideEffects) => {
    const sideEffectFileContent = renderSideEffects(sideEffects, {
      title: urlToFilename(sourceFileUrl),
      sideEffectMdFileUrl,
      generateOutFileUrl,
      errorTransform,
    });
    writeFileSync(sideEffectMdFileUrl, sideEffectFileContent);
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
