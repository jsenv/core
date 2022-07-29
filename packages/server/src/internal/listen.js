import { createServer } from "node:net"
import { Abort } from "@jsenv/abort"

const listen = async ({
  signal = new AbortController().signal,
  server,
  port,
  portHint,
  hostname,
}) => {
  const listeningOperation = Abort.startOperation()

  try {
    listeningOperation.addAbortSignal(signal)

    if (portHint) {
      listeningOperation.throwIfAborted()
      port = await findFreePort(portHint, {
        signal: listeningOperation.signal,
        hostname,
      })
    }
    listeningOperation.throwIfAborted()
    port = await startListening({ server, port, hostname })
    listeningOperation.addAbortCallback(() => stopListening(server))
    listeningOperation.throwIfAborted()

    return port
  } finally {
    await listeningOperation.end()
  }
}

export const findFreePort = async (
  initialPort = 1,
  {
    signal = new AbortController().signal,
    hostname = "127.0.0.1",
    min = 1,
    max = 65534,
    next = (port) => port + 1,
  } = {},
) => {
  const findFreePortOperation = Abort.startOperation()
  try {
    findFreePortOperation.addAbortSignal(signal)
    findFreePortOperation.throwIfAborted()

    const testUntil = async (port, host) => {
      findFreePortOperation.throwIfAborted()
      const free = await portIsFree(port, host)
      if (free) {
        return port
      }

      const nextPort = next(port)
      if (nextPort > max) {
        throw new Error(
          `${hostname} has no available port between ${min} and ${max}`,
        )
      }
      return testUntil(nextPort, hostname)
    }
    const freePort = await testUntil(initialPort, hostname)
    return freePort
  } finally {
    await findFreePortOperation.end()
  }
}

const portIsFree = async (port, hostname) => {
  const server = createServer()

  try {
    await startListening({
      server,
      port,
      hostname,
    })
  } catch (error) {
    if (error && error.code === "EADDRINUSE") {
      return false
    }
    if (error && error.code === "EACCES") {
      return false
    }
    throw error
  }

  await stopListening(server)
  return true
}

const startListening = ({ server, port, hostname }) => {
  return new Promise((resolve, reject) => {
    server.on("error", reject)
    server.on("listening", () => {
      // in case port is 0 (randomly assign an available port)
      // https://nodejs.org/api/net.html#net_server_listen_port_host_backlog_callback
      resolve(server.address().port)
    })
    server.listen(port, hostname)
  })
}

export const stopListening = (server) => {
  return new Promise((resolve, reject) => {
    server.on("error", reject)
    server.on("close", resolve)
    server.close()
  })
}

// unit test exports
export { listen, portIsFree }
