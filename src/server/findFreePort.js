import net from "net"
import { listen, closeServer } from "./server.js"
import { createCancellationToken } from "../cancellation/index.js"

const portIsFree = ({ cancellationToken, port, ip }) => {
  const server = net.createServer()
  return listen({
    cancellationToken,
    server,
    port,
    ip,
  }).then(
    () => {
      const closePromise = closeServer(server)
      // cancellation must wait for server to be closed before considering
      // cancellation as done
      cancellationToken.register(() => closePromise)
      return closePromise.then(() => true)
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
