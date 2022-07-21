import { startServer, fetchFileSystem } from "@jsenv/server"

await startServer({
  services: [
    {
      handleRequest: (request) => {
        return fetchFileSystem(
          new URL(request.ressource.slice(1), import.meta.url),
        )
      },
    },
  ],
})
