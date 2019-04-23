import { createStoppableOperation } from "@dmail/cancellation"

export const listen = ({ cancellationToken, server, port, ip }) => {
  return createStoppableOperation({
    cancellationToken,
    start: () => startListening(server, port, ip),
    stop: () => stopListening(server),
  })
}

export const startListening = (server, port, ip) =>
  new Promise((resolve, reject) => {
    server.on("error", reject)
    server.on("listening", () => {
      // in case port is 0 (randomly assign an available port)
      // https://nodejs.org/api/net.html#net_server_listen_port_host_backlog_callback
      resolve(server.address().port)
    })
    server.listen(port, ip)
  })

export const stopListening = (server) =>
  new Promise((resolve, reject) => {
    server.on("error", reject)
    server.on("close", resolve)
    server.close()
  })
