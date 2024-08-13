import { formatMetricValue } from "../format_metric_value.js";

const METRIC_NAME_MAX_LENGTH = 50;
const MAX_METRIC_PER_GROUP = 20;

export const renderGroupImpactTable = ({
  formatPerformanceImpactCell,
  // groupName,
  beforeMergeMetrics,
  afterMergeMetrics,
  bigImpacts,
}) => {
  return `<table>
    <thead>
      <th nowrap>Metric</th>
      <th nowrap>Before merge</th>
      <th nowrap>After merge</th>
      <th nowrap>Impact</th>
      <th nowrap></th>
    </thead>
    <tbody>
      ${renderPerfImpactTableBody({
        formatPerformanceImpactCell,
        beforeMergeMetrics,
        afterMergeMetrics,
        bigImpacts,
      })}
    </tbody>
  </table>`;
};

const renderPerfImpactTableBody = ({
  formatPerformanceImpactCell,
  beforeMergeMetrics,
  afterMergeMetrics,
  bigImpacts,
}) => {
  const lines = [];
  const metricAllNames = Object.keys(afterMergeMetrics);
  const metricCount = metricAllNames.length;
  const metricNames =
    metricCount > MAX_METRIC_PER_GROUP
      ? metricAllNames.slice(0, MAX_METRIC_PER_GROUP)
      : metricAllNames;

  metricNames.forEach((metricName) => {
    const metricNameDisplayed = truncateMetricName(metricName);
    const metric = afterMergeMetrics[metricName];
    const metricValueAfterMerge = metric.value;
    const metricBeforeMerge = beforeMergeMetrics
      ? beforeMergeMetrics[metricName]
      : undefined;
    if (!metricBeforeMerge) {
      lines.push([
        `<td nowrap>${metricNameDisplayed}</td>`,
        `<td nowrap></td>`,
        `<td nowrap>${formatMetricValue(metric)}</td>`,
        `<td nowrap>${formatPerformanceImpactCell({
          metricUnit: metric.unit,
          metricValueAfterMerge,
          metricValueBeforeMerge: undefined,
          isBig: false,
        })}</td>`,
        `<td>:baby:</td>`,
      ]);
      return;
    }

    const isBig = Boolean(bigImpacts[metricName]);
    const metricValueBeforeMerge = metricBeforeMerge.value;
    lines.push([
      `<td nowrap>${metricNameDisplayed}</td>`,
      `<td nowrap>${formatMetricValue(metricBeforeMerge)}</td>`,
      `<td nowrap>${formatMetricValue(metric)}</td>`,
      `<td nowrap>${formatPerformanceImpactCell({
        metricUnit: metric.unit,
        metricValueAfterMerge,
        metricValueBeforeMerge,
        isBig,
      })}</td>`,
      `<td>${renderEmojiCellContent({
        metricValueAfterMerge,
        metricValueBeforeMerge,
      })}</td>`,
    ]);
  });
  if (metricNames !== metricAllNames) {
    lines.push([
      `<td colspan="5" align="center">... ${
        metricCount - MAX_METRIC_PER_GROUP
      } more ...</td>`,
    ]);
  }

  return renderTableLines(lines);
};

const renderEmojiCellContent = ({
  metricValueAfterMerge,
  metricValueBeforeMerge,
}) => {
  const delta = metricValueAfterMerge - metricValueBeforeMerge;
  if (delta === 0) {
    return ":ghost:";
  }

  if (delta > 0) {
    return ":arrow_upper_right:";
  }

  return ":arrow_lower_right:";
};

const truncateMetricName = (metricName) => {
  const length = metricName.length;
  if (length > METRIC_NAME_MAX_LENGTH) {
    return `${metricName.slice(0, METRIC_NAME_MAX_LENGTH - `…`.length)}…`;
  }
  return metricName;
};

const renderTableLines = (lines, { indentCount = 3, indentSize = 2 } = {}) => {
  if (lines.length === 0) {
    return "";
  }

  const cellLeftSpacing = indent(indentCount + 1, indentSize);
  const lineLeftSpacing = indent(indentCount, indentSize);

  return `<tr>${lines.map(
    (cells) => `
${cellLeftSpacing}${cells.join(`
${cellLeftSpacing}`)}`,
  ).join(`
${lineLeftSpacing}</tr>
${lineLeftSpacing}<tr>`)}
${lineLeftSpacing}</tr>`;
};

const indent = (count, size) => ` `.repeat(size * count);
