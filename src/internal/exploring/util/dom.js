export const setStyles = (element, styles) => {
  const elementStyle = element.style
  const restoreStyles = Object.keys(styles).map((styleName) => {
    let restore
    if (styleName in elementStyle) {
      const currentStyle = elementStyle[styleName]
      restore = () => {
        elementStyle[styleName] = currentStyle
      }
    } else {
      restore = () => {
        delete elementStyle[styleName]
      }
    }

    elementStyle[styleName] = styles[styleName]

    return restore
  })
  return () => {
    restoreStyles.forEach((restore) => restore())
  }
}
