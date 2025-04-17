import { PLAYBACK } from "oto/src/playback/playback.js";
import { animateColor } from "../color/animate_color.js";
import { EASING } from "../utils/easing.js";
import { WELL_KNOWN_COLORS } from "../utils/well_known_colors.js";

export const glow = (
  canvas,
  {
    fromColor = "black",
    toColor = "white",
    duration = 300,
    iterations = 2,
    x = 0,
    y = 0,
    width = canvas.width,
    height = canvas.height,
    easing = EASING.EASE_OUT_EXPO,
  } = {},
) => {
  if (typeof fromColor === "string") fromColor = WELL_KNOWN_COLORS[fromColor];
  if (typeof toColor === "string") toColor = WELL_KNOWN_COLORS[toColor];
  const [rFrom, gFrom, bFrom] = fromColor;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = context.getImageData(x, y, width, height);
  const allColors = imageData.data;
  const pixelIndexes = [];
  for (let i = 0, n = allColors.length; i < n; i += 4) {
    const rCandidate = allColors[i];
    const gCandidate = allColors[i + 1];
    const bCandidate = allColors[i + 2];
    if (rCandidate === rFrom && gCandidate === gFrom && bCandidate === bFrom) {
      pixelIndexes.push(i);
    }
  }

  let currentColor = fromColor;
  const glowStepDuration = duration / (iterations * 2);
  const animateColorTo = (toColor) => {
    const colorAnimation = animateColor(currentColor, toColor, {
      effect: ([r, g, b]) => {
        for (const pixelIndex of pixelIndexes) {
          allColors[pixelIndex] = r;
          allColors[pixelIndex + 1] = g;
          allColors[pixelIndex + 2] = b;
        }
        // context.clearRect(0, 0, width, height);
        context.putImageData(imageData, 0, 0);
        currentColor = [r, g, b];
      },
      duration: glowStepDuration,
      easing,
    });
    return colorAnimation;
  };

  const animationExecutors = [];
  let i = 0;
  while (i < iterations) {
    i++;
    animationExecutors.push(() => {
      return animateColorTo(toColor);
    });
    animationExecutors.push(() => {
      return animateColorTo(fromColor);
    });
  }
  const glowAnimation = PLAYBACK.sequence(animationExecutors);
  return glowAnimation;
};
