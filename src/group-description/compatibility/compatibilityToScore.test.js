import assert from "assert"
import { compatibilityToScore } from "./compatibilityToScore.js"

{
  const chrome50Score = 1
  const chrome49Score = 2
  const chromeBelow49Score = 4
  const otherScore = 8
  const platformScoring = {
    chrome: {
      "50": chrome50Score,
      "49": chrome49Score,
      "0": chromeBelow49Score,
    },
    other: otherScore,
  }

  {
    const actual = compatibilityToScore(
      {
        chrome: "48",
      },
      platformScoring,
    )
    const expected = chromeBelow49Score
    assert.equal(actual, expected)
  }

  {
    const actual = compatibilityToScore(
      {
        chrome: "49",
      },
      platformScoring,
    )
    const expected = chrome49Score
    assert.equal(actual, expected)
  }

  {
    const actual = compatibilityToScore(
      {
        chrome: "50",
      },
      platformScoring,
    )
    const expected = chrome50Score
    assert.equal(actual, expected)
  }

  {
    const actual = compatibilityToScore(
      {
        chrome: "51",
      },
      platformScoring,
    )
    const expected = chrome50Score
    assert.equal(actual, expected)
  }

  {
    const actual = compatibilityToScore(
      {
        chrome: "51",
        foo: ["0"],
      },
      platformScoring,
    )
    const expected = chrome50Score + otherScore
    assert.equal(actual, expected)
  }
}

console.log("passed")
