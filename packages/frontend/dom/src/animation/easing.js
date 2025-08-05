export const EASING = {
  LINEAR: (x) => x,
  EASE: (x) => {
    return cubicBezier(x, 0.25, 0.1, 0.25, 1.0);
  },
  EASE_IN: (x) => {
    return cubicBezier(x, 0.42, 0, 1.0, 1.0);
  },
  EASE_OUT: (x) => {
    return cubicBezier(x, 0, 0, 0.58, 1.0);
  },
  EASE_IN_OUT: (x) => {
    return cubicBezier(x, 0.42, 0, 0.58, 1.0);
  },
  EASE_IN_OUT_CUBIC: (x) => {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  },
  EASE_IN_EXPO: (x) => {
    return x === 0 ? 0 : Math.pow(2, 10 * x - 10);
  },
  EASE_OUT_EXPO: (x) => {
    return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
  },
  EASE_OUT_ELASTIC: (x) => {
    const c4 = (2 * Math.PI) / 3;
    if (x === 0) {
      return 0;
    }
    if (x === 1) {
      return 1;
    }
    return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
  },
  EASE_OUT_CUBIC: (x) => {
    return 1 - Math.pow(1 - x, 3);
  },
};

export const easingDefault = (x) => cubicBezier(x, 0.1, 0.4, 0.6, 1.0);

export const cubicBezier = (t, initial, p1, p2, final) => {
  return (
    (1 - t) * (1 - t) * (1 - t) * initial +
    3 * (1 - t) * (1 - t) * t * p1 +
    3 * (1 - t) * t * t * p2 +
    t * t * t * final
  );
};
