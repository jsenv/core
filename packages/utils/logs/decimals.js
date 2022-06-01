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
