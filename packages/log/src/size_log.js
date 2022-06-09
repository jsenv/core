import { require } from "@jsenv/utils/require.js"

const bytes = require("bytes")

// https://github.com/visionmedia/bytes.js

export const byteAsFileSize = (metricValue) => {
  return bytes(metricValue, { decimalPlaces: 2, unitSeparator: " " })
}

export const byteAsMemoryUsage = (
  metricValue,
  { fixedDecimals = true } = {},
) => {
  return bytes(metricValue, {
    decimalPlaces: 2,
    unitSeparator: " ",
    fixedDecimals,
  })
}
