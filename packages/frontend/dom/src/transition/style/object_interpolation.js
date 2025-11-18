export const createObjectInterpolation = (interpolation, from, to) => {
  if (interpolation === to) {
    if (from === to) {
      return null;
    }
    return to;
  }
  const propertyInterpolatorMap = new Map();
  for (const key of Object.keys(interpolation)) {
    const value = interpolation[key];
    if (value === to[key]) {
      continue;
    }
    const propertyInterpolator = (transition) => {
      const interpolatedValue = value(transition);
      return interpolatedValue;
    };
    propertyInterpolatorMap.set(key, propertyInterpolator);
  }
  if (propertyInterpolatorMap.size === 0) {
    return to;
  }
  const interpolateProperties = (transition) => {
    const toAssignMap = new Map();
    for (const [key, interpolate] of propertyInterpolatorMap) {
      const interpolatedValue = interpolate(transition);
      toAssignMap.set(key, interpolatedValue);
    }
    if (toAssignMap.size === 0) {
      return to;
    }
    const copy = { ...to };
    for (const [key, value] of toAssignMap) {
      if (value === undefined) {
        delete copy[key];
      } else {
        copy[key] = value;
      }
    }
    return copy;
  };
  return interpolateProperties;
};
