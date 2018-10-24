import { detect } from "./index.js"
import assert from "assert"

{
  global.window = {
    navigator: {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.84 Safari/537.36",
    },
  }
  const actual = detect()
  const expected = {
    name: "chrome",
    version: "68.0.3440",
  }
  assert.deepEqual(actual, expected)
}

{
  global.window = {
    navigator: {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:62.0) Gecko/20100101 Firefox/62.0",
    },
  }
  const actual = detect()
  const expected = {
    name: "firefox",
    version: "62.0",
  }
  assert.deepEqual(actual, expected)
}

{
  global.window = {
    navigator: {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Safari/605.1.15",
    },
  }
  const actual = detect()
  const expected = {
    name: "safari",
    version: "12.0",
  }
  assert.deepEqual(actual, expected)
}

{
  global.window = {
    navigator: {
      userAgent: "lol/2.0.0",
    },
  }
  const actual = detect()
  const expected = {
    name: "other",
    version: "unknown",
  }
  assert.deepEqual(actual, expected)
}

console.log("passed")
