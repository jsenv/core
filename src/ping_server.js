import { createServer } from "node:net"

export const pingServer = async (url) => {
  const server = createServer()
  const { hostname, port } = new URL(url)

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
      return true
    }
    if (error && error.code === "EACCES") {
      return true
    }
    throw error
  }
  await new Promise((resolve, reject) => {
    server.on("error", reject)
    server.on("close", resolve)
    server.close()
  })
  return false
}
