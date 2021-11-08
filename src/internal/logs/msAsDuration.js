import { require } from "../require.js"

const humanizeDuration = require("humanize-duration")

export const msAsDuration = (ms) => {
  return humanizeDuration(ms, {
    largest: 2,
    maxDecimalPoints: ms < 0.1 ? 3 : ms < 1000 ? 2 : ms < 60000 ? 1 : 0,
    // units: ["s"]
  })
}
