export const supportsNewStylesheet = () => {
  try {
    // eslint-disable-next-line no-new
    new CSSStyleSheet()
    return true
  } catch (e) {
    return false
  }
}
