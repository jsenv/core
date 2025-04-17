export const applyRatioToDiff = (from, to, ratio) => {
  if (ratio === 0) {
    return from;
  }
  if (ratio === 1) {
    return to;
  }
  return from + (to - from) * ratio;
};
