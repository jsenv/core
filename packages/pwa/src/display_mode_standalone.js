/**
 * displayModeStandalone can be used to know the current displayMode of
 * our web page is standalone (PWA)
 */

export const displayModeStandalone = {
  get: () =>
    window.navigator.standalone ||
    window.matchMedia("(display-mode: standalone)").matches,
  listen: (callback) => {
    const media = window.matchMedia("(display-mode: standalone)")
    media.addListener(callback)
    return () => {
      media.removeListener(callback)
    }
  },
}
