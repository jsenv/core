# WebSocket

Code below shows how server can accept web socket clients(s) and send data to these clients.

_server.js:_

```js
import { startServer, fetchFileSystem } from "@jsenv/server";

await startServer({
  port: 3000,
  routes: [
    {
      endpoint: "GET /websocket",
      websocket: () => {
        return {
          opened: (websocket) => {
            websocket.send("Hello world");
          },
        };
      },
      endpoint: "GET *",
      response: createFileSystemFetch(import.meta.resolve("./")),
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
      const websocket = new WebSocket("ws://localhost:3000/websocket");
      websocket.onmessage = (message) => {
        document.body.appendChild(document.createTextNode(message.data));
      };
    </script>
  </body>
</html>
```

Starting the server and opening `http://localhost:3000/client.html` displays a blank page with "Hello world".
