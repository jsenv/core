import { startServer } from "./startServer.js"
import { test } from "@dmail/test"
import fetch from "node-fetch"
import assert from "assert"

test(() => {
	return startServer({
		url: "http://localhost:0",
		handler: (request, response) => {
			response.writeHead(200, { "Content-Type": "text/plain" })
			response.end("ok")
		},
	}).then(({ close, url }) => {
		return fetch(url)
			.then((response) => response.text())
			.then((text) => {
				assert.equal(text, "ok")
				return close()
			})
	})
})
