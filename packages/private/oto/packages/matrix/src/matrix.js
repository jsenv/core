// https://github.com/leeoniya/transformation-matrix-js/blob/3595d2b36aa1b0f593bdffdb786b9e832c50c3b0/src/matrix.js#L45

export const fromTransformations = ({ flip, translate, rotate, scale }) => {
  let _a = 1;
  let _b = 0;
  let _c = 0;
  let _d = 1;
  let _e = 0;
  let _f = 0;
  const transform = (a, b, c, d, e, f) => {
    _a = _a * a + _c * b;
    _b = _b * a + _d * b;
    _c = _a * c + _c * d;
    _d = _b * c + _d * d;
    _e = _a * e + _c * f + _e;
    _f = _b * e + _d * f + _f;
  };

  if (flip) {
    const { x, y } = flip;
    if (x) {
      transform(-1, 0, 0, 1, 0, 0);
    }
    if (y) {
      transform(1, 0, 0, -1, 0, 0);
    }
  }
  if (translate) {
    const { x, y } = translate;
    if (x !== undefined) {
      transform(1, 0, 0, 1, x, 0);
    }
    if (y !== undefined) {
      transform(1, 0, 0, 1, 0, y);
    }
  }
  if (rotate) {
    const angle = rotate * 0.017453292519943295;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    transform(cos, sin, -sin, cos, 0, 0);
  }
  if (scale) {
    if (typeof scale === "object") {
      const { x, y } = scale;
      if (x !== undefined) {
        transform(x, 0, 0, 1, 0, 0);
      }
      if (y !== undefined) {
        transform(1, 0, 0, y, 0, 0);
      }
    } else {
      transform(scale, 0, 0, scale, 0, 0);
    }
  }

  return [_a, _b, _c, _d, _e, _f];
};
