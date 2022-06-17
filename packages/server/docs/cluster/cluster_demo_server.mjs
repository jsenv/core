import { startServer, fetchFileSystem } from "@jsenv/server"

await startServer({
  requestToResponse: (request) => {
    return fetchFileSystem(new URL(request.ressource.slice(1), import.meta.url))
  },
})
