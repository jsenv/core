import { formatImpact, formatImpactAsPercentage } from "./format_impact.js";

export const jsenvFormatPerformanceImpactCell = ({
  metricUnit,
  metricValueAfterMerge,
  metricValueBeforeMerge,
}) => {
  // metric is new
  if (metricValueBeforeMerge === undefined) {
    return ``;
  }

  const diff = metricValueAfterMerge - metricValueBeforeMerge;
  if (diff === 0) {
    return ``;
  }

  const diffFormatted = formatImpact({
    metricUnit,
    metricValueAfterMerge,
    metricValueBeforeMerge,
  });
  const diffAsPercentageFormatted = formatImpactAsPercentage({
    metricValueBeforeMerge,
    metricValueAfterMerge,
  });
  return `${diffFormatted} / ${diffAsPercentageFormatted}`;
};
