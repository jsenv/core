import { require } from "../require.js"

const humanizeDuration = require("humanize-duration")

export const msAsDuration = (metricValue) => {
  return humanizeDuration(metricValue, {
    largest: 2,
    maxDecimalPoints: metricValue < 1 ? 4 : metricValue < 1000 ? 3 : 2,
    // units: ["s"]
  })
}
