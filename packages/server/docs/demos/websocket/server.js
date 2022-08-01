import { startServer, fetchFileSystem } from "@jsenv/server"

await startServer({
  port: 3000,
  services: [
    {
      handleRequest: (request) => {
        return fetchFileSystem(
          new URL(request.resource.slice(1), import.meta.url),
          request,
        )
      },
      handleWebsocket: (websocket) => {
        websocket.send("Hello world")
      },
    },
  ],
})
