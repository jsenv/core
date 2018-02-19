import { listenNodeBeforeExit } from "./listenNodeBeforeExit.js"
import http from "http"
import https from "https"
import { URL } from "url"

// note you can do this: startServer({ url: "0.0.0.0:0" })
// it will listen any request to random port

const createExecutorCallback = (resolve, reject) => {
	return (error) => {
		if (error) {
			reject(error)
		} else {
			resolve()
		}
	}
}

const createServerFromProtocol = (protocol) => {
	if (protocol === "http:") {
		return http.createServer()
	}
	if (protocol === "https:") {
		return https.createServer()
	}
	throw new Error(`unsupported protocol ${protocol}`)
}

export const startServer = ({ url, autoCloseOnExit = true, autoCloseOnCrash = true } = {}) => {
	url = new URL(url)

	const protocol = url.protocol
	const hostname = url.hostname
	const port = url.port
	const nodeServer = createServerFromProtocol(protocol)

	const connections = new Set()
	nodeServer.on("connection", (connection) => {
		connection.on("close", () => {
			connections.delete(connection)
		})
		connections.add(connection)
	})

	const clients = new Set()
	nodeServer.on("request", (request, response) => {
		const client = { request, response }

		clients.add(client)
		response.on("finish", () => {
			clients.delete(client)
		})
	})

	let status = "opening"
	return new Promise((resolve, reject) => {
		nodeServer.listen(port, hostname, createExecutorCallback(resolve, reject))
	}).then(() => {
		status = "opened"

		// in case port is 0 (randomly assign an available port)
		// https://nodejs.org/api/net.html#net_server_listen_port_host_backlog_callback
		const port = nodeServer.address().port
		url.port = port

		const closeClients = (reason) => {
			return Promise.all(
				Array.from(clients).map(({ response }) => {
					return new Promise((resolve) => {
						if (response.headersSent === false) {
							if (reason) {
								response.writeHead(500)
							} else {
								response.writeHead(503) // unavailable
							}
						}
						if (response.finished === false) {
							response.on("finish", () => resolve())
							response.end(reason)
						} else {
							resolve()
						}
					})
				}),
			)
		}

		const closeConnections = (reason) => {
			// should we do this async ?
			// should we do this before closing the server ?
			connections.forEach((connection) => {
				connection.destroy(reason)
			})
		}

		const closeServer = () => {
			return new Promise((resolve, reject) => {
				nodeServer.close(createExecutorCallback(resolve, reject))
			})
		}

		let close = (reason) => {
			if (status !== "opened") {
				throw new Error(`server status must be "opened" during close() (got ${status}`)
			}

			status = "closing"
			return closeClients(reason)
				.then(() => closeServer())
				.then(() => closeConnections(reason))
				.then(() => {
					status = "closed"
				})
		}

		const addRequestHandler = (requestHandler) => {
			nodeServer.on("request", requestHandler)
		}

		const properties = {
			url,
			nodeServer,
			addRequestHandler,
		}

		if (autoCloseOnExit) {
			const removeAutoClose = listenNodeBeforeExit(close)
			const wrappedClose = close
			close = () => {
				removeAutoClose()
				return wrappedClose()
			}
		}

		if (autoCloseOnCrash) {
			process.on("uncaughtException", () => {
				close()
			})
		}

		return { ...properties, close }
	})
}

export const listenRequest = (nodeServer, requestHandler) => {
	nodeServer.on("request", requestHandler)
}
