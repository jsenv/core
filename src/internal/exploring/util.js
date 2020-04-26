import { fetchUsingXHR } from "../fetchUsingXHR.js"

export const loadExploringConfig = async () => {
  const exploringJsonResponse = await fetchUsingXHR("/exploring.json", {
    headers: { "x-jsenv-exploring": "1" },
  })
  const exploringConfig = await exploringJsonResponse.json()
  return exploringConfig
}

const controllers = []

export const cancelPendingRequests = () => {
  controllers.forEach((controller) => {
    controller.abort()
  })
}

export const animate = (node, keyframes, { cancellationToken, ...options } = {}) => {
  const animation = node.animate(keyframes, options)
  cancellationToken.register(() => {
    animation.cancel()
  })
  return new Promise((resolve) => {
    animation.onfinish = resolve
  })
}
