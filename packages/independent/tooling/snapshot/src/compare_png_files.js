// https://github.com/image-size/image-size/blob/main/lib/types/png.ts

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

export const comparePngFiles = (actualData, expectData) => {
  const { width, height } = getPngDimensions(actualData);
  const actualPng = PNG.sync.read(actualData);
  const expectPng = PNG.sync.read(expectData);
  const numberOfPixels = width * height;
  const numberOfPixelsConsideredAsDiff = pixelmatch(
    actualPng.data,
    expectPng.data,
    null,
    width,
    height,
    {
      threshold: 0.1,
    },
  );
  const diffRatio = numberOfPixelsConsideredAsDiff / numberOfPixels;
  const diffPercentage = diffRatio * 100;
  return diffPercentage <= 1;
};

const getPngDimensions = (buffer) => {
  if (toUTF8String(buffer, 12, 16) === pngFriedChunkName) {
    return {
      height: readUInt32BE(buffer, 36),
      width: readUInt32BE(buffer, 32),
    };
  }
  return {
    height: readUInt32BE(buffer, 20),
    width: readUInt32BE(buffer, 16),
  };
};

const pngFriedChunkName = "CgBI";

const decoder = new TextDecoder();
const toUTF8String = (input, start = 0, end = input.length) =>
  decoder.decode(input.slice(start, end));

const readUInt32BE = (input, offset = 0) =>
  input[offset] * 2 ** 24 +
  input[offset + 1] * 2 ** 16 +
  input[offset + 2] * 2 ** 8 +
  input[offset + 3];
