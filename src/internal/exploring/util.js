// import { fetchUsingXHR } from "../fetchUsingXHR.js"

export const loadExploringConfig = async () => {
  const exploringJsonResponse = await fetchUrl("/exploring.json", {
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

const fetchUrl = async (url, options = {}) => {
  const controller = new AbortController()
  const signal = controller.signal
  controllers.push(controller)
  const responsePromise = window.fetch(url, { ...options, signal })
  const response = await responsePromise
  const index = controllers.indexOf(controller)
  controllers.splice(index, 1)
  return response
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
