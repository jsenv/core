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

export const startServer = ({ url, handler, autoCloseOnExit = true } = {}) => {
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
	nodeServer.on("request", (request, response) => {
		handler(request, response)
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

		const close = () => {
			if (status !== "opened") {
				throw new Error(`server status must be "opened" during close() (got ${status}`)
			}

			status = "closing"
			return new Promise((resolve, reject) => {
				nodeServer.close(createExecutorCallback(resolve, reject))
			}).then(() => {
				status = "closed"

				connections.forEach((connection) => {
					connection.destroy()
				})
			})
		}

		const properties = {
			url,
		}

		if (autoCloseOnExit) {
			const removeAutoClose = listenNodeBeforeExit(close)
			return {
				...properties,
				close: () => {
					removeAutoClose()
					return close()
				},
			}
		}

		return { ...properties, close }
	})
}
