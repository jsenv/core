import { request } from "node:http"

import { startServer } from "@jsenv/server"
import { createObservable } from "@jsenv/server/src/internal/observable.js"

// aborting request while producing response
{
  let resolveResponseBody
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    services: [
      {
        handleRequest: () => {
          return {
            status: 200,
            body: new Promise((resolve) => {
              resolveResponseBody = resolve
            }),
          }
        },
      },
    ],
  })

  const { port, hostname } = new URL(server.origin)
  const requestBody = "Hello world"
  const requestAbortController = new AbortController()
  const nodeRequest = request({
    signal: requestAbortController.signal,
    hostname,
    port,
    method: "GET",
    headers: {
      "content-length": Buffer.byteLength(requestBody),
    },
  })

  nodeRequest.write(requestBody.slice(0, 2))
  await new Promise((resolve) => {
    setTimeout(() => {
      requestAbortController.abort()
      resolve()
    }, 200)
  })
  await Promise.resolve()
  resolveResponseBody()
}

// abort pending request while writing response
{
  let responseBodyHooks
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    services: [
      {
        handleRequest: async () => {
          return {
            status: 200,
            body: createObservable(({ next, complete }) => {
              next("Hell")
              responseBodyHooks = { next, complete }
            }),
          }
        },
      },
    ],
  })

  const { port, hostname } = new URL(server.origin)
  const requestBody = "Hello world"
  const requestAbortController = new AbortController()
  const nodeRequest = request({
    signal: requestAbortController.signal,
    hostname,
    port,
    method: "GET",
    headers: {
      "content-length": Buffer.byteLength(requestBody),
    },
  })

  nodeRequest.write(requestBody.slice(0, 2))
  nodeRequest.write(requestBody.slice(2))
  nodeRequest.end()
  await new Promise((resolve) => {
    nodeRequest.once("response", resolve)
  })
  requestAbortController.abort()
  responseBodyHooks.complete()
}

// aborting response while it's written
{
  let responseBodyHooks
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    services: [
      {
        handleRequest: async () => {
          return {
            status: 200,
            body: createObservable(({ next, complete }) => {
              next("Hell")
              responseBodyHooks = { next, complete }
            }),
          }
        },
      },
    ],
  })

  const { port, hostname } = new URL(server.origin)
  const requestBody = "Hello world"
  const nodeRequest = request({
    hostname,
    port,
    method: "GET",
    headers: {
      "content-length": Buffer.byteLength(requestBody),
    },
  })

  nodeRequest.write(requestBody.slice(0, 2))
  nodeRequest.write(requestBody.slice(2))
  nodeRequest.end()
  const nodeResponse = await new Promise((resolve) => {
    nodeRequest.once("response", resolve)
  })
  nodeResponse.destroy()
  await new Promise((resolve) => {
    setTimeout(resolve, 200)
  })
  responseBodyHooks.complete()
}
