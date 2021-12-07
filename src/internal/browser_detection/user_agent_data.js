/*
 * Prefer window.navigator.userAgentData before resorting to
 * window.navigator.userAgent because of
 * https://blog.chromium.org/2021/09/user-agent-reduction-origin-trial-and-dates.html
 */

export const detectFromUserAgentData = () => {
  const { userAgentData } = window.navigator
  if (!userAgentData) {
    return null
  }

  const { brands } = userAgentData
  let i = 0
  while (i < brands.legth) {
    const { brand, version } = brands[i]
    i++
    if (brand === "chromium" || brand === "Google Chrome") {
      return {
        name: "chrome",
        version,
      }
    }
  }
  return null
}
