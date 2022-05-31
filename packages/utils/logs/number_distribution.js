export const distributeNumbers = (namedNumbers, { maxPrecision = 2 } = {}) => {
  const numberNames = Object.keys(namedNumbers)
  if (numberNames.length === 0) {
    return {}
  }
  if (numberNames.length === 1) {
    const firstNumberName = numberNames[0]
    return { [firstNumberName]: 1 }
  }
  const numbers = numberNames.map((name) => namedNumbers[name])
  const total = numbers.reduce((sum, value) => sum + value, 0)
  const ratios = numbers.map((number) => number / total)
  let precision = 0
  for (const ratio of ratios) {
    const roundedRatio = toRoundedNumber(ratio, maxPrecision)
    if (roundedRatio === 0) {
      // value is super small, use the max amout of decimals
      precision = maxPrecision
      break
    }
    const roundedRatioPrecision = getPrecision(roundedRatio)
    // we could reduce the precision
    if (roundedRatioPrecision < maxPrecision) {
      precision = roundedRatioPrecision
    }
  }
  let remainingRatio = 1
  const distribution = {}
  ratios.pop()
  ratios.forEach((ratio, index) => {
    const preciseRatio = toRoundedPreciseString(ratio, precision)
    remainingRatio -= ratio
    distribution[numberNames[index]] = preciseRatio
  })
  distribution[numberNames[numberNames.length - 1]] = toRoundedPreciseString(
    remainingRatio,
    precision,
  )
  return distribution
}

const toRoundedNumber = (number, maxDecimals) => {
  const decimalsExp = Math.pow(10, maxDecimals)
  const numberRounded = Math.round(decimalsExp * number) / decimalsExp
  return numberRounded
}

const toRoundedPreciseString = (number, maxDecimals) => {
  const decimalsExp = Math.pow(10, maxDecimals)
  const numberRounded = Math.round(decimalsExp * number) / decimalsExp
  const preciseString = numberRounded.toFixed(maxDecimals)
  return preciseString
}

const getPrecision = (number) => {
  if (Math.floor(number) === number) return 0
  const [, decimals] = number.toString().split(".")
  return decimals.length || 0
}
