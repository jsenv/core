import { formatRatioAsPercentage } from "../format_ratio.js";

export const jsenvFormatGroupSummary = ({
  groupName,
  beforeMergeMetrics,
  afterMergeMetrics,
}) => {
  if (!beforeMergeMetrics) {
    return `${groupName} (new)`;
  }

  const allRatios = getAllImpactRatios({
    beforeMergeMetrics,
    afterMergeMetrics,
  });
  const ratiosCount = allRatios.length;
  if (ratiosCount === 0) {
    return `${groupName} (no impact)`;
  }

  const ratioSum = allRatios.reduce((previous, ratio) => previous + ratio, 0);
  if (ratioSum === 0) {
    return `${groupName} (no impact)`;
  }

  return `${groupName} (${formatRatioAsPercentage(ratioSum / ratiosCount)})`;
};

const getAllImpactRatios = ({ afterMergeMetrics, beforeMergeMetrics }) => {
  let allRatios = [];
  Object.keys(afterMergeMetrics).forEach((metricName) => {
    const metricBeforeMerge = beforeMergeMetrics[metricName];
    if (!metricBeforeMerge) {
      // it's new, let's ignore
      return;
    }
    const metricAfterMerge = afterMergeMetrics[metricName];
    const metricValueBeforeMerge = metricBeforeMerge.value;
    const metricValueAfterMerge = metricAfterMerge.value;
    const metricDiff = metricValueAfterMerge - metricValueBeforeMerge;
    if (
      metricDiff === 0 &&
      metricValueAfterMerge === 0 &&
      metricValueBeforeMerge === 0
    ) {
      // there is no impact on a metric that is 0
      // we can ignore this metric
      return;
    }

    const metricDiffRatio =
      metricDiff === 0
        ? 0
        : metricValueBeforeMerge === 0
          ? 1
          : metricValueAfterMerge === 0
            ? -1
            : metricDiff / metricValueBeforeMerge;
    allRatios.push(metricDiffRatio);
  });
  return allRatios;
};
