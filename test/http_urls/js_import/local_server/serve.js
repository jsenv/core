import { startServer, fetchFileSystem, pluginCORS } from "@jsenv/server"

const serverDirectoryUrl = new URL("./client/", import.meta.url)

export const localServer = await startServer({
  logLevel: "warn",
  port: 9999,
  requestToResponse: async (request) => {
    const fileUrl = new URL(request.ressource.slice(1), serverDirectoryUrl)
    const response = await fetchFileSystem(fileUrl, {
      ...request,
    })
    return response
  },
  keepProcessAlive: false,
  plugins: {
    ...pluginCORS({
      accessControlAllowRequestOrigin: true,
      accessControlAllowRequestMethod: true,
      accessControlAllowRequestHeaders: true,
      accessControlAllowCredentials: true,
    }),
  },
})
