import { assert } from "/node_modules/@dmail/assert/index.js"
import { platformCompatibilityToScore } from "./platformCompatibilityToScore.js"

{
  const chrome50Score = 1
  const chrome49Score = 2
  const chromeBelow49Score = 4
  const otherScore = 8
  const platformScoreMap = {
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
      platformScoreMap,
    )
    const expected = chromeBelow49Score
    assert({ actual, expected })
  }

  {
    const actual = platformCompatibilityToScore(
      {
        chrome: "49",
      },
      platformScoreMap,
    )
    const expected = chrome49Score
    assert({ actual, expected })
  }

  {
    const actual = platformCompatibilityToScore(
      {
        chrome: "50",
      },
      platformScoreMap,
    )
    const expected = chrome50Score
    assert({ actual, expected })
  }

  {
    const actual = platformCompatibilityToScore(
      {
        chrome: "51",
      },
      platformScoreMap,
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
      platformScoreMap,
    )
    const expected = chrome50Score + otherScore
    assert({ actual, expected })
  }
}
