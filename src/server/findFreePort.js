import net from "net"
import { createCancellationToken } from "/node_modules/@dmail/cancellation/index.js"
import { listen } from "./listen.js"

export const findFreePort = async (
  initialPort = 1,
  {
    cancellationToken = createCancellationToken(),
    ip = "127.0.0.1",
    min = 1,
    max = 65534,
    next = (port) => port + 1,
  } = {},
) => {
  const testUntil = async (port, ip) => {
    const free = await portIsFree({ cancellationToken, port, ip })
    if (free) {
      return port
    }
    const nextPort = next(port)

    if (nextPort > max) {
      throw new Error(`${ip} has no available port between ${min} and ${max}`)
    }

    return testUntil(nextPort, ip)
  }

  return testUntil(initialPort, ip)
}

const portIsFree = async ({ cancellationToken, port, ip }) => {
  const server = net.createServer()

  const listenOperation = listen({
    cancellationToken,
    server,
    port,
    ip,
  })

  return listenOperation.then(
    () => {
      const stopPromise = listenOperation.stop()
      // cancellation must wait for server to be closed before considering
      // cancellation as done
      cancellationToken.register(() => stopPromise)
      return stopPromise.then(() => true)
    },
    (error) => {
      if (error && error.code === "EADDRINUSE") {
        return false
      }
      if (error && error.code === "EACCES") {
        return false
      }
      return Promise.reject(error)
    },
  )
}
