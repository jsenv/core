# WebSocket

A route accepts a websocket by returning a `WebSocketResponse`:

_server.js_

```js
import {
  createFileSystemFetch,
  startServer,
  WebSocketResponse,
} from "@jsenv/server";

await startServer({
  port: 3000,
  routes: [
    {
      endpoint: "GET /chat.websocket",
      fetch: () => {
        return new WebSocketResponse((websocket) => {
          websocket.send("Hello world");
          websocket.on("message", (data) => {
            websocket.send(data);
          });
          return () => {
            // the client is gone
          };
        });
      },
    },
    {
      endpoint: "GET *",
      fetch: createFileSystemFetch(import.meta.resolve("./")),
    },
  ],
});
```

_client.html_

```html
<!doctype html>
<html lang="en">
  <head>
    <title>Title</title>
    <link rel="icon" href="data:," />
  </head>

  <body>
    <script>
      const websocket = new WebSocket("ws://localhost:3000/chat.websocket");
      websocket.onmessage = (message) => {
        document.body.appendChild(document.createTextNode(message.data));
      };
    </script>
  </body>
</html>
```

A route is a websocket route when its endpoint ends with `.websocket` or its `headers` pattern has `upgrade: "websocket"`; a plain request to it is answered 426. The handler receives the [ws](https://github.com/websockets/ws/blob/master/doc/ws.md) socket once the upgrade is done; if it returns a function, that function runs when the socket closes.

A websocket route can still refuse the upgrade by returning a regular response (a 401 for instance). Returning anything but a `WebSocketResponse` with status 101 from a websocket route is an error, and so is returning a `WebSocketResponse` to a request that did not ask for an upgrade.

`server.webSocketOrigin` is the `ws://` (or `wss://`) origin of the server. To broadcast to many clients, see [server sent events](./server_sent_events.md): `ServerEvents` accepts websocket clients too.
