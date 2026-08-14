/*
 * Compare two PNG buffers visually: a screenshot re-generated on a different
 * machine (or just a different run) is never byte-identical because of
 * antialiasing, subpixel rounding and compression, so a byte comparison is
 * useless as a regression signal.
 *
 * Two images that cannot be compared (different dimensions, unreadable data)
 * are reported as different, never as an error: "the image changed" is a
 * normal outcome, not a failure of the comparison itself.
 */

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

/**
 * @param {Buffer} actualData
 * @param {Buffer} expectData
 * @param {Object} [options]
 * @param {number} [options.threshold] pixelmatch per pixel color sensitivity, from 0 (strict) to 1 (permissive)
 * @param {number} [options.maxDiffRatio] ratio of differing pixels still considered as "same", from 0 to 1
 * @param {boolean} [options.includeAA] count antialiased pixels as differences
 * @param {boolean} [options.createDiff] generate a PNG highlighting the differing pixels
 * @returns {{ same: boolean, reason: "size"|"pixels"|"unreadable"|undefined, width: number, height: number, diffPixelCount: number, diffRatio: number, diffFileContent: Buffer|undefined }}
 */
export const comparePngFilesDetailed = (
  actualData,
  expectData,
  { threshold = 0.1, maxDiffRatio = 0.01, includeAA = false, createDiff } = {},
) => {
  let actualPng;
  let expectPng;
  try {
    actualPng = PNG.sync.read(actualData);
    expectPng = PNG.sync.read(expectData);
  } catch {
    return createResult({ same: false, reason: "unreadable" });
  }
  const { width, height } = actualPng;
  if (width !== expectPng.width || height !== expectPng.height) {
    return createResult({
      same: false,
      reason: "size",
      width,
      height,
    });
  }
  const pixelCount = width * height;
  // pngjs decodes some PNG (16 bits, exotic palettes) into something else than
  // the RGBA buffer pixelmatch expects; there is nothing to compare then
  if (
    actualPng.data.length !== pixelCount * 4 ||
    expectPng.data.length !== pixelCount * 4
  ) {
    return createResult({
      same: false,
      reason: "unreadable",
      width,
      height,
    });
  }
  const diffPng = createDiff ? new PNG({ width, height }) : null;
  const diffPixelCount = pixelmatch(
    actualPng.data,
    expectPng.data,
    diffPng ? diffPng.data : null,
    width,
    height,
    { threshold, includeAA },
  );
  const diffRatio = diffPixelCount / pixelCount;
  const same = diffRatio <= maxDiffRatio;
  return createResult({
    same,
    reason: same ? undefined : "pixels",
    width,
    height,
    diffPixelCount,
    diffRatio,
    diffFileContent: diffPng ? PNG.sync.write(diffPng) : undefined,
  });
};

export const comparePngFiles = (actualData, expectData, options) =>
  comparePngFilesDetailed(actualData, expectData, options).same;

const createResult = ({
  same,
  reason,
  width = 0,
  height = 0,
  diffPixelCount = 0,
  diffRatio = same ? 0 : 1,
  diffFileContent,
}) => ({
  same,
  reason,
  width,
  height,
  diffPixelCount,
  diffRatio,
  diffFileContent,
});
