import assert from "assert"
import { compatMapToUsageScore } from "./compatMapToUsageScore.js"

{
  const chrome50Score = 1
  const chrome49Score = 2
  const chromeBelow49Score = 4
  const otherScore = 8
  const platformUsageMap = {
    chrome: {
      "50": chrome50Score,
      "49": chrome49Score,
      "0": chromeBelow49Score,
    },
    other: otherScore,
  }

  {
    const actual = compatMapToUsageScore(
      {
        chrome: "48",
      },
      platformUsageMap,
    )
    const expected = chromeBelow49Score
    assert.equal(actual, expected)
  }

  {
    const actual = compatMapToUsageScore(
      {
        chrome: "49",
      },
      platformUsageMap,
    )
    const expected = chrome49Score
    assert.equal(actual, expected)
  }

  {
    const actual = compatMapToUsageScore(
      {
        chrome: "50",
      },
      platformUsageMap,
    )
    const expected = chrome50Score
    assert.equal(actual, expected)
  }

  {
    const actual = compatMapToUsageScore(
      {
        chrome: "51",
      },
      platformUsageMap,
    )
    const expected = chrome50Score
    assert.equal(actual, expected)
  }

  {
    const actual = compatMapToUsageScore(
      {
        chrome: "51",
        foo: ["0"],
      },
      platformUsageMap,
    )
    const expected = chrome50Score + otherScore
    assert.equal(actual, expected)
  }
}

console.log("passed")
