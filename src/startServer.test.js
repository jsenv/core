import { startServer } from "./startServer.js"
import { test } from "@dmail/test"
import fetch from "node-fetch"
import assert from "assert"

test(() => {
	return startServer({
		url: "http://localhost:0",
	}).then(({ close, addRequestHandler, url }) => {
		addRequestHandler((request, response) => {
			response.writeHead(200, { "Content-Type": "text/plain" })
			response.end("ok")
		})

		return fetch(url)
			.then((response) => response.text())
			.then((text) => {
				assert.equal(text, "ok")
				return close()
			})
	})
})

// ici on testera que quand on kill le child à différent moment
// on obtient bien la réponse attendu coté client
// test(() => {
// 	return startServer({
// 		url: "http://localhost:0",
// 	}).then(({ nodeServer }) => {
// 		const { child } = isolateRequestHandler(nodeServer, (request, response) => {})
// 		child.kill()
// 	})
// })
