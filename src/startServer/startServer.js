import http from "http"
import https from "https"
import { URL } from "url"
import { createAction, all } from "@dmail/action"
import { createSelfSignature } from "./createSelfSignature.js"
import { listenNodeBeforeExit } from "./listenNodeBeforeExit.js"
import { addNodeExceptionHandler } from "./addNodeExceptionHandler.js"

export const startServer = ({
	// by default listen localhost on a random port in https
	url = "https://127.0.0.1:0",
	// when port is https you must provide privateKey & certificate
	getSignature = createSelfSignature,
	// auto close the server when the process exits (terminal closed, ctrl + C)
	autoCloseOnExit = true,
	// auto close the server when an uncaughtException happens
	// false by default because evenwith my strategy to react on uncaughtException
	// stack trace is messed up and I don't like to have code executed on error
	autoCloseOnCrash = false,
	// auto close when server respond with a 500
	autoCloseOnError = true,
} = {}) => {
	url = new URL(url)

	const protocol = url.protocol
	const hostname = url.hostname

	if (hostname === "0.0.0.0" && process.platform === "win32") {
		// https://github.com/nodejs/node/issues/14900
		throw new Error(`listening ${hostname} any not available on window`)
	}

	let nodeServer
	let agent
	if (protocol === "http:") {
		nodeServer = http.createServer()
		agent = global.Agent
	} else if (protocol === "https:") {
		const { privateKey, certificate } = getSignature()
		nodeServer = https.createServer({
			key: privateKey,
			cert: certificate,
		})
		agent = new https.Agent({
			rejectUnauthorized: false, // allow self signed certificate
		})
	} else {
		throw new Error(`unsupported protocol ${protocol}`)
	}

	const port = url.port

	const connections = new Set()
	nodeServer.on("connection", (connection) => {
		connection.on("close", () => {
			connections.delete(connection)
		})
		connections.add(connection)
	})

	const requestHandlers = []
	const addRequestHandler = (requestHandler) => {
		requestHandlers.push(requestHandler)
		nodeServer.on("request", requestHandler)
	}

	const clients = new Set()

	const closeClients = ({ isError = false, reason = "closing" } = {}) => {
		let status
		if (isError) {
			status = 500
			// reason = 'shutdown because error'
		} else {
			status = 503
			// reason = 'available because closing'
		}

		return all(
			Array.from(clients).map(({ response }) => {
				if (response.headersSent === false) {
					response.writeHead(status, reason)
				}

				const action = createAction()
				const { pass } = action
				if (response.finished === false) {
					response.on("finish", pass)
					response.on("error", pass)
					response.destroy(reason)
				} else {
					pass()
				}

				return action
			}),
		)
	}

	addRequestHandler((request, response) => {
		const client = { request, response }

		clients.add(client)
		response.on("finish", () => {
			clients.delete(client)
			if (autoCloseOnError && response.statusCode === 500) {
				closeClients({
					isError: true,
					// we don't specify the true error object but only a string
					// identifying the error to avoid sending stacktrace to client
					// and right now there is no clean way to retrieve error from here
					reason: response.statusMessage || "internal error",
				})
			}
		})
	})

	let status = "opening"

	const listen = () => {
		const action = createAction()
		nodeServer.listen(port, hostname, (error) => {
			if (error) {
				throw error
			}
			action.pass()
		})
		return action
	}

	return listen().then(() => {
		status = "opened"

		// in case port is 0 (randomly assign an available port)
		// https://nodejs.org/api/net.html#net_server_listen_port_host_backlog_callback
		const port = nodeServer.address().port
		url.port = port

		const closeConnections = (reason) => {
			// should we do this async ?
			// should we do this before closing the server ?
			connections.forEach((connection) => {
				connection.destroy(reason)
			})
		}

		let close = (reason) => {
			if (status !== "opened") {
				throw new Error(`server status must be "opened" during close() (got ${status}`)
			}

			// ensure we don't try to handle request while server is closing
			requestHandlers.forEach((requestHandler) => {
				nodeServer.removeListener("request", requestHandler)
			})
			requestHandlers.length = 0

			status = "closing"

			const action = createAction()
			// closing server prevent it from accepting new connections
			// but opeed connection must be shutdown before the close event is emitted
			nodeServer.once("close", (error) => {
				if (error) {
					throw error
				} else {
					action.pass()
				}
			})
			nodeServer.close()
			closeClients({ reason }).then(() => {
				closeConnections(reason)
			})

			return action.then(() => {
				status = "closed"
			})
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
			addNodeExceptionHandler(() => {
				return close().then(() => false)
			})
		}

		return {
			url,
			nodeServer,
			addRequestHandler,
			agent,
			close,
		}
	})
}

export const listenRequest = (nodeServer, requestHandler) => {
	nodeServer.on("request", requestHandler)
}
