import { roundNumber, getPrecision, setPrecision } from "./decimals.js"

export const distributePercentages = (
  namedNumbers,
  { maxPrecisionHint = 2 } = {},
) => {
  const numberNames = Object.keys(namedNumbers)
  if (numberNames.length === 0) {
    return {}
  }
  if (numberNames.length === 1) {
    const firstNumberName = numberNames[0]
    return { [firstNumberName]: "100 %" }
  }
  const numbers = numberNames.map((name) => namedNumbers[name])
  const total = numbers.reduce((sum, value) => sum + value, 0)
  const ratios = numbers.map((number) => number / total)
  const lowestValue = 1 / Math.pow(10, maxPrecisionHint)
  let biggestPrecisionRequired = 0
  for (const ratio of ratios) {
    if (ratio < lowestValue) {
      const precision = getPrecision(ratio)
      if (precision > biggestPrecisionRequired) {
        biggestPrecisionRequired = precision
      }
    }
  }

  const toPercentage = (ratio) => {
    if (biggestPrecisionRequired > maxPrecisionHint) {
      return `${setPrecision(ratio * 100, biggestPrecisionRequired - 2)} %`
    }
    const ratioRounded = roundNumber(ratio, maxPrecisionHint)
    return `${setPrecision(ratioRounded * 100, biggestPrecisionRequired - 2)} %`
  }

  let remainingRatio = 1
  const distribution = {}
  ratios.pop()
  ratios.forEach((ratio, index) => {
    remainingRatio -= ratio
    distribution[numberNames[index]] = toPercentage(ratio)
  })
  distribution[numberNames[numberNames.length - 1]] =
    toPercentage(remainingRatio)
  return distribution
}
