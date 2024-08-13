export const jsenvIsPerformanceImpactBig = ({
  metricValueBeforeMerge,
  metricValueDelta,
}) => {
  const absoluteDelta = Math.abs(metricValueDelta);
  const absoluteDeltaAsRatio =
    absoluteDelta === 0 ? 0 : absoluteDelta / metricValueBeforeMerge;
  const absoluteDeltaAsPercentage = absoluteDeltaAsRatio * 100;

  // absolute diff as percentage is below 5% -> not big
  if (absoluteDeltaAsPercentage < 5) {
    return false;
  }
  return true;
};
