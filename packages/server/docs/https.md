# Https

The default server protocol is "http".

```js
import { startServer } from "@jsenv/server"

const server = await startServer()
server.origin.startsWith("http://") // true
```

Server can be started in "https" as shown in the code below

```js
import { readFileSync } from "node:fs"
import { startServer } from "@jsenv/server"

const server = await startServer({
  protocol: "https",
  certificate: String(readFileSync(new URL("./server.crt", import.meta.url)),
  privateKey: String(readFileSync(new URL("./server.key", import.meta.url)),
})
server.origin.startsWith("https://") // true
```

The code above assumes you have "server.crt" and "server.key" files.
If you don't have these certificate files you can use [@jsenv/https-local](https://github.com/jsenv/https-local#https-local---)
to generate a certificate dynamically.

```js
import { requestCertificate } from "@jsenv/https-local"
import { startServer } from "@jsenv/server"

const { certificate, privateKey } = requestCertificate()
const server = await startServer({
  protocol: "https",
  certificate,
  privateKey,
})
server.origin.startsWith("https://") // true
```

## Http redirection

By default, a server started in https will redirect http requests to https.

You can disable this behaviour using _redirectHttpToHttps_ parameter.

```js
import { requestCertificate } from "@jsenv/https-local"
import { startServer } from "@jsenv/server"

const { certificate, privateKey } = requestCertificate()
await startServer({
  protocol: "https",
  certificate,
  privateKey,
  redirectHttpToHttps: false,
})
```

When "http to https redirection" is disabled, the server ignores http request. If you want to do something special for request made in "http" while your server is "https", you can use _allowHttpRequestOnHttps_ parameter.

```js
import { requestCertificate } from "@jsenv/https-local"
import { startServer } from "@jsenv/server"

const { certificate, privateKey } = requestCertificate()
await startServer({
  protocol: "https",
  certificate,
  privateKey,
  redirectHttpToHttps: false,
  allowHttpRequestOnHttps: true,
  services: [
    {
      handleRequest: (request) => {
        const clientUsesHttp = request.origin.startsWith("http:")

        return {
          status: 200,
          headers: {
            "content-type": "text/plain",
          },
          body: clientUsesHttp ? `Welcome http user` : `Welcome https user`,
        }
      },
    },
  ],
})
```

## http2 (experimental)

You can enable http2 using _http2_ parameter

```js
import { requestCertificate } from "@jsenv/https-local"
import { startServer } from "@jsenv/server"

const { certificate, privateKey } = requestCertificate()
await startServer({
  protocol: "https",
  certificate,
  privateKey,
  http2: true,
})
```

When http2 is enabled, server still accepts requests made using http1.
You can disable http1 fallback using _http1Allowed_ parameter.

```js
import { requestCertificate } from "@jsenv/https-local"
import { startServer } from "@jsenv/server"

const { certificate, privateKey } = requestCertificate()
await startServer({
  protocol: "https",
  certificate,
  privateKey,
  http2: true,
  http1Allowed: false,
})
```

see [allowHTTP1 documentation on Node.js](https://nodejs.org/dist/latest-v13.x/docs/api/http2.html#http2_http2_createsecureserver_options_onrequesthandler)
