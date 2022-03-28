import { createRequire } from "module"

const require = createRequire(import.meta.url)

const bytes = require("bytes")

// https://github.com/visionmedia/bytes.js

export const byteAsFileSize = (metricValue) => {
  return bytes(metricValue, { decimalPlaces: 2, unitSeparator: " " })
}

export const byteAsMemoryUsage = (metricValue) => {
  return bytes(metricValue, { decimalPlaces: 2, unitSeparator: " " })
}
