import { humanizeDuration, humanizeFileSize } from "@jsenv/humanize";

export const formatMetricValue = ({ value, unit }) => {
  return formatters[unit](value);
};

const formatters = {
  ms: humanizeDuration,
  byte: humanizeFileSize,
  undefined: (value) => value,
};
