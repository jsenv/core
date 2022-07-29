import { createServer } from "node:net"

export const pingServer = async (url) => {
  const server = createServer()
  const { hostname, port } = url

  try {
    await new Promise((resolve, reject) => {
      server.on("error", reject)
      server.on("listening", () => {
        resolve()
      })
      server.listen(port, hostname)
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
  await new Promise((resolve, reject) => {
    server.on("error", reject)
    server.on("close", resolve)
    server.close()
  })
  return true
}
