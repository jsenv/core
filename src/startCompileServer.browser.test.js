import { startCompileServer } from "./startCompileServer.js"
import { createBrowserLoader } from "./createLoader/createBrowserLoader.js"
import { all, fromPromise } from "@dmail/action"
import { test } from "@dmail/test"
import assert from "assert"
import path from "path"
import puppeteer from "puppeteer"

const startBrowserPage = () => {
	// https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md

	return fromPromise(
		puppeteer
			.launch({
				// maybe we'll have to set ignoreHTTPSErrors to true because
				// we use a self signed certificate ?
				// ignoreHTTPSErrors: true
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

const testImport = (relativeFileLocation) => {
	return all([
		startCompileServer({
			location: `${path.resolve(__dirname, "../../src/__test__")}`,
		}),
		startBrowserPage(),
	]).then(([server, { browser, page }]) => {
		// on fera un page.goTo(server.url.href)
		// mais il faut donc que le serveur nous serve un fichier html
		// ensuite on pourra surement faire un eval dans cette page html
		// ou alors il nous faut un autre serveur chargé de fournir le html
		// pour pas tout mélanger

		const loader = createBrowserLoader({ base: server.url.href })
		return fromPromise(loader.import(relativeFileLocation)).then((value) => {
			return all([server.close(), browser.close()]).then(() => value)
		})
	})
}

test(() => {
	return testImport("./file.js").then((bindings) => {
		assert.equal(bindings.default, true)
	})
})
