import { createNodeRequestHandler } from "./createNodeRequestHandler.js"
import { startServer } from "./startServer.js"
import { test } from "@dmail/test"
import fetch from "node-fetch"
import assert from "assert"

test(() => {
	return startServer({
		url: "http://localhost:0",
	}).then(({ close, addRequestHandler, url }) => {
		const nodeRequestHandler = createNodeRequestHandler(() => {
			// as we can see the whole concept behind createNodeRequestHandler
			// is to avoid using response methods directly but rather
			// return POJO that takes care of using response methods
			return {
				status: 200,
				headers: {
					"content-length": 2,
				},
				body: "ok",
			}
		}, url)

		addRequestHandler(nodeRequestHandler)

		return fetch(url)
			.then((response) => response.text())
			.then((text) => {
				assert.equal(text, "ok")
				return close()
			})
	})
})
