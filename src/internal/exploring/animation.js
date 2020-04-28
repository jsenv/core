export const animate = (node, keyframes, { cancellationToken, ...options } = {}) => {
  const animation = node.animate(keyframes, options)
  cancellationToken.register(() => {
    animation.cancel()
  })
  return new Promise((resolve) => {
    animation.onfinish = resolve
  })
}
