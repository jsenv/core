export const formatDuration = (duration) => {
  const seconds = duration / 1000
  const secondsWithTwoDecimalPrecision = Math.floor(seconds * 100) / 100

  return `${secondsWithTwoDecimalPrecision}s`
}
