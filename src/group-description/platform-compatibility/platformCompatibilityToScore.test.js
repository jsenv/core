import { assert } from "/node_modules/@dmail/assert/index.js"
import { platformCompatibilityToScore } from "./platformCompatibilityToScore.js"

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
    const actual = platformCompatibilityToScore(
      {
        chrome: "48",
      },
      platformScoring,
    )
    const expected = chromeBelow49Score
    assert({ actual, expected })
  }

  {
    const actual = platformCompatibilityToScore(
      {
        chrome: "49",
      },
      platformScoring,
    )
    const expected = chrome49Score
    assert({ actual, expected })
  }

  {
    const actual = platformCompatibilityToScore(
      {
        chrome: "50",
      },
      platformScoring,
    )
    const expected = chrome50Score
    assert({ actual, expected })
  }

  {
    const actual = platformCompatibilityToScore(
      {
        chrome: "51",
      },
      platformScoring,
    )
    const expected = chrome50Score
    assert({ actual, expected })
  }

  {
    const actual = platformCompatibilityToScore(
      {
        chrome: "51",
        foo: ["0"],
      },
      platformScoring,
    )
    const expected = chrome50Score + otherScore
    assert({ actual, expected })
  }
}
