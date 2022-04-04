import { require } from "../require.js"

// https://github.com/EvanHahn/HumanizeDuration.js
const humanizeDuration = require("humanize-duration")

export const msAsDuration = (ms) => {
  // below 100 ms it would display "0 seconds", add more decimals
  if (ms < 100) {
    return humanizeDuration(ms, {
      maxDecimalPoints: 3,
      units: ["s"],
    })
  }
  // below 1s we want "0.01 seconds" and "0.3 seconds"
  if (ms < 1000) {
    return humanizeDuration(ms, {
      maxDecimalPoints: 2,
      units: ["s"],
    })
  }
  // below 60s we just display the exact amount of seconds
  if (ms < 60000) {
    return humanizeDuration(ms, {
      largest: 1,
      maxDecimalPoints: 0,
    })
  }
  return humanizeDuration(ms, {
    largest: 2,
    maxDecimalPoints: 0,
    delimiter: " and ",
  })
}
