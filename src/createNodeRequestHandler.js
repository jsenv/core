// https://github.com/jsenv/core/tree/master/src/util/rest

import { URL } from "url"
import { createBody } from "./createBody.js"
import { createHeaders } from "./createHeaders.js"
import { passed } from "@dmail/action"

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

		return passed(handler(request)).then(
			(response) => {
				response = createResponse(request, response)
				console.log(`${response.status} ${request.url}`)
				populateNodeResponse(nodeResponse, response)
			},
			(response) => {
				response = createResponse(request, response)
				console.log(`${response.status} ${request.url}`)
				populateNodeResponse(nodeResponse, response)
			},
		)
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
