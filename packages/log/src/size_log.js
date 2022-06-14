import { setRoundedPrecision } from "./decimals.js"

export const byteAsFileSize = (metricValue) => {
  return formatBytes(metricValue)
}

export const byteAsMemoryUsage = (metricValue) => {
  return formatBytes(metricValue, { fixedDecimals: true })
}

const formatBytes = (number, { fixedDecimals = false } = {}) => {
  if (number === 0) {
    return `0 B`
  }
  const exponent = Math.min(
    Math.floor(Math.log10(number) / 3),
    BYTE_UNITS.length - 1,
  )
  const unitNumber = number / Math.pow(1000, exponent)
  const unitName = BYTE_UNITS[exponent]
  const decimals = unitName === "B" ? 0 : 1
  const unitNumberRounded = setRoundedPrecision(unitNumber, {
    decimals,
  })
  if (fixedDecimals) {
    return `${unitNumberRounded.toFixed(decimals)} ${unitName}`
  }
  return `${unitNumberRounded} ${unitName}`
}

const BYTE_UNITS = ["B", "kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
