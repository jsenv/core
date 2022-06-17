# Server timing

Server timing consists into sending headers in the response concerning the server performances. When looking at network panel in chrome devtools you can find a metric called TTFB (Time To First Byte). Without server timing you won't be able to know what your server was doing during that period. Read more in https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server-Timing

_Screenshot TTFB in chrome devtools:_

> Chrome devtools are saying TTFB took 45.80ms.

![screenshot of chrome devtools TTFB](./screenshot-devtools-TTFB.png)

_Screenshot server timing in chrome devtools:_

> Server timing tells chrome devtools what server was doing during `45.80ms`: `43.16ms` were needed by something called `service:compiled files`.

![screenshot of chrome devtools server timing](./screenshot-devtools-timing.png)

## Measuring service timings

Using both _composeServices_ and _pluginServerTimings_ measures time taken by each function.

```js
import {
  startServer,
  composeServices,
  pluginServerTimings,
} from "@jsenv/server"

const noContentService = (request) => {
  if (request.ressource !== "/") return null
  return { status: 204 }
}

const okService = (request) => {
  if (request.ressource !== "/whatever") return null
  return { status: 200 }
}

await startServer({
  plugins: {
    ...pluginServerTimings(),
  },
  requestToResponse: composeServices({
    "service:nocontent": noContentService,
    "service:ok": okService,
  }),
})
```

Code above generates a server timing response header that looks like this:

```console
server-timing: a;desc="service:nocontent";dur=0.007546901, b;desc="service:ok";dur=0.0018849
```

You can also measure time taken by a function using _timeFunction_ exports and returning a _timing_ property.

```js
import { startServer, pluginServerTimings, timeFunction } from "@jsenv/server"

await startServer({
  plugins: {
    ...pluginServerTimings(),
  },
  requestToResponse: async () => {
    const [waitTiming] = await timeFunction("waiting 50ms", async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 50)
      })
    })
    const [getMessageTiming, message] = await timeFunction(
      "get message",
      () => "hello",
    )

    return {
      status: 200,
      headers: {
        "content-type": "text/plain",
      },
      body: message,
      timing: {
        ...waitTiming,
        ...getMessageTiming,
      },
    }
  },
})
```

Code aboves generates a server timing response headers that looks as below

```console
server-timing: a;desc="waiting 50ms";dur=50.7546901, b;desc="get message";dur=0.0018849
```
