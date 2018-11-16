import {
  createCancellationToken,
  cancellationTokenToPromise,
  cancellationTokenWrapPromise,
} from "../index.js"
import http from "http"
import "../../promiseHelper.js" // for finally

export const startServer = async ({ cancellationToken = createCancellationToken() } = {}) => {
  await cancellationTokenToPromise(cancellationToken)

  const server = http.createServer()

  const opened = cancellationTokenWrapPromise(
    cancellationToken,
    new Promise((resolve, reject) => {
      server.on("error", reject)
      server.on("listening", resolve)
      server.listen(3000, "127.0.0.1")
    }),
  )

  const close = async (reason) => {
    // we must wait for the server to be opened before being able to close it
    await opened
    return new Promise((resolve, reject) => {
      server.once("close", (error) => {
        if (error) {
          reject(error)
        } else {
          resolve(`server closed because ${reason}`)
        }
      })
      server.close()
    })
  }

  cancellationToken.register(close)
  process.on("exit", close)

  await opened
  server.on("request", (request, response) => {
    response.writeHead(200)
    response.end()
  })
}

export const requestServer = async ({ cancellationToken = createCancellationToken() } = {}) => {
  await cancellationTokenToPromise(cancellationToken)

  const request = http.request({
    port: 3000,
    hostname: "127.0.0.1",
  })

  let pending = true
  let aborting = false
  const responded = cancellationTokenWrapPromise(
    cancellationToken,
    new Promise((resolve, reject) => {
      request.on("response", resolve)
      request.on("error", (error) => {
        // abort will trigger a ECONNRESET error
        if (
          aborting &&
          error &&
          error.code === "ECONNRESET" &&
          error.message === "socket hang up"
        ) {
          return
        }
        reject(error)
      })
    }).finally(() => {
      pending = false
    }),
  )

  const abort = (reason) => {
    if (!pending) return Promise.resolve("request done: abort ignored")
    aborting = true
    return new Promise((resolve) => {
      request.on("abort", () => {
        resolve(`request aborted because ${reason}`)
      })

      request.abort()
    })
  }

  request.end()
  cancellationToken.register(abort)

  return responded
}
