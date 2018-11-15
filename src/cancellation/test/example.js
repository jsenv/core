import { cancellationNone, createCancel } from "../cancel.js"
import http from "http"
import assert from "assert"

const registerEvent = (object, name, callback) => {
  object.on(name, callback)
  return () => {
    object.removeListener(name, callback)
  }
}

const eventRace = (eventMap) => {
  const names = Object.keys(eventMap)
  const unregisterMap = {}
  let called = false

  const visit = (name) => {
    const { register, callback } = eventMap[name]

    const unregister = register((...args) => {
      called = true
      // this event unregister all other event because this one hapenned
      const otherNames = names.filter((otherName) => otherName !== name)
      otherNames.forEach((otherName) => {
        unregisterMap[otherName]()
      })
      return callback(...args)
    })

    unregisterMap[name] = unregister
  }

  let i = 0
  while (i < names.length) {
    const name = names[i]
    visit(name)
    if (called) {
      break
    }
    i++
  }
}

const startServer = async ({ cancellation = cancellationNone } = {}) => {
  await cancellation.toPromise()

  const server = http.createServer()

  const close = (reason) =>
    new Promise((resolve, reject) => {
      server.once("close", (error) => {
        if (error) {
          reject(error)
        } else {
          resolve(`server closed because ${reason}`)
        }
      })
      server.close()
    })

  await new Promise((resolve, reject) => {
    eventRace({
      cancel: {
        register: cancellation.register,
        callback: async (reason) => {
          // we must wait for the server to be listening before being able to close it
          await new Promise((resolve) => {
            registerEvent(server, "listening", resolve)
          })
          return close(reason)
        },
      },
      error: {
        register: (callback) => registerEvent(server, "error", callback),
        callback: reject,
      },
      listen: {
        register: (callback) => registerEvent(server, "listening", callback),
        callback: resolve,
      },
    })

    server.listen(3000, "127.0.0.1")
  })

  // we are listening we can close without checking for listening
  cancellation.register(close)
  process.on("exit", close)

  server.on("request", (request, response) => {
    response.writeHead(200)
    response.end()
  })
}

const requestServer = async ({ cancellation = cancellationNone } = {}) => {
  await cancellation.toPromise()

  const request = http.request({
    port: 3000,
    hostname: "127.0.0.1",
  })

  return new Promise((resolve, reject) => {
    eventRace({
      cancel: {
        register: cancellation.register,
        callback: (reason) => {
          return new Promise((resolve, reject) => {
            registerEvent(request, "abort", () => {
              resolve(`request aborted because ${reason}`)
            })
            // https://nodejs.org/docs/latest-v8.x/api/http.html#http_http_request_options_callback
            registerEvent(request, "error", (error) => {
              if (error && error.message === "socket hang up" && error.code === "ECONNRESET") {
              } else {
                reject(error)
              }
            })
            request.abort()
          })
        },
      },
      response: {
        register: (callback) => registerEvent(request, "response", callback),
        callback: resolve,
      },
      error: {
        register: (callback) => registerEvent(request, "error", callback),
        callback: reject,
      },
    })

    request.end()
  })
}

// {
//   const exec = async () => {
//     const serverPromise = startServer()
//     await serverPromise
//     const responsePromise = requestServer()
//     return await responsePromise
//   }
//   exec().then(({ statusCode }) => {
//     assert.equal(statusCode, 200)
//     console.log("passed")
//   })
// }

// {
//   const { cancellation, cancel } = createCancel()
//   const exec = async () => {
//     cancel("cancel").then((values) => {
//       assert.deepEqual(values, [])
//     })
//     const serverPromise = startServer({ cancellation })
//     await serverPromise
//     const responsePromise = requestServer({ cancellation })
//     return await responsePromise
//   }
//   exec().then(() => {
//     assert.fail("must not be called")
//     console.log("passed")
//   })
// }

// {
//   const { cancellation, cancel } = createCancel()

//   const exec = async () => {
//     const serverPromise = startServer({ cancellation })
//     await new Promise((resolve) => setTimeout(resolve))
//     cancel("cancel").then((values) => {
//       assert.deepEqual(values, ["server closed because cancel"])
//       console.log("passed")
//     })
//     await serverPromise
//     const responsePromise = requestServer({ cancellation })
//     await responsePromise
//     assert.fail("must not be called")
//   }
//   exec().then(() => {
//     assert.fail("must not be called")
//   })
// }

// {
//   const { cancellation, cancel } = createCancel()

//   const exec = async () => {
//     const serverPromise = startServer({ cancellation })
//     await serverPromise
//     cancel("cancel").then((values) => {
//       assert.deepEqual(values, ["server closed because cancel"])
//       console.log("passed")
//     })
//     const responsePromise = requestServer({ cancellation })
//     await responsePromise
//   }
//   exec().then(() => {
//     assert.fail("must not be called")
//   })
// }

// {
//   const { cancellation, cancel } = createCancel()

//   const exec = async () => {
//     const serverPromise = startServer({ cancellation })
//     await serverPromise
//     const responsePromise = requestServer({ cancellation })
//     await new Promise((resolve) => setTimeout(resolve))
//     cancel("cancel").then((values) => {
//       assert.deepEqual(values, ["request aborted because cancel", "server closed because cancel"])
//       console.log("passed")
//     })
//     await responsePromise
//   }
//   exec().then(() => {
//     assert.fail("must not be called")
//   })
// }

{
  const { cancellation, cancel } = createCancel()

  const exec = async () => {
    const serverPromise = startServer({ cancellation })
    await serverPromise
    const responsePromise = requestServer({ cancellation })
    return await responsePromise
  }
  exec().then(({ statusCode }) => {
    assert.equal(statusCode, 200)
    cancel("cancel").then((values) => {
      assert.deepEqual(values, ["server closed because cancel"])
      console.log("passed")
    })
  })
}
