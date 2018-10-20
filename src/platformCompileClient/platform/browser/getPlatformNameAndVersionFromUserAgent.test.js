import { getPlatformNameAndVersionFromUserAgent } from "./getPlatformNameAndVersionFromUserAgent.js"
import assert from "assert"

{
  const actual = getPlatformNameAndVersionFromUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.84 Safari/537.36",
  )
  const expected = {
    platformName: "chrome",
    platformVersion: "68.0.3440",
  }
  assert.deepEqual(actual, expected)
}

{
  const actual = getPlatformNameAndVersionFromUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:62.0) Gecko/20100101 Firefox/62.0",
  )
  const expected = {
    platformName: "firefox",
    platformVersion: "62.0",
  }
  assert.deepEqual(actual, expected)
}

{
  const actual = getPlatformNameAndVersionFromUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Safari/605.1.15",
  )
  const expected = {
    platformName: "safari",
    platformVersion: "12.0",
  }
  assert.deepEqual(actual, expected)
}

{
  const actual = getPlatformNameAndVersionFromUserAgent("lol/2.0.0")
  const expected = {
    platformName: "other",
    platformVersion: "unknown",
  }
  assert.deepEqual(actual, expected)
}

console.log("passed")
