import { animateRatio } from "../ratio/animate_ratio.js";
import { PLAYBACK } from "/playback/playback.js";

export const erase = (
  canvas,
  {
    duration = 300,
    x = 0,
    y = 0,
    width = canvas.width,
    height = canvas.height,
    iterations = 4,
  } = {},
) => {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = context.getImageData(x, y, width, height);
  const allColors = imageData.data;
  const nonTransparentPixelSet = new Set();
  let pixelX = 0;
  let pixelY = 0;
  for (let i = 0, n = allColors.length; i < n; i += 4) {
    const alpha = allColors[i + 3];
    if (alpha !== 0) {
      nonTransparentPixelSet.add({
        index: i,
        x: pixelX,
        y: pixelY,
      });
      pixelX++;
      if (pixelX === width) {
        pixelX = 0;
        pixelY++;
      }
    }
  }

  const executors = [];
  let i = 0;
  const eraseStepDuration = duration / iterations;
  while (i < iterations) {
    let stepIndex = i;
    executors.push(() => {
      return animateRatio({
        type: "erase_step",
        effect: () => {},
        onstart: () => {
          for (const nonTransparentPixel of nonTransparentPixelSet) {
            const everyNthPixel = iterations - stepIndex;
            if (nonTransparentPixel.x % everyNthPixel === 0) {
              allColors[nonTransparentPixel.index + 3] = 0;
              nonTransparentPixelSet.delete(nonTransparentPixel);
            }
          }
          // erase some pixels
          context.putImageData(imageData, 0, 0);
        },
        duration: eraseStepDuration,
      });
    });
    i++;
  }
  return PLAYBACK.sequence(executors);
};
