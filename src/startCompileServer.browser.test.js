import { startCompileServer } from "./startCompileServer.js"
import { startServer } from "./startServer/startServer.js"
import { all, fromPromise } from "@dmail/action"
import path from "path"
import puppeteer from "puppeteer"
import cuid from "cuid"
import { writeFileFromString } from "./writeFileFromString.js"
import test from "@dmail/test"

const startClient = () => {
	// https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md

	return fromPromise(
		puppeteer
			.launch({
				ignoreHTTPSErrors: true, // because we use a self signed certificate
				// handleSIGINT: true,
				// handleSIGTERM: true,
				// handleSIGHUP: true,
				// because the 3 above are true by default pupeeter will auto close browser
				// so we apparently don't have to use listenNodeBeforeExit in order to close browser
				// as we do for server
			})
			.then((browser) => {
				return browser.newPage().then((page) => {
					return { browser, page }
				})
			}),
	)
}

const createIndexHTML = () => {
	return `<!doctype html>
<head>
		<title>startCompileServer index</title>
		<meta charset="utf-8" />
</head>

<body>
		<main>
		</main>
</body>

</html>`
}

const testInBrowser = (code) => {
	const filename = `${cuid()}.js`

	return all([
		writeFileFromString(filename, code),
		startServer().then((indexServer) => {
			indexServer.addRequestHandler((request, response) => {
				const html = createIndexHTML()
				response.writeHead(200, {
					"content-length": Buffer.byteLength(html),
					"content-type": "text/html",
				})
				response.end(html)
			})
			return indexServer
		}),
		startCompileServer({
			location: `${path.resolve(__dirname, "../../src/__test__")}`,
		}),
		startClient(),
	]).then(([indexServer, compileServer, client]) => {
		return fromPromise(
			client.page.goto(indexServer.url.href).then(() => {
				const loadScriptTag = (url) => {
					client.page.addScriptTag(url)
				}

				// faut que le serveur static renvoit ce fichier
				// et pas seulement le fichier d'index
				return loadScriptTag("./createLoader/createBrowserLoader/index.global.js").then(() => {
					return client.page.evaluate((compileServerHref) => {
						window.System = window.createBrowserLoader({ base: compileServerHref })
						return fromPromise(System.import(filename))
					}, compileServer.url.href)
				})
			}),
		).then((value) => {
			return all([indexServer.close(), compileServer.close(), client.browser.close()]).then(
				() => value,
			)
		})
	})
}

test(() =>
	testInBrowser(`
import value from './file.js'

if (value !== true) {
	throw new Error('must be true')
}
`),
)
