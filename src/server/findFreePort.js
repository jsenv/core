import net from "net"
import { listen, closeJustAfterListen } from "./server.js"

const portIsFree = ({ cancellation, port, ip }) => {
  const server = net.createServer()
  return listen({
    cancellation,
    server,
    port,
    ip,
  }).then(
    () => {
      const closePromise = closeJustAfterListen(server)
      // cancellation must wait for server to be closed before considering
      // cancellation as done
      cancellation.register(() => closePromise)
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
  { cancellation, ip = "127.0.0.1", min = 1, max = 65534, next = (port) => port + 1 } = {},
) => {
  const testUntil = async (port, ip) => {
    const free = await portIsFree({ cancellation, port, ip })
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
