import { require } from "@jsenv/core/src/internal/require.js"

const bytes = require("bytes")

// https://github.com/visionmedia/bytes.js

export const byteAsFileSize = (metricValue) => {
  return bytes(metricValue, { decimalPlaces: 2, unitSeparator: " " })
}
