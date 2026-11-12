/**
 * CSS durations and easing curves, for a movement played from JS that has to look
 * like one played by CSS: a row scrolled frame by frame next to a track animated by
 * the browser, a view transition walked back from where its curve has it.
 */

// A CSS duration read as a number of milliseconds.
export const durationToMs = (duration) => {
  const number = parseFloat(duration);
  if (Number.isNaN(number)) {
    return 0;
  }
  return String(duration).trimEnd().endsWith("ms") ? number : number * 1000;
};

export const CSS_EASE = [0.25, 0.1, 0.25, 1];
export const CSS_EASE_OUT = [0, 0, 0.58, 1];

// A cubic-bezier curve, evaluated: time in, distance out. Solved numerically
// because the curve is parametric — two cubics sharing a parameter, with no closed
// form for one against the other. Twenty halvings put the answer well under a pixel
// of a screen-wide movement.
export const easedProgress = (x, [x1, y1, x2, y2]) => {
  let low = 0;
  let high = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    if (bezierAxis(mid, x1, x2) < x) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return bezierAxis((low + high) / 2, y1, y2);
};

const bezierAxis = (s, a, b) =>
  3 * (1 - s) * (1 - s) * s * a + 3 * (1 - s) * s * s * b + s * s * s;
