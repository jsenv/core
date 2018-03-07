import { startCompileServer } from "./startCompileServer.js"
import { startServer } from "./startServer/startServer.js"
import { all, fromPromise } from "@dmail/action"
import path from "path"
import puppeteer from "puppeteer"
import cuid from "cuid"
import { writeFileFromString } from "./writeFileFromString.js"
import test from "@dmail/test"

const startBrowserPage = () => {
	// https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md

	return fromPromise(
		puppeteer
			.launch({
				ignoreHTTPSErrors: true, // because we use a self signed certificate
				// true by default, puppeeter will auto close browser
				// so we apparently don't have to use listenNodeBeforeExit here
				// handleSIGINT: true,
				// handleSIGTERM: true,
				// handleSIGHUP: true,
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
		startBrowserPage(),
	]).then(([indexServer, compileServer, client]) => {
		return fromPromise(
			client.page.goto(indexServer.url.href).then(() => {
				const loadScriptTag = (url) => {
					if (url) {
						return client.page.addScriptTag(url)
					}
					return Promise.resolve()
				}

				// ici faudrais loader un script qui fera window.createBrowserLoader = un truc
				return loadScriptTag().then(() => {
					return client.page.evaluate(
						(/* compileServerHref */) => {
							// window.System = window.createBrowserLoader({ base: compileServerHref })
							// return fromPromise(System.import(filename))
							return true
						},
						compileServer.url.href,
					)
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
