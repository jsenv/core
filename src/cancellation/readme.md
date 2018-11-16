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
import { createCancellationToken, cancellationTokenToPromise } from "@dmail/cancel"
import { http } from "http"

const startServer = async ({ cancellationToken = createCancellationToken() } = {}) => {
  await cancellationTokenToPromise(cancellation)

  const server = http.createServer()

  const listen = () =>
    new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", (error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })

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

  const listenPromise = listen()

  cancellationToken.register((reason) => listenPromise.then(() => close(reason)))

  await listenPromise
  server.on("request", (request, response) => {
    response.writeHead(200)
    response.end()
  })
}

const requestServer = ({ cancellationToken = createCancellationToken() } = {}) => {
  await cancellationTokenToPromise(cancellation)

  const request = http.request("http://127.0.0.1:300")
  const abort = (reason) =>
    new Promise((resolve) => {
      request.on("abort", () => {
        resolve(`request aborted because ${reason}`)
      })
      request.abort()
    })
  const unregister = cancellationToken.register(abort)

  return new Promise((resolve, reject) => {
    request.on("response", (response) => {
      unregister()
      resolve(response)
    })
    request.on("error", (error) => {
      unregister()
      reject(error)
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
const { cancellation, cancel } = createCancellationSource()

const cancelPromise = cancel('cancel')
const serverPromise = startServer({ cancellation })
await serverPromise
const responsePromise = requestServer({ cancellation })
await responsePromise
```

* cancel() does nothing special
* inside startServer, cancellation.toPromise() returns a promise pending forever
* await serverPromise will never settle
* cancelPromise is resolved to `[]`

### Cancel during startServer

```js
const { token: cancellationToken, cancel } = createCancellationSource()

const serverPromise = startServer({ cancellationToken })
const cancelPromise = cancel('cancel')
await serverPromise
const responsePromise = requestServer({ cancellationToken })
await responsePromise
```

* server starts to listen (it's not listening)
* cancel() waits for server to be listening before closing it
* server is listening
* await serverPromise is resolved
* server starts to close
* inside requestServer, cancellation.toPromise() returns a promise pending forever
* await responsePromise will never settle
* server is closed
* cancelPromise is resolved to `["server closed because cancel"]`

### Cancel after startSserver

```js
const { token: cancellationToken, cancel } = createCancellationSource()

const serverPromise = startServer({ cancellationToken })
await serverPromise
const cancelPromise = cancel('cancel')
const responsePromise = requestServer({ cancellationToken })
await responsePromise
```

* cancel() starts to close server
* inside requestServer, cancellation.toPromise() returns a promise pending forever
* await responsePromise will never settle
* server is closed
* cancelPromise is resolved to `["server closed because cancel"]`

### Cancel during request

```js
const { token: cancellationToken, cancel } = createCancellationSource()

const serverPromise = startServer({ cancellationToken })
await serverPromise
const responsePromise = requestServer({ cancellationToken })
const cancelPromise = cancel()
await responsePromise
```

* requestServer() create an http request
* cancel() calls request.abort()
* await responsePromise will never settle because responsePromise will never resolve/reject
* request starts to abort
* request is aborted
* server starts to close
* server is closed
* cancelPromise is resolved to `["request aborted because cancel", "server closed because cancel"]`

### Cancel after request

```js
const { token: cancellationToken, cancel } = createCancellationSource()

const serverPromise = startServer({ cancellationToken })
await serverPromise
const responsePromise = requestServer({ cancellationToken })
await responsePromise
const cancelPromise = cancel()
```

* cancel() start closing server
* server is closed
* cancelPromise is resolved to `["server closed because cancel"]`

## Licensing

MIT
