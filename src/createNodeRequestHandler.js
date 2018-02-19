// https://github.com/jsenv/core/tree/master/src/util/rest

import { URL } from "url"
import { createBody } from "./createBody.js"
import { createHeaders } from "./createHeaders.js"

export const createRequestFromNodeRequest = (nodeRequest, serverURL) => {
	const { method } = nodeRequest
	const url = new URL(nodeRequest.url, serverURL).toString()
	const headers = createHeaders(nodeRequest.headers)
	const body = createBody(
		method === "POST" || method === "PUT" || method === "PATCH" ? nodeRequest : undefined,
	)

	return {
		method,
		url,
		headers,
		body,
	}
}

export const populateNodeResponse = (nodeResponse, { status, reason, headers, body }) => {
	nodeResponse.writeHead(status, reason, headers.toJSON())

	const keepAlive = headers.get("connection") === "keep-alive"
	body.pipeTo(nodeResponse, { preventClose: keepAlive })
}

export const createNodeRequestHandler = (handler) => {
	return (nodeRequest, nodeResponse) => {
		const request = createRequestFromNodeRequest(nodeRequest)
		console.log(request.method, request.url.toString())

		return handler(request)
			.catch((e) => {
				return {
					status: 500,
					headers: createHeaders(),
					body: createBody(String(e)),
				}
			})
			.then((response) => {
				if (request.method === "HEAD") {
					// don't send body for HEAD requests
					response.body = createBody()
				}
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
