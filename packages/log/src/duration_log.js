import { setPrecision } from "./decimals.js"

export const msAsDuration = (ms) => {
  if (ms < 1) {
    // it would be barely readable to write 0.0001 second (stands for 0.1 millisecond)
    // and this precision does not matter
    // (this function is meant to display a duration to a human)
    // so in this case we'll return "0 second" which means "less than 1 millisecond"
    // (I prefer "0 second" to be consistent with other logs wich will likely measure in "second")
    return "0 second"
  }
  const { primary, remaining } = parseMs(ms)
  if (!remaining) {
    return formatUnit(primary, determineMaxDecimals(primary))
  }
  return `${formatUnit(primary)} and ${formatUnit(remaining)}`
}

const determineMaxDecimals = (unit) => {
  if (unit.name !== "second") {
    return 0
  }
  const count = unit.count
  if (count < 0.001) {
    return 4
  }
  if (count < 0.01) {
    return 3
  }
  if (count < 0.1) {
    return 2
  }
  if (count < 1) {
    return 1
  }
  return 1
}

const formatUnit = (unit, maxDecimals = 0) => {
  const count = setPrecision(unit.count, maxDecimals)
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
