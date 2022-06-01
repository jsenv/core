// https://www.codingem.com/javascript-how-to-limit-decimal-places/
export const roundNumber = (number, maxDecimals) => {
  const decimalsExp = Math.pow(10, maxDecimals)
  const numberRoundInt = Math.round(decimalsExp * (number + Number.EPSILON))
  const numberRoundFloat = numberRoundInt / decimalsExp
  return numberRoundFloat
}

export const setPrecision = (number, precision) => {
  if (Math.floor(number) === number) return number
  const [int, decimals] = number.toString().split(".")
  if (precision <= 0) return int
  const numberTruncated = `${int}.${decimals.slice(0, precision)}`
  return numberTruncated
}

export const getPrecision = (number) => {
  if (Math.floor(number) === number) return 0
  const [, decimals] = number.toString().split(".")
  return decimals.length || 0
}

export const truncateToSignificantDecimals = (
  number,
  { round = true, decimals = 1 } = {},
) => {
  if (number === 0) return 0
  const integerGoal = Math.pow(10, decimals - 1)
  let i = 1
  let numberCandidate = Math.abs(number)
  while (numberCandidate < integerGoal) {
    numberCandidate *= 10
    i *= 10
  }
  const integerTruncated = round
    ? Math.round(numberCandidate)
    : parseInt(numberCandidate)
  const floatTruncated = integerTruncated / i
  return number < 0 ? -floatTruncated : floatTruncated
}
