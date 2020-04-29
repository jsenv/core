const animateFallback = () => {
  return Promise.resolve()
}

const animateNative = (node, keyframes, { cancellationToken, ...options } = {}) => {
  const animation = node.animate(keyframes, options)
  if (cancellationToken) {
    cancellationToken.register(() => {
      animation.cancel()
    })
  }
  return new Promise((resolve) => {
    animation.onfinish = resolve
  })
}

export const animate =
  typeof HTMLElement.prototype.animate === "function" ? animateNative : animateFallback

export const fadeIn = (node, options) =>
  animate(
    node,
    [
      {
        opacity: 0,
      },
      {
        opacity: 1,
      },
    ],
    options,
  )

export const fadeOut = (node, options) =>
  animate(
    node,
    [
      {
        opacity: 1,
      },
      {
        opacity: 0,
      },
    ],
    options,
  )

export const move = (fromNode, toNode, options) => {
  const fromComputedStyle = window.getComputedStyle(fromNode)
  const toComputedStyle = window.getComputedStyle(toNode)
  // get positions of input in toolbar and aElement
  const fromPosition = fromNode.getBoundingClientRect()
  const toPosition = toNode.getBoundingClientRect()

  // we'll do the animation in a div preventing overflow and pointer events
  const div = document.createElement("div")
  div.style.position = "absolute"
  div.style.left = 0
  div.style.top = 0
  div.style.right = 0
  div.style.bottom = 0
  div.style.overflow = "hidden"
  div.style.pointerEvents = "none"

  // clone node and style it
  const copy = fromNode.cloneNode(true)
  copy.style.position = "absolute"
  copy.style.left = fromPosition.left
  copy.style.top = fromPosition.top
  copy.style.maxWidth = fromPosition.right - fromPosition.left
  copy.style.overflow = toComputedStyle.overflow
  copy.style.textOverflow = toComputedStyle.textOverflow
  div.appendChild(copy)
  document.body.appendChild(div)

  const left = toPosition.left - fromPosition.left - (parseInt(fromComputedStyle.paddingLeft) || 0)
  const top = toPosition.top - fromPosition.top - (parseInt(fromComputedStyle.paddingTop) || 0)
  // define final position of new element and the duration
  const translate = `translate(${left}px, ${top}px)`

  // animate new element
  return animate(
    copy,
    [
      {
        transform: "translate(0px, 0px)",
        backgroundColor: fromComputedStyle.backgroundColor,
        color: fromComputedStyle.color,
        fontSize: fromComputedStyle.fontSize,
        height: fromPosition.bottom - fromPosition.top,
        width: "100%",
      },
      {
        transform: translate,
        // TODO flore: transform backgroundColor very late (90%) to avoid text to become
        // white over white
        backgroundColor: toComputedStyle.backgroundColor,
        color: toComputedStyle.color,
        fontSize: toComputedStyle.fontSize,
        height: toPosition.bottom - toPosition.top,
        width: toComputedStyle.width,
      },
    ],
    options,
  ).then(() => {
    div.parentNode.removeChild(div)
  })
}
