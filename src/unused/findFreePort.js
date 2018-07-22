import net from "net"

export const findFreePort = (
  { ip = "localhost", min = 1, max = 65534, generateNext = (port) => port + 1 } = {},
) => {
  const test = (port, ip) => {
    return new Promise((resolve, reject) => {
      const server = net.createServer().listen(port, ip)
      server.on("listening", () => {
        server.close(() => {
          resolve(true)
        })
      })
      server.on("error", (error) => {
        if (error && error.code === "EADDRINUSE") {
          return resolve(false)
        }
        if (error && error.code === "EACCES") {
          return resolve(false)
        }
        return reject(error)
      })
    })
  }

  const testPort = (port, ip) => {
    return test(port, ip).then((free) => {
      if (free) {
        return port
      }
      port = generateNext(port)

      if (port > max) {
        throw new Error(`no available port between ${min} and ${max} with ip ${ip}`)
      }

      return testPort(port, ip)
    })
  }

  return testPort(min, ip)
}
