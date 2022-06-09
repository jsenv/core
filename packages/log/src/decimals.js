export const getPrecision = (number) => {
  if (Math.floor(number) === number) return 0
  const [, decimals] = number.toString().split(".")
  return decimals.length || 0
}

export const setRoundedPrecision = (
  number,
  { decimals = 1, decimalsWhenSmall = decimals } = {},
) => {
  return setDecimalsPrecision(number, {
    decimals,
    decimalsWhenSmall,
    transform: Math.round,
  })
}

export const setFlooredPrecision = (
  number,
  { decimals = 1, decimalsWhenSmall = decimals } = {},
) => {
  return setDecimalsPrecision(number, {
    decimals,
    decimalsWhenSmall,
    transform: Math.floor,
  })
}

export const setCeiledPrecision = (
  number,
  { decimals = 1, decimalsWhenSmall = decimals } = {},
) => {
  return setDecimalsPrecision(number, {
    decimals,
    decimalsWhenSmall,
    transform: Math.ceil,
  })
}

export const setPrecision = (
  number,
  { decimals = 1, decimalsWhenSmall = decimals } = {},
) => {
  return setDecimalsPrecision(number, {
    decimals,
    decimalsWhenSmall,
    transform: parseInt,
  })
}

const setDecimalsPrecision = (
  number,
  {
    transform,
    decimals, // max decimals for number in [-Infinity, -1[]1, Infinity]
    decimalsWhenSmall, // max decimals for number in [-1,1]
  } = {},
) => {
  if (number === 0) {
    return 0
  }
  let numberCandidate = Math.abs(number)
  if (numberCandidate < 1) {
    const integerGoal = Math.pow(10, decimalsWhenSmall - 1)
    let i = 1
    while (numberCandidate < integerGoal) {
      numberCandidate *= 10
      i *= 10
    }
    const asInteger = transform(numberCandidate)
    const asFloat = asInteger / i
    return number < 0 ? -asFloat : asFloat
  }
  const coef = Math.pow(10, decimals)
  const numberMultiplied = (number + Number.EPSILON) * coef
  const asInteger = transform(numberMultiplied)
  const asFloat = asInteger / coef
  return number < 0 ? -asFloat : asFloat
}

// https://www.codingem.com/javascript-how-to-limit-decimal-places/
// export const roundNumber = (number, maxDecimals) => {
//   const decimalsExp = Math.pow(10, maxDecimals)
//   const numberRoundInt = Math.round(decimalsExp * (number + Number.EPSILON))
//   const numberRoundFloat = numberRoundInt / decimalsExp
//   return numberRoundFloat
// }

// export const setPrecision = (number, precision) => {
//   if (Math.floor(number) === number) return number
//   const [int, decimals] = number.toString().split(".")
//   if (precision <= 0) return int
//   const numberTruncated = `${int}.${decimals.slice(0, precision)}`
//   return numberTruncated
// }
