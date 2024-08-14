export const formatStillValid = ({ certificateName, validityRemainingMs }) => {
  return `${certificateName} still valid for ${formatDuration(
    validityRemainingMs,
  )}`
}

export const formatAboutToExpire = ({
  certificateName,
  validityRemainingMs,
  msEllapsedSinceValid,
}) => {
  return `${certificateName} will expire ${formatTimeDelta(
    validityRemainingMs,
  )}, it was valid during ${formatDuration(msEllapsedSinceValid)}`
}

export const formatExpired = ({
  certificateName,
  msEllapsedSinceExpiration,
  validityDurationInMs,
}) => {
  return `${certificateName} has expired ${formatTimeDelta(
    -msEllapsedSinceExpiration,
  )}, it was valid during ${formatDuration(validityDurationInMs)}`
}

export const formatTimeDelta = (deltaInMs) => {
  const unit = pickUnit(Math.abs(deltaInMs))
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
  const msRounded = unit.min ? Math.floor(deltaInMs / unit.min) : deltaInMs
  return rtf.format(msRounded, unit.name)
}

export const formatDuration = (ms) => {
  const unit = pickUnit(ms)
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "always" })
  const msRounded = unit.min ? Math.floor(ms / unit.min) : ms
  const parts = rtf.formatToParts(msRounded, unit.name)
  if (parts.length > 1 && parts[0].type === "literal") {
    return parts
      .slice(1)
      .map((part) => part.value)
      .join("")
  }
  return parts.map((part) => part.value).join("")
}

const pickUnit = (ms) => {
  const msPerSecond = 1000
  const msPerMinute = msPerSecond * 60
  const msPerHour = msPerMinute * 60
  const msPerDay = msPerHour * 24
  const msPerMonth = msPerDay * 30
  const msPerYear = msPerDay * 365

  if (ms < msPerSecond) {
    return {
      name: "second",
      // min 0 to allow display of 0.01 second for example
      min: 0,
    }
  }
  if (ms < msPerMinute) {
    return { name: "second", min: msPerSecond }
  }
  if (ms < msPerHour) {
    return { name: "minute", min: msPerMinute }
  }
  if (ms < msPerDay) {
    return { name: "hour", min: msPerHour }
  }
  if (ms < msPerMonth) {
    return { name: "day", min: msPerDay }
  }
  if (ms < msPerYear) {
    return { name: "month", min: msPerMonth }
  }
  return { name: "year", min: msPerYear }
}
