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
