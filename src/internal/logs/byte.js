import { createRequire } from "module"

const require = createRequire(import.meta.url)

// https://github.com/visionmedia/bytes.js/
const bytes = require("bytes")

export const formatByte = (metricValue) => {
  return bytes(metricValue, { decimalPlaces: 2, unitSeparator: " " })
}
