const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000
const MILLISECONDS_PER_YEAR = MILLISECONDS_PER_DAY * 365

export const verifyRootCertificateValidityDuration = (validityDurationInMs) => {
  const durationInYears = validityDurationInMs / MILLISECONDS_PER_YEAR
  if (durationInYears > 25) {
    return {
      ok: false,
      maxAllowedValue: MILLISECONDS_PER_YEAR * 25,
      message: `root certificate validity duration of ${durationInYears} years is too much, using the max recommended duration: 25 years`,
      details:
        "https://serverfault.com/questions/847190/in-theory-could-a-ca-make-a-certificate-that-is-valid-for-arbitrarily-long",
    }
  }
  return { ok: true }
}

export const verifyServerCertificateValidityDuration = (
  validityDurationInMs,
) => {
  const validityDurationInDays = validityDurationInMs / MILLISECONDS_PER_DAY
  if (validityDurationInDays > 397) {
    return {
      ok: false,
      maxAllowedValue: MILLISECONDS_PER_DAY * 397,
      message: `certificate validity duration of ${validityDurationInMs} days is too much, using the max recommended duration: 397 days`,
      details:
        "https://www.globalsign.com/en/blog/maximum-ssltls-certificate-validity-now-one-year",
    }
  }
  return { ok: true }
}

export const createValidityDurationOfXYears = (years) =>
  MILLISECONDS_PER_YEAR * years + 5000

export const createValidityDurationOfXDays = (days) =>
  MILLISECONDS_PER_DAY * days + 5000
