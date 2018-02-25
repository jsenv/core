// https://github.com/jsenv/core/tree/master/src/util/rest

import { URL } from "url"
import { createBody } from "./createBody.js"
import { createHeaders } from "./createHeaders.js"

// serverURL pourrait valoir par défaut `file:///${process.cwd()}` ?
export const createRequestFromNodeRequest = (nodeRequest, serverURL) => {
	const { method } = nodeRequest
	const url = new URL(nodeRequest.url, serverURL)
	const headers = createHeaders(nodeRequest.headers)
	const body = createBody(
		method === "POST" || method === "PUT" || method === "PATCH" ? nodeRequest : undefined,
	)

	return Object.freeze({
		method,
		url,
		headers,
		body,
	})
}

export const populateNodeResponse = (nodeResponse, { status, reason, headers, body }) => {
	nodeResponse.writeHead(status, reason, headers.toJSON())

	const keepAlive = headers.get("connection") === "keep-alive"
	body.pipeTo(nodeResponse, { preventClose: keepAlive })
}

const createResponse = (
	{ method },
	{ status, reason, headers = createHeaders(), body = createBody() },
) => {
	if (method === "HEAD") {
		// don't send body for HEAD requests
		body = createBody()
	} else {
		body = createBody(body)
	}

	headers = createHeaders(headers)

	return Object.freeze({ status, reason, headers, body })
}

export const createNodeRequestHandler = (handler, serverURL) => {
	return (nodeRequest, nodeResponse) => {
		const request = createRequestFromNodeRequest(nodeRequest, serverURL)
		console.log(request.method, request.url.toString())

		return Promise.resolve(handler(request))
			.catch((e) => {
				// I'm not fan of this because currently server will continue to be up in an unexpected state
				// so @dmail/action should be favored and exception ignored
				// instead a process should spawn the server and listen when it crashes to respond with 500
				// maybe an easy way to do this would be to use a proxy?
				// or even simpler the process in charge of providing a response is not a server
				// so it's allowed to throw and be killed but in that case server will only respond with 500
				return {
					status: 500,
					reason: "internal server error",
					body: String(e),
				}
			})
			.then((response) => {
				response = createResponse(request, response)
				console.log(`${response.status} ${request.url}`)
				populateNodeResponse(nodeResponse, response)
			})
	}
}

export const enableCORS = (headers) => {
	const corsHeaders = {
		"access-control-allow-origin": "*",
		"access-control-allow-methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"].join(", "),
		"access-control-allow-headers": ["x-requested-with", "content-type", "accept"].join(", "),
		"access-control-max-age": 1, // Seconds
	}

	Object.keys(corsHeaders).forEach((corsHeaderName) => {
		headers.append(corsHeaderName, corsHeaders[corsHeaderName])
	})
}
