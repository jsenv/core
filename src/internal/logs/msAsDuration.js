import { require } from "../require.js"

const humanizeDuration = require("humanize-duration")

export const msAsDuration = (metricValue) => {
  return humanizeDuration(metricValue, {
    largest: 2,
    maxDecimalPoints: metricValue < 0.1 ? 3 : metricValue < 1000 ? 2 : 1,
    // units: ["s"]
  })
}
