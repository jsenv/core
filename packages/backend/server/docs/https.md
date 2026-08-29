# HTTPS

```js
import { startServer } from "@jsenv/server";

const server = await startServer();
server.origin.startsWith("http://"); // true
```

```js
import { readFileSync } from "node:fs";
import { startServer } from "@jsenv/server";

const server = await startServer({
  https: {
    certificate: readFileSync(new URL("./server.crt", import.meta.url), "utf8"),
    privateKey: readFileSync(new URL("./server.key", import.meta.url), "utf8"),
  },
});
server.origin.startsWith("https://"); // true
```

Without certificate files, [@jsenv/https-local](https://github.com/jsenv/core/tree/main/packages/tooling/https-local) generates one for localhost, signed by an authority it can install on the machine:

```js
import { requestCertificate } from "@jsenv/https-local";
import { startServer } from "@jsenv/server";

const { certificate, privateKey } = requestCertificate();
await startServer({ https: { certificate, privateKey } });
```

## Http requests on an https server

By default an https server also accepts http on the same port and redirects it (301) to the https origin. `redirectHttpToHttps: false` refuses http instead. To serve both:

```js
await startServer({
  https: { certificate, privateKey },
  allowHttpRequestOnHttps: true,
  routes: [
    {
      endpoint: "GET *",
      fetch: (request) => {
        return new Response(
          request.origin.startsWith("http:")
            ? `Welcome http user`
            : `Welcome https user`,
        );
      },
    },
  ],
});
```

## http2

```js
await startServer({
  https: { certificate, privateKey },
  http2: true,
});
```

Http2 needs https (browsers do not speak it in clear). Http/1.1 clients are still accepted, unless `http1Allowed: false`.

**When it is worth it.** A browser opens at most 6 http/1.1 connections per origin, http2 multiplexes everything on one. Measured with Chromium loading a page of 300 ES modules served by this package:

| network                               | http/1.1 | http2  |
| ------------------------------------- | -------- | ------ |
| localhost                             | 80 ms    | 83 ms  |
| 5 ms of latency (a phone on the wifi) | 369 ms   | 131 ms |
| 20 ms of latency                      | 1300 ms  | 135 ms |

Nothing to gain on the machine itself; a lot as soon as there is latency, so serving other devices (`acceptAnyIp`) is the case for it. The price is a certificate the device trusts.

**What is lost.** Http2 has no reason phrase (RFC 9113): the `statusText` of a response only reaches the server logs and the body of 4xx/5xx responses, browser devtools show the status code alone. Http/1.1 stays the default for that reason: during development the status line is where the server explains a 404 or a 403 at a glance.
