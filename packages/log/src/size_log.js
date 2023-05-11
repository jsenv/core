import { setRoundedPrecision } from "./decimals.js";

export const byteAsFileSize = (numberOfBytes) => {
  return formatBytes(numberOfBytes);
};

export const byteAsMemoryUsage = (metricValue) => {
  return formatBytes(metricValue, { fixedDecimals: true });
};

const formatBytes = (number, { fixedDecimals = false } = {}) => {
  if (number === 0) {
    return `0 B`;
  }
  const exponent = Math.min(
    Math.floor(Math.log10(number) / 3),
    BYTE_UNITS.length - 1,
  );
  const unitNumber = number / Math.pow(1000, exponent);
  const unitName = BYTE_UNITS[exponent];
  const maxDecimals = unitNumber < 100 ? 1 : 0;
  const unitNumberRounded = setRoundedPrecision(unitNumber, {
    decimals: maxDecimals,
    decimalsWhenSmall: 1,
  });
  if (fixedDecimals) {
    return `${unitNumberRounded.toFixed(maxDecimals)} ${unitName}`;
  }
  return `${unitNumberRounded} ${unitName}`;
};

const BYTE_UNITS = ["B", "kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
