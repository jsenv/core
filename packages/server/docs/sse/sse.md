# SSE (Server Sent Events)

_server.js_

```js
import { startServer, createSSERoom } from "@jsenv/server"

const room = createSSERoom()
setInterval(() => {
  room.sendEventToAllClients({
    type: "ping",
  })
}, 1000)

startServer({
  protocol: "https",
  port: 3456,
  requestToResponse: (request) => {
    const { accept = "" } = request.headers
    if (!accept.includes("text/event-stream")) {
      return null
    }
    return room.join(request)
  },
})
```

_client.js_

```js
import { createRequire } from "module"

const require = createRequire(import.meta.url)

const EventSource = require("eventsource")

const eventSource = new EventSource("https://localhost:3456", {
  https: { rejectUnauthorized: false },
})

eventSource.addEventListener("ping", ({ lastEventId }) => {
  console.log("> ping from server", { lastEventId })
})
```

_run.js_

```js
import("./server.js")
import("./client.js")
```

![Screencast of server sent events execution in a terminal](./sse-screencast.gif)
