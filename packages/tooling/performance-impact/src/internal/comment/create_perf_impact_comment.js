import { renderGroupImpactTable } from "./render_group_impact_table.js";

export const createPerfImpactComment = ({
  pullRequestBase,
  pullRequestHead,
  beforeMergeData,
  afterMergeData,
  isPerformanceImpactBig,
  formatGroupSummary,
  formatPerformanceImpactCell,
}) => {
  const warnings = [];

  // here we have are sure beforeMergeData and afterMergeData are valid
  // because we assert their shape is correct in reportPerformanceImpact.js#collectInfo()
  // for metrics here before merge but are no longer in afetr merge, we will ignore them
  // for new metrics we'll show them without doing the diff

  const beforeMergeGroups = beforeMergeData;
  const afterMergeGroups = afterMergeData;

  const groupNames = Object.keys(afterMergeGroups);
  const metricCount = groupNames.reduce((previous, groupName) => {
    const afterMergeMetrics = afterMergeGroups[groupName];
    return previous + Object.keys(afterMergeMetrics).length;
  }, 0);

  if (metricCount === 0) {
    const body = `<h4 id="perf-impact">Performance impact</h4>

<p>No impact to compute when merging <em>${pullRequestHead}</em> into <em>${pullRequestBase}</em>: there is no performance metric.</p>`;

    return { warnings, body };
  }

  const groups = [];
  groupNames.forEach((groupName) => {
    const afterMergeMetrics = afterMergeGroups[groupName];
    const afterMergeMetricCount = Object.keys(afterMergeMetrics).length;
    if (afterMergeMetricCount === 0) {
      // skip empty groups
      return;
    }

    const beforeMergeMetrics = beforeMergeGroups[groupName];
    const bigImpacts = beforeMergeMetrics
      ? getBigImpacts({
          afterMergeMetrics,
          beforeMergeMetrics,
          isPerformanceImpactBig,
        })
      : {};

    groups.push(
      renderDetails({
        summary: formatGroupSummary({
          groupName,
          beforeMergeMetrics,
          afterMergeMetrics,
        }),
        content: renderGroupImpactTable({
          formatPerformanceImpactCell,
          beforeMergeMetrics,
          afterMergeMetrics,
          bigImpacts,
        }),
      }),
    );
  });

  const body = `<h4 id="perf-impact">Performance impact</h4>

<p>Impact on ${metricCount} metrics when merging <em>${pullRequestHead}</em> into <em>${pullRequestBase}</em>. Before drawing conclusion, keep in mind <a href="https://github.com/jsenv/core/tree/main/packages/tooling/performance-impact#performance-variability">performance variability</a>.</p>

${groups.join(`

`)}`;

  return { warnings, body };
};

const getBigImpacts = ({
  afterMergeMetrics,
  beforeMergeMetrics,
  isPerformanceImpactBig,
}) => {
  const bigImpacts = {};

  Object.keys(afterMergeMetrics).forEach((metricName) => {
    const metricBeforeMerge = beforeMergeMetrics[metricName];
    if (metricBeforeMerge === undefined) {
      return;
    }

    const metricAfterMerge = afterMergeMetrics[metricName];
    const metricUnit = metricAfterMerge.unit;
    const metricValueAfterMerge = metricAfterMerge.value;
    const metricValueBeforeMerge = metricBeforeMerge.value;
    const metricValueDelta = metricValueAfterMerge - metricValueBeforeMerge;
    if (
      !isPerformanceImpactBig({
        metricName,
        metricUnit,
        metricValueAfterMerge,
        metricValueBeforeMerge,
        metricValueDelta,
      })
    ) {
      return;
    }

    bigImpacts[metricName] = {
      metricValueAfterMerge,
      metricValueBeforeMerge,
      metricValueDelta,
    };
  });

  return bigImpacts;
};

const renderDetails = ({ summary, content, opened = false, indent = 0 }) => {
  return `${" ".repeat(indent)}<details${opened ? " open" : ""}>
${" ".repeat(indent + 2)}<summary>${summary}</summary>
${" ".repeat(indent + 2)}${content}
${" ".repeat(indent)}</details>`;
};
