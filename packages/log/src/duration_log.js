import { setRoundedPrecision } from "./decimals.js"

export const msAsDuration = (
  ms,
  {
    // ignore ms below meaningfulMs so that:
    // msAsDuration(0.5) -> "0 second"
    // msAsDuration(1.1) -> "0.001 second" (and not "0.0011 second")
    // This tool is meant to be read by humans and it would be barely readable to see
    // "0.0001 second" (stands for 0.1 millisecond)
    // yes we could return "0.1 millisecond" but we choosed consistency over precision
    // so that the prefered unit is "second" (and does not become millisecond when ms is super small)
    meaningfulMs = 1,
    secondMaxDecimals = 1,
  } = {},
) => {
  if (ms < meaningfulMs) {
    return "0 second"
  }
  const { primary, remaining } = parseMs(ms)

  if (!remaining) {
    return formatUnit(primary, { secondMaxDecimals })
  }
  return `${formatUnit(primary, { secondMaxDecimals })} and ${formatUnit(
    remaining,
    {
      secondMaxDecimals: 0,
    },
  )}`
}

const formatUnit = (unit, { secondMaxDecimals }) => {
  const decimals = unit.name === "second" ? secondMaxDecimals : 0
  const count = setRoundedPrecision(unit.count, {
    decimals,
  })
  if (count <= 1) {
    return `${count} ${unit.name}`
  }
  return `${count} ${unit.name}s`
}

const MS_PER_UNITS = {
  year: 31_557_600_000,
  month: 2_629_000_000,
  week: 604_800_000,
  day: 86_400_000,
  hour: 3_600_000,
  minute: 60_000,
  second: 1000,
}

const parseMs = (ms) => {
  const unitNames = Object.keys(MS_PER_UNITS)
  const smallestUnitName = unitNames[unitNames.length - 1]
  let firstUnitName = smallestUnitName
  let firstUnitCount = ms / MS_PER_UNITS[smallestUnitName]
  const firstUnitIndex = unitNames.findIndex((unitName) => {
    if (unitName === smallestUnitName) {
      return false
    }
    const msPerUnit = MS_PER_UNITS[unitName]
    const unitCount = Math.floor(ms / msPerUnit)
    if (unitCount) {
      firstUnitName = unitName
      firstUnitCount = unitCount
      return true
    }
    return false
  })
  if (firstUnitName === smallestUnitName) {
    return {
      primary: {
        name: firstUnitName,
        count: firstUnitCount,
      },
    }
  }
  const remainingMs = ms - firstUnitCount * MS_PER_UNITS[firstUnitName]
  const remainingUnitName = unitNames[firstUnitIndex + 1]
  const remainingUnitCount = remainingMs / MS_PER_UNITS[remainingUnitName]
  // - 1 year and 1 second is too much information
  //   so we don't check the remaining units
  // - 1 year and 0.0001 week is awful
  //   hence the if below
  if (Math.round(remainingUnitCount) < 1) {
    return {
      primary: {
        name: firstUnitName,
        count: firstUnitCount,
      },
    }
  }
  // - 1 year and 1 month is great
  return {
    primary: {
      name: firstUnitName,
      count: firstUnitCount,
    },
    remaining: {
      name: remainingUnitName,
      count: remainingUnitCount,
    },
  }
}
