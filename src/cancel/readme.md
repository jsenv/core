# cancel

[![npm](https://badge.fury.io/js/%40dmail%2Fcancel.svg)](https://badge.fury.io/js/%40dmail%2Fcancel)
[![build](https://travis-ci.org/dmail/cancel.svg?branch=master)](http://travis-ci.org/dmail/cancel)
[![codecov](https://codecov.io/gh/dmail/cancel/branch/master/graph/badge.svg)](https://codecov.io/gh/dmail/cancel)

> Cancel your promise, compatible with await

## Installing

```shell
npm install @dmail/cancel
```

## Example

The code below starts a server at `http://120.0.0.1:3000` and request it afterwards.
Cancellation is opt-in and once you provide a cancellation you can cancel at any time.

```js
import { cancellationNone } from "@dmail/cancel"
import { http } from "http"

const startServer = ({ cancellation = cancellationNone } = {}) => {
  return cancellation.wrap((register) => {
    const server = http.createServer()

    const listen = new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", (error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })

    await listen()

    const close = (reason) => new Promise((resolve, reject) => {
      server.once("close", (error) => {
        if (error) {
          reject(error)
        } else {
          resolve(`server closed because ${reason}`)
        }
      })
      server.close()
    })
    register(close)

    server.on("request", (request, response) => {
      response.writeHead(200)
      response.end()
    })
  })
}

const requestServer = ({ cancellation = cancellationNone } = {}) => {
  return cancellation.wrap((register) => {
    const request = http.request("http://127.0.0.1:300")
    const abort = (reason) => new Promise((resolve) => {
      request.on("abort", () => {
        resolve(`request aborted because ${reason}`)
      })
      request.abort()
    })
    const unregister = register(abort)

    return new Promise((resolve, reject) => {
      request.on("response", (response) => {
        resolve(response)
        unregister()
      })
      request.on("error", (error) => {
        reject(error)
        unregister()
      })
    })
  })
}
```

Please find below each cancellation scenario:

### You will never use cancel()

```js
const serverPromise = startServer()
await serverPromise
const responsePromise = requestServer()
await responsePromise
```

* serverPromise resolved when server is listening
* responsePromise resolved when client got response from server

### Cancel before startServer

```js
const { cancellation, cancel } = createCancel()

const cancelPromise = cancel()
const serverPromise = startServer({ cancellation })
await serverPromise
```

* cancel() does nothing special
* cancellation.wrap() inside startServer returns a promise pending forever
* serverPromise is pending forever
* cancelPromise is resolved to `[]`

### Cancel during startServer

```js
const { cancellation, cancel } = createCancel()

const serverPromise = startServer({ cancellation })
const cancelPromise = cancel('cancel')
await serverPromise
```

* cancellation.wrap() inside startServer returns serverPromise
* server starts to listen (it's not listening)
* cancel() forces serverPromise to be pending forever
* cancellation.wrap() inside startServer force cancel to wait server to be listening before cancelling
* server is listening
* server starts to close
* server is closed
* cancelPromise is resolved to `["server closed because cancel"]`

### Cancel after startSserver

```js
const { cancellation, cancel } = createCancel()

const serverPromise = startServer({ cancellation })
await serverPromise
const cancelPromise = cancel('cancel')
const requestPromise = requestServer({ cancellation })
```

* server is listening
* cancel() starts to close server
* cancellation.wrap() inside requestServer returns a promise pending forever
* requestPromise is pending forever
* server is closed
* cancelPromise is resolved to `["server closed because cancel"]`

### Cancel during request

```js
const { cancellation, cancel } = createCancel()

const serverPromise = startServer({ cancellation })
await serverPromise
const requestPromise = requestServer({ cancellation })
const cancelPromise = cancel()
```

* cancellation.wrap() inside requestServer returns a special promise
* requestServer() create an http request
* cancel() forces requestPromise to be pending forever
* cancel() calls request.abort()
* request starts to abort
* request is aborted
* server starts to close
* server is closed
* cancelPromise is resolved to `["request aborted because cancel", "server closed because cancel"]`

### Cancel after request

```js
const { cancellation, cancel } = createCancel()

const serverPromise = startServer({ cancellation })
await serverPromise
const requestPromise = requestServer({ cancellation })
await requestPromise
const cancelPromise = cancel()
```

* server is litening and request is done
* cancel() start closing server
* server is closed
* cancelPromise is resolved to `["server closed because cancel"]`

## Licensing

MIT
